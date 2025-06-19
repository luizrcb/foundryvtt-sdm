import { SDM } from '../helpers/config.mjs';
import { ActorType, Die } from '../helpers/constants.mjs';

const { renderTemplate } = foundry.applications.handlebars;

class ExplosiveDie {
  constructor(dieTerm, faces) {
    this.dieIndex = dieTerm.dieIndex;
    this.resultIndex = dieTerm.resultIndex;
    this.faces = faces;
    this.original = dieTerm.result;
    this.modified = dieTerm.result;
    this.heroicAllocated = [];
    this.explosions = [];
    this.explosionChain = [];
  }
}

export class HeroDiceProcessor {
  static async process(originalRoll, heroicDiceQty, actor, keepRule, shouldExplode = true) {
    const dieFaces = originalRoll?.dice[0]?.faces || Die.d20;
    const modifier = {
      formula: '',
      result: 0,
      multiplier: '',
    };

    let nextOp = '';
    originalRoll.terms.forEach((term, termIndex) => {
      if (termIndex === 0) return;
      switch (term.constructor) {
        case foundry.dice.terms.Die:
        case foundry.dice.terms.NumericTerm:

          if (nextOp === '*') {
            modifier.multiplier += term.total;
            break;
          }

          modifier.formula += term.formula;
          if (!nextOp || nextOp === '+') {
            modifier.result += term.total;
          } else {
            modifier.result -= term.total;
          }

          nextOp = '';
          break;
        case foundry.dice.terms.OperatorTerm:
          nextOp = term.operator;
          if (nextOp !== '*') {
            modifier.formula += term.operator;
          } else {
            modifier.multiplier += nextOp
          }

          break;
        default:
          break;
      }
    });

    // 1. Parse original dice
    const explosiveDice = originalRoll.dice
      .filter(d => d.faces === dieFaces) // Pode ser parametrizado para dx
      .flatMap((d, dieIndex) =>
        d.results.map((r, resultIndex) =>
          new ExplosiveDie({ ...r, dieIndex, resultIndex }, d.faces)));

    const nonExplosiveDice = originalRoll.dice.filter(d => d.faces !== dieFaces);
    const heroDiceType = actor.system.hero_dice.dice_type;
    // 2. Roll hero dice
    const heroicRoll = await this._rollHeroDice(heroicDiceQty, true, false, Die[heroDiceType],
      // force hero dice results for testing
      // {dice: [{ results: [{result: 1, index: 0}]}]},
    );
    await this.updateHeroDice(actor, heroicDiceQty);

    const heroicResults = heroicRoll.dice[0].results.map(hr => hr.result);

    // 3. Distribuir d6s otimizadamente
    const distribution = this._distributeHeroDice(
      explosiveDice,
      heroicResults,
      keepRule,
    );

    if (shouldExplode) {
      // 4. Processar explosões
      await this._processExplosions(distribution, dieFaces);
    }

    // 5. Calcular totais
    const result = this._calculateFinalResult(
      explosiveDice,
      heroicResults,
      distribution,
      originalRoll,
      modifier,
      keepRule,
      shouldExplode,
    );

    // 6. Gerar mensagem de saída
    return this._createChatMessage(result, dieFaces, actor);
  }

  static async updateHeroDice(actor, heroicDiceQty) {
    const current = Math.max(0, actor.system.hero_dice?.value || 0);
    const newHeroDiceValue = Math.max(current - heroicDiceQty, 0);
    await actor.update({
      'system.hero_dice.value': newHeroDiceValue,
    });
  }

  static getKeepRule(originalRoll) {
    const defaultRule = {
      type: 'kh',
      count: 1,
    };

    const dieTerm = originalRoll.terms.find(t => t instanceof foundry.dice.terms.Die);
    if (!dieTerm) return defaultRule;

    // Find keep modifier (kh/kl) in dice notation
    const keepMod = dieTerm.modifiers.find(m => ['kh', 'kl'].some(k => m.startsWith(k)));

    if (!keepMod) return defaultRule;

    // Parse modifier string (e.g. "kh2" → {type: 'kh', count: 2})
    const match = keepMod.match(/(kh|kl)(\d*)/);
    if (!match) return defaultRule;

    return {
      type: match[1], // 'kh' or 'kl'
      count: match[2] ? parseInt(match[2]) : 1 // Default to 1 if no number
    };
  };

  static async _rollHeroDice(qty, displayDice = true, healingHouseRule = false, heroicDieFaces = Die.d6, fixedResult) {
    let roll = new Roll(`${qty}d${heroicDieFaces}`);

    if (healingHouseRule) {
      roll = new Roll(`{${qty}d${heroicDieFaces}, ${qty}d${heroicDieFaces}}kh`);
    }

    await roll.evaluate();

    if (displayDice && game.dice3d) await game.dice3d.showForRoll(roll);
    if (fixedResult) return Promise.resolve(fixedResult);
    return roll;
  }

  static _distributeHeroDice(explosiveDice, heroicResults, keepRule) {
    // Converte resultados para objetos simulados
    const heroicResultsObjects = heroicResults.map((result, index) => ({
      result,
      index
    }));

    const strategy = keepRule.type === 'kh' ?
      HeroDiceProcessor._khDistributionStrategy :
      HeroDiceProcessor._klDistributionStrategy;

    return strategy(explosiveDice, heroicResultsObjects);
  }

  static _khDistributionStrategy(explosiveDice, heroicResults) {
    // Implementação da estratégia Keep Highest
    const sortedDice = [...explosiveDice].sort((a, b) =>
      (b.faces - b.original) - (a.faces - a.original));

    const sortedHero = [...heroicResults].sort((a, b) => b.result - a.result);
    const distribution = new Map();

    for (const die of sortedDice) {
      const needed = die.faces - die.original;
      if (needed <= 0) continue;

      let found = false;

      // Fase 1: Busca por combinação exata
      for (let i = 0; i < sortedHero.length; i++) {
        if (sortedHero[i].result === needed) {
          HeroDiceProcessor._allocateHero(die, sortedHero, i, distribution);
          found = true;
          break;
        }
      }

      // Fase 2: Busca pela menor combinação possível que atinja o necessário
      if (!found) {
        let bestFitIndex = -1;
        let minExcess = Infinity;

        for (let i = 0; i < sortedHero.length; i++) {
          if (sortedHero[i].result >= needed) {
            const excess = sortedHero[i].result - needed;
            if (excess < minExcess) {
              minExcess = excess;
              bestFitIndex = i;
            }
          }
        }

        if (bestFitIndex !== -1) {
          HeroDiceProcessor._allocateHero(die, sortedHero, bestFitIndex, distribution);
          found = true;
        }
      }

      // Fase 3: Usar combinações de múltiplos dados se necessário
      if (!found && sortedHero.length > 0) {
        const combination = HeroDiceProcessor._findOptimizedCombination(sortedHero, needed);
        if (combination) {
          combination.reverse().forEach(index =>
            HeroDiceProcessor._allocateHero(die, sortedHero, index, distribution));
          found = true;
        }
      }

      if (found) {
        sortedHero.sort((a, b) => b.result - a.result); // Re-sort após remoções
      }
    }
    let usedHeroIndexes;

    if (!sortedHero.length) {
      usedHeroIndexes = heroicResults.map(hr => hr.index);
    } else {
      usedHeroIndexes = sortedHero.map(h => h.index);
    }

    return {
      distribution: new Map([...distribution]),
      explosionCount: distribution.size,
      usedHeroIndexes, // Índices originais
      keepRule: { type: 'kh', count: 1 }, // Implementar lógica real de keepCount
      heroicResults // Manter resultados completos
    };
  }

  static _klDistributionStrategy(explosiveDice, heroicResults) {
    const dieFaces = explosiveDice[0].faces;

    // 1. Ordenar dados originais do menor para maior
    const sortedDice = [...explosiveDice].sort((a, b) => a.original - b.original);

    // 2. Ordenar dados heroicos do maior para menor
    const sortedHero = [...heroicResults].sort((a, b) => b.result - a.result);

    // 3. Alocar para maximizar o mínimo
    let currentMin = Math.min(...sortedDice.map(d => d.original));

    while (sortedHero.length > 0 && !sortedDice.every((d => d.modified >= dieFaces))) {
      // Encontrar dado mais baixo que pode ser melhorado
      const targetDie = sortedDice.find(d => d.modified === currentMin);
      if (!targetDie) break;

      // Maior dado heroico que não ultrapasse o limite
      const heroicDie = sortedHero.shift();
      const possibleValue = targetDie.modified + heroicDie.result;

      targetDie.modified = Math.min(possibleValue, dieFaces);
      targetDie.heroicAllocated.push(heroicDie);
      currentMin = Math.min(...sortedDice.map(d => d.modified));

      // if (possibleValue <= targetDie.faces) {
      //   targetDie.modified = possibleValue;
      //   targetDie.heroicAllocated.push(heroicDie);
      //   currentMin = Math.min(...sortedDice.map(d => d.modified));
      // }
    }

    sortedDice.sort((a, b) => a.modified - b.modified);
    const finalDice = sortedDice[0];

    return {
      distribution: new Map(sortedDice.map(d => [d, d.heroicAllocated])),
      explosionCount: sortedDice.filter(d => d.modified === d.faces).length,
      usedHeroIndexes: finalDice?.heroicAllocated.map(h => h.index),
      heroicResults,
      keepRule: { type: 'kl', count: 1 }
    };
  }

  static _allocateHero(die, heroicPool, index, distribution) {
    die.modified = die.faces;
    const allocated = heroicPool.splice(index, 1)[0];
    die.heroicAllocated.push(allocated);
    distribution.set(die, die.heroicAllocated);
  }

  static _findOptimizedCombination(heroicPool, needed) {
    let best = null;
    let minWaste = Infinity;

    for (const combo of this._getCombinationsOptimized(heroicPool, needed)) {
      const waste = combo.reduce((s, h) => s + h.result, 0) - needed;

      if (waste < minWaste ||
        (waste === minWaste && combo.length < best.length)) {
        best = combo;
        minWaste = waste;
      }
    }

    return best?.map(h => heroicPool.indexOf(h));
  }

  // Adicione este método para combinações eficientes
  static *_getCombinationsOptimized(array, target) {
    const stack = [{ index: 0, current: [], sum: 0 }];

    while (stack.length > 0) {
      const { index, current, sum } = stack.pop();

      for (let i = index; i < array.length; i++) {
        const newSum = sum + array[i].result;
        const newCombo = [...current, array[i]];

        if (newSum >= target) {
          yield newCombo;
        } else {
          stack.push({ index: i + 1, current: newCombo, sum: newSum });
        }
      }
    }
  }

  static async _processExplosions(distribution, dieFaces = Die.d20) {
    const { explosionCount, distribution: explodedDice } = distribution;

    for (let [die, _heroicDistribution] of explodedDice.entries()) {
      if (die.modified < die.faces) continue;

      const chain = [];
      let roll;
      do {
        roll = await new Roll(`1d${dieFaces}`).evaluate();
        if (game.dice3d) await game.dice3d.showForRoll(roll);
        chain.push(roll.total);
      } while (roll.total === dieFaces);
      die.explosionChain = chain;
    }
  }

  static _calculateFinalResult(explosiveDice, heroicResults, distribution, originalRoll, modifier, keepRule, shouldExplode) {
    // 1. Calcular soma total para cada dado (modificado + explosões)
    const diceWithTotals = [];
    const heroicDistribution = distribution.distribution;
    const heroicDice = distribution.heroicResults;

    if (heroicDistribution.size) {
      for (let [die, _heroicDistribution] of heroicDistribution.entries()) {
        diceWithTotals.push({
          die,
          total: Math.min(die.modified, die.faces) + (
            shouldExplode ? die.explosionChain.reduce((a, b) => a + b, 0) : 0),
        })
      }
    } else {
      const highestDie = explosiveDice.sort((a, b) => b.original - a.original)[0];
      highestDie.heroicAllocated = heroicDice;
      highestDie.isKept = true;
      diceWithTotals.push({
        die: highestDie,
        total: highestDie.original,
      });
    }

    const heroDiceTotal = heroicResults.reduce((a, b) => a + b, 0);

    // 2. Ordenar e selecionar os dados mantidos
    const keptDice = diceWithTotals
      .sort((a, b) => keepRule.type === 'kh' ? b.total - a.total : a.total - b.total)
      .slice(0, keepRule.count);

    // 3. Calcular total final
    let total = keptDice.reduce((sum, d) => sum + d.total, 0);
    let diceTotal = total;

    if (modifier.multiplier) {
      const multiplyBy = parseInt(modifier.multiplier.split('*')[1]);
      total *= multiplyBy;
      diceTotal = total;
    }

    if (modifier.result) {
      total += modifier.result;

    }

    if (!heroicDistribution.size) {
      total += heroDiceTotal;
      diceTotal = total;
    }

    return {
      total,
      explosiveDice,
      keptDice: keptDice.map(d => d.die),
      fixedModifiers: modifier,
      multiplier: modifier.multiplier,
      diceTotal,
      distribution,
    };
  }

  static async _createChatMessage(result, dieFaces, actor) {
    const {
      keptDice,
      explosiveDice,
      distribution,
      fixedModifiers,
      total,
      shouldExplode = true,
      multiplier,
      diceTotal,
    } = result;

    // const keptDice = result.explosiveDice
    //   .sort((a, b) => b.modified - a.modified) // Ordenar por modificado DESC
    //   .slice(0, result.distribution.keepRule.count); // Manter apenas os necessários

    const remainingDice = explosiveDice.map((die, index) => ({
      original: die.original,
      modified: die.modified,
      heroicAllocated: die.heroicAllocated.map(h => h.index),
      explosions: die.explosionChain,
      isKept: keptDice.includes(die) // Adiciona flag de dado mantido
    }));

    const finalDice = remainingDice.find((dice) => dice.isKept);
    const heroicUsed = finalDice?.heroicAllocated;

    const explosions = [];

    for (let explodedDie of remainingDice) {
      if (explodedDie.explosions.length) {
        explosions.push({
          isKept: explodedDie.isKept,
          chain: explodedDie.explosions,
        })
      }
    }

    const templateData = {
      dice: remainingDice,
      heroicTotal: distribution.heroicResults || [], // provavelmente esta errado
      heroicUsed: heroicUsed,
      total: total,
      modifiers: fixedModifiers,
      keepCount: distribution.keepRule.count,
      explosions,
      dieFaces,
      shouldExplode,
      multiplier: multiplier ? SDM.damageMultiplier[multiplier] : '',
      diceTotal,
      heroDiceType: actor.system.hero_dice.dice_type,
    };

    return ChatMessage.create({
      user: game.user.id,
      content: await renderTemplate("systems/sdm/templates/chat/hero-dice-result.hbs", templateData),
      speaker: ChatMessage.getSpeaker({ actor }),
      rollMode: game.settings.get('core', 'rollMode'),
      flavor: '[Hero dice roll]',
      flags: { "sdm.isHeroResult": true },
    });
  }
}

export function getHeroDiceSelect(actor, includeZero = false, isDamageRoll = false, healingHouseRuleEnabled = false) {
  const maxHeroDice = actor.system.hero_dice?.value ?? 0;

  const options = Array.from({ length: maxHeroDice }, (_, i) =>
    `<option value="${i + 1}">${i + 1}</option>`
  ).join('');
  const heroicDiceSelect = `
      <div class="form-group">
        <label>${game.i18n.localize("SDM.HeroDice")}</label>
        <select name="heroicQty">
          ${includeZero ? '<option value="0">0</option>' : ''}
          ${options}
        </select>
      </div>
      ${isDamageRoll ? `
      <div class="form-group">
        <label for="shouldExplode">${game.i18n.localize("SDM.ExplodingDice")}</label>
        <input id="shouldExplode" type="checkbox" name="shouldExplode" />
      </div>
      `: ''}
      ${healingHouseRuleEnabled ? `
      <div class="form-group">
        <label for="healingHouseRule">${game.i18n.localize("SDM.HealingHouseRule")}</label>
        <input id="healingHouseRule" type="checkbox" name="healingHouseRule" checked />
        <p>${game.i18n.localize("SDM.HealingHouseRuleHint")}</p>
      </div>
      `: ''}
    `;
  return heroicDiceSelect;
}


export async function sendRollToChat(roll, actor, flavor, flags) {
  try {
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor,
      rollMode: game.settings.get('core', 'rollMode'),
      flags,
    });
  } catch (error) {
    console.error("Chat message failed:", error);
    throw error;
  }
}

// Integração com o handler original
export async function handleHeroDice(event, message, messageActor) {
  const actor = messageActor || game.user?.character || canvas?.tokens?.controlled[0]?.actor;

  if (!actor || actor.type !== ActorType.CHARACTER) {
    ui.notifications.error("No valid actor was selected!");
    return;
  }

  const maxDice = actor.system.hero_dice.value;
  if (maxDice < 1)  {
    ui.notifications.error(`${actor.name } has no hero dice available for this roll!`);
    return;
  }

  const originalRoll = message.rolls[0];
  const isDamageRoll = !!message?.getFlag('sdm', 'isDamageRoll');
  const isTraitRoll = !!message?.getFlag('sdm', 'isTraitRoll');
  const heroDiceType = actor.system.hero_dice.dice_type;

  const heroicDiceOptions = await foundry.applications.api.DialogV2.prompt({
    window: {
      title: `${actor.name} ${game.i18n.localize("SDM.UseHeroDice")}`,
    },
    content: getHeroDiceSelect(actor, false, isDamageRoll || !isTraitRoll),
    ok: {
      icon: `fas fa-dice-${heroDiceType}`,
      label: game.i18n.localize("SDM.Roll"),
      callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object,
    }
  });

  if (heroicDiceOptions === null) return;

  const {
    heroicQty = 0,
    shouldExplode = true,
  } = heroicDiceOptions;
  const heroicDiceQty = parseInt(heroicQty || 0, 10);
  const currentHeroDice = actor?.system?.hero_dice?.value || 0;
  if (heroicDiceQty > currentHeroDice) return;
  const keepRule = HeroDiceProcessor.getKeepRule(originalRoll);
  HeroDiceProcessor.process(originalRoll, heroicDiceQty, actor, keepRule, shouldExplode);
}

export async function healingHeroDice(event, actor) {
  const healingHouseRuleEnabled = !!game.settings.get('sdm', 'healingHouseRule');
  const maxDice = actor.system.hero_dice.value;
  if (maxDice < 1) return ui.notifications.error("No Hero Dice available!");

  const heroDiceType = actor.system.hero_dice.dice_type;
  const heroDiceString = Die[healingHeroDice];

  const heroicDiceOptions = await foundry.applications.api.DialogV2.prompt({
    window: {
      title: game.i18n.localize("SDM.UseHeroDice"),
    },
    content: getHeroDiceSelect(actor, false, false, healingHouseRuleEnabled),
    ok: {
      icon: `fas fa-dice-${heroDiceType}`,
      label: game.i18n.localize("SDM.Roll"),
      callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object,
    },
  });

  const {
    heroicQty = '0',
    healingHouseRule = false,
  } = heroicDiceOptions;
  const heroicDiceQty = parseInt(heroicQty || 0, 10);
  const currentHeroDice = actor.system.hero_dice.value;
  if (heroicDiceQty > currentHeroDice) return;

  const diceType = actor.system.hero_dice.dice_type;

  const roll = await HeroDiceProcessor._rollHeroDice(heroicDiceQty, false, healingHouseRule,  Die[diceType]);
  await sendRollToChat(roll, actor, 'Hero dice healing', {
    "sdm.isHeroResult": true,
  });
  await HeroDiceProcessor.updateHeroDice(actor, heroicDiceQty);
};

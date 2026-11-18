import { attackFollowupHtml } from '../../attackFollowup.mjs';
import { attackFeatureHtml } from '../../attackFeatures.mjs';
import { applyDamageHtml } from '../../ui/applyDamage.mjs';
import { changeLifeOf } from '../../../app/use-item.mjs';
import { cardHeader, cardWrap, marginText, resultStrip } from '../../ui/cardParts.mjs';
import { criticalMultiplier } from '../../sdmRoll.mjs';
import { recheckTriggersAfterHeroDice, renderTriggers, runTriggerActions } from '../../triggers.mjs';
import { recheckSaveAgainst, saveAgainstHtml, saveOutcome } from '../../../app/save-against.mjs';
import { createChatMessage } from '../../../helpers/chatUtils.mjs';
import { $fmt, $l10n, capitalizeFirstLetter } from '../../../helpers/globalUtils.mjs';
import { templatePath } from '../../../helpers/templates.mjs';
import {
  renderSaveResult,
  renderNPCMoraleResult,
  renderCorruptionResult,
  renderReactionResult,
  renderDefeatResult,
  renderUsageResult,
  renderDangerResult,
  renderGroupChaseResult,
  renderRelifeResult
} from '../../ui/renderResults.mjs';

const { renderTemplate } = foundry.applications.handlebars;

export class HeroDiceUI {
  static getHeroDiceSelect(
    actor,
    includeZero = false,
    healingHouseRuleEnabled = false,
    bonusHeroDice = 0,
    includeModeToggle = true,
    resource = 'hero_dice',
    includeTouristDice = false
  ) {
    const maxHeroDice = actor.system[resource]?.value ?? 0;
    const touristDice =
      resource === 'hero_dice' && actor.system.tourist_dice.enabled
        ? actor.system.tourist_dice.value
        : 0;
    const diceAmount = includeTouristDice ? maxHeroDice + touristDice : maxHeroDice;
    const options = Array.from(
      { length: diceAmount },
      (_, i) => `<option value="${i + 1}">${i + 1}</option>`
    ).join('');

    return `
      <div class="form-group">
        <label for="heroicQty">${$l10n('SDM.ItemQuantity')}</label>
        <select name="heroicQty">
          ${includeZero ? '<option value="0">0</option>' : ''}
          ${options}
        </select>
      </div>
      ${
        bonusHeroDice > 0
          ? `
        <div class="form-group mt-10">
          <label for="bonusQty">${$l10n('SDM.BonusHeroDice')}</label>
          <input type="text" name="bonusQty" value="${bonusHeroDice}" data-dtype="Number" disabled/>
        </div>`
          : ''
      }
      ${
        healingHouseRuleEnabled
          ? `<div class="form-group">
          <label for="healingHouseRule">${$l10n('SDM.SettingsHealingHouseRule')}</label>
          <input id="healingHouseRule" type="checkbox" name="healingHouseRule" />
          <p>${$l10n('SDM.SettingsHealingHouseRuleHint')}</p>
        </div>`
          : ''
      }
      ${
        includeModeToggle
          ? `
        <div class="form-group mt-10">
          <label for="heroMode">${$l10n('SDM.HeroDiceMode') || 'Hero Dice Mode'}</label>
          <select name="heroMode">
            <option value="increase">${$l10n('SDM.HeroDiceModeIncrease') || 'Increase (boost result)'}</option>
            <option value="decrease">${$l10n('SDM.HeroDiceModeDecrease') || 'Decrease (suppress result)'}</option>
          </select>
          <p class="hint">
            ${$l10n('SDM.HeroDiceModeHint') || 'Choose whether hero dice should raise or lower the previous roll. Decrease will floor dice at 1 and never explode.'}
          </p>
        </div>`
          : ''
      }
    `;
  }

  static async renderResultToChat(result, actor, flags, heroicBonusQty = 0, heroMode = 'increase', originalRoll = null) {
    const {
      keptDice,
      explosiveDice,
      distribution,
      nonTargetValue,
      total,
      targetMultiplier,
      targetGroupTotal,
      keepRule
    } = result;

    const remainingDice = explosiveDice.map(die => ({
      ...die,
      original: die.originalResults[0].result,
      isKept: keptDice.includes(die),
      dieFaces: die.faces
    }));

    const explosions = explosiveDice
      .filter(die => die.newExplosions.length)
      .map(die => ({
        dieFaces: die.faces,
        isKept: keptDice.includes(die),
        chain: die.newExplosions,
        index: die.dieIndex
      }));

    const defaultHeroDiceType = game.settings.get('sdm', 'defaultHeroDiceType');
    const heroDiceType = actor?.system?.hero_dice?.dice_type || defaultHeroDiceType;
    const actorData = actor?.system;
    const damageMultiplier = CONFIG.SDM.getDamageMultiplier(actorData.base_damage_multiplier || 2);
    const heroicIndexes = remainingDice
      .filter(remaining => remaining.isKept)
      .flatMap(remaining => (remaining.heroicAllocated || []).map(heroic => heroic.index));

    const sortedHeroDice = [...distribution.heroicResults].sort((a, b) => {
      const aUsed = heroicIndexes.includes(a.index);
      const bUsed = heroicIndexes.includes(b.index);

      // Both in used or both not used = preserve original order
      if (aUsed === bUsed) return 1;

      // Only a is used = a comes first
      if (aUsed) return -1;

      // Only b is used = b comes first
      return 1;
    });

    const templateData = {
      dice: remainingDice,
      heroicTotal: sortedHeroDice,
      heroicUsed: heroicIndexes,
      total,
      modifiers: nonTargetValue,
      multiplier: targetMultiplier !== 1 ? damageMultiplier[`*${targetMultiplier}`] : '',
      diceTotal: targetGroupTotal,
      keepCount: keepRule.count,
      explosions,
      heroDiceType,
      heroMode: capitalizeFirstLetter(heroMode)
    };

    const heroResultRoll = Roll.fromTerms([new foundry.dice.terms.NumericTerm({ number: total })]);

    heroResultRoll._evaluated = true;
    heroResultRoll._total = total;

    const flavor =
      `[${$l10n('SDM.FieldHeroDice')}]` +
      `${heroMode === 'decrease' ? `<br>${$l10n('SDM.HeroDiceModeDecrease')}` : ''}` +
      `${heroicBonusQty > 0 ? ` (${$l10n('SDM.FieldBonus')}: ${heroicBonusQty})` : ''}`;

    // An attack made with a weapon / power keeps its damage button on the hero dice result. Hero dice
    // can bump d20s to natural 20s (which explode again): the multiplier follows the result's 20s
    const attackItem = flags?.sdm?.attackItem ? { ...flags.sdm.attackItem } : null;
    if (attackItem) {
      attackItem.multiplier = criticalMultiplier(fromUuidSync(attackItem.actor), heroTwenties(keptDice));
      // The target goes with the damage button only if the attack now hits it
      const checkHit = flags?.sdm?.triggerCheck;
      if (checkHit?.kind === 'attack' && Number.isFinite(checkHit.defense) && checkHit.defense !== null) {
        if (Number(total) > checkHit.defense && checkHit.targetUuid) attackItem.target = checkHit.targetUuid;
        else delete attackItem.target;
      }
    }
    // Triggers that match the improved result but didn't match the original roll fire now
    const recheck = recheckTriggersAfterHeroDice(flags?.sdm?.triggerCheck, originalRoll, result);
    // The card: title and chips, the dice (the template), an attack's outcome before → after, the
    // triggers that fire now, and the damage button
    const check = flags?.sdm?.triggerCheck;
    const spent = distribution?.heroicResults?.length ?? 0;
    const chips = [game.i18n.format(spent === 1 ? 'SDM.Card.HeroDieSpent' : 'SDM.Card.HeroDiceSpent', { count: spent })];
    if (heroMode === 'decrease') chips.push($l10n('SDM.HeroDiceModeDecrease'));
    if (heroicBonusQty > 0) chips.push(`${$l10n('SDM.FieldBonus')}: ${heroicBonusQty}`);
    let strip = '';
    if (check?.kind === 'attack' && Number.isFinite(check.defense) && check.defense !== null && originalRoll) {
      const hit = value => Number(value) > check.defense;
      const word = value => $l10n(hit(value) ? 'SDM.Card.Hit' : 'SDM.Card.Miss').toUpperCase();
      const before = word(originalRoll.total);
      const after = word(total);
      // The attack's target, as on the attack's card (this card takes its place)
      const target = check.targetUuid ? fromUuidSync(check.targetUuid) : null;
      const token = target?.getActiveTokens?.()[0]?.document;
      strip = resultStrip({
        tone: hit(total) ? 'good' : 'bad',
        img: target ? token?.texture?.src || target.img : '',
        name: target ? target.name : `${$l10n('SDM.FieldDefense')} ${check.defense}`,
        sub: target ? `<i class="fa-solid fa-shield-halved"></i> ${foundry.utils.escapeHTML($l10n('SDM.FieldDefense'))} ${check.defense}` : '',
        outcomeHtml: before === after ? foundry.utils.escapeHTML(after) : `<span class="was">${before}</span> → ${after}`,
        margin: marginText(total - check.defense)
      });
    }
    let actions = attackFollowupHtml(attackItem);
    // The item's feature buttons and notes (entangle, petrify…, vorpal), as on the attack's card, for
    // the result as it is now (a natural 20 made by hero dice counts)
    if (check?.kind === 'attack' && check.withItem) {
      const attacker = fromUuidSync(check.actor);
      const target = check.targetUuid ? fromUuidSync(check.targetUuid) : null;
      const hits = Number.isFinite(check.defense) && check.defense !== null ? Number(total) > check.defense : null;
      actions += attackFeatureHtml({
        actor: attacker,
        item: attacker?.items?.get(check.withItem),
        targetActor: target,
        success: hits,
        isNat20: heroTwenties(keptDice) > 0
      });
    }
    // A damage roll (its card had the apply buttons): this card gets them for the new total, and damage
    // applied automatically by that card is corrected to it — only the difference, which this card's
    // Undo gives back (the old card's Undo still gives back what it applied)
    const source = game.messages.get(flags?.sdm?.sourceMessage ?? '');
    const sourceDiv = source?.content?.includes('sdm-apply-damage') ? document.createElement('div') : null;
    let damageTag = '';
    const damageFixes = [];
    if (sourceDiv) {
      sourceDiv.innerHTML = source.content;
      actions += applyDamageHtml(total);
      // Every target the damage was applied to (one, or each one an area hit), unless undone
      const undone = source.getFlag('sdm', 'damageUndoneTargets') ?? [];
      for (const auto of sourceDiv.querySelectorAll('.sdm-auto-damage')) {
        const autoTarget = fromUuidSync(auto.dataset.targetUuid);
        // An area target with a reduction (Bystander): the same reduction on the new total
        const reduction = Number(auto.dataset.reduction) || 0;
        const newAmount = Math.max(Number(total) - reduction, 0);
        const diff = newAmount - (Number(auto.dataset.amount) || 0);
        if (!autoTarget || !diff || source.getFlag('sdm', 'damageUndone') || undone.includes(autoTarget.uuid)) continue;
        damageFixes.push({ target: autoTarget, amount: Math.abs(diff), heal: diff < 0 });
        const text = game.i18n.format(diff > 0 ? 'SDM.Card.DamageAdded' : 'SDM.Card.DamageReduced', {
          amount: Math.abs(diff),
          target: autoTarget.name,
          total: newAmount
        });
        damageTag +=
          `<div class="sdm-card-tag info sdm-auto-damage" data-target-uuid="${foundry.utils.escapeHTML(autoTarget.uuid)}" data-amount="${Math.abs(diff)}"${diff < 0 ? ' data-heal="1"' : ''}>` +
          `<i class="fa-solid fa-heart-crack"></i> ${foundry.utils.escapeHTML(text)}` +
          ` <button type="button" data-action="sdmUndoDamage"><i class="fa-solid fa-rotate-left"></i> ${foundry.utils.escapeHTML($l10n('SDM.Card.Undo'))}</button></div>`;
      }
    }
    await createChatMessage({
      actor,
      content: cardWrap(
        cardHeader({ icon: 'fa-solid fa-dice-d6', color: 'amber', title: $l10n('SDM.FieldHeroDice'), chips }) +
          (await renderTemplate(templatePath('/chat/hero-dice-result'), templateData)) +
          strip +
          damageTag +
          renderTriggers(recheck.fired) +
          (actions ? `<div class="sdm-card-actions">${actions}</div>` : ''),
        { kind: 'hero' }
      ),
      flavor: '',
      rolls: [heroResultRoll],
      flags: {
        sdm: {
          isHeroResult: true,
          ...(flags?.sdm?.sourceMessage ? { heroOf: flags.sdm.sourceMessage } : {}),
          ...(attackItem ? { attackItem } : {})
        }
      }
    });

    for (const fix of damageFixes) await changeLifeOf(fix.target, fix.amount, { heal: fix.heal, reason: fix.heal ? 'DamageFixed' : '' });
    if (recheck.fired.length) await runTriggerActions(recheck.fired, { actor: recheck.actor });

    if (flags && flags?.sdm?.save) {
      const { label, targetNumber, speaker, cardTitle = '', chips = [] } = flags.sdm.save;
      // A save against a condition: the new card says whether it sticks (equal: the sacrifice buttons)
      const against = check?.kind === 'save' && check.saveAgainst ? check.saveAgainst : null;
      await renderSaveResult(
        { roll: heroResultRoll, label, targetNumber },
        {
          fromHeroDice: true,
          speaker,
          cardTitle,
          chips,
          extraHtml: against ? saveAgainstHtml(against, saveOutcome(total, targetNumber), fromUuidSync(check.actor)) : ''
        }
      );
    }

    // A save against a condition whose outcome the hero dice changed: the condition follows (after the
    // new save card, so its message comes under it)
    if (check?.kind === 'save' && check.saveAgainst && originalRoll && Number.isFinite(check.target)) {
      await recheckSaveAgainst(check, saveOutcome(originalRoll?.total, check.target), saveOutcome(result?.total, check.target));
    }

    if (flags && flags?.sdm?.corruption) {
      const { speaker } = flags.sdm.corruption;
      await renderCorruptionResult(
        { roll: heroResultRoll },
        {
          fromHeroDice: true,
          speaker
        }
      );
    }

    if (flags && flags?.sdm?.reaction) {
      const { charismaOperator, speaker } = flags.sdm.reaction;
      await renderReactionResult(
        { roll: heroResultRoll, charismaOperator },
        {
          fromHeroDice: true,
          speaker
        }
      );
    }

    if (flags && flags?.sdm?.defeat) {
      const { selectedAbility, speaker } = flags.sdm.defeat;
      await renderDefeatResult(
        { roll: heroResultRoll, selectedAbility },
        {
          fromHeroDice: true,
          speaker
        }
      );
    }

    if (flags && flags?.sdm?.morale) {
      const { targetNumber, speaker } = flags.sdm.morale;
      await renderNPCMoraleResult(
        { roll: heroResultRoll, targetNumber },
        {
          fromHeroDice: true,
          speaker
        }
      );
    }

    if (flags && flags?.sdm?.usage) {
      const { label, target, speaker } = flags.sdm.usage;
      await renderUsageResult(
        { roll: heroResultRoll, label, target },
        {
          fromHeroDice: true,
          speaker
        }
      );
    }

    if (flags && flags?.sdm?.danger) {
      const { label, targetNumber, speaker } = flags.sdm.danger;
      await renderDangerResult(
        { roll: heroResultRoll, label, targetNumber },
        {
          fromHeroDice: true,
          speaker
        }
      );
    }

    if (flags && flags?.sdm?.groupChase) {
      const { label, speaker } = flags.sdm.groupChase;
      await renderGroupChaseResult(
        { roll: heroResultRoll, label },
        {
          fromHeroDice: true,
          speaker
        }
      );
    }

    if (flags && flags?.sdm?.relife) {
      const { label, speaker, cost, ability } = flags.sdm.relife;
      await renderRelifeResult(
        { roll: heroResultRoll, label, cost, ability },
        {
          fromHeroDice: true,
          speaker
        }
      );
    }
  }
}

/**
 * Consecutive natural 20s of the kept d20s after hero dice: each chain (an exploding d20 split in
 * segments) read in order — every segment's value after the hero dice, then its new explosions —
 * counting 20s until the first other result. The best chain counts.
 */
export function heroTwenties(keptDice = []) {
  const chains = new Map();
  for (const die of keptDice) {
    if (die?.faces !== 20) continue;
    const key = die.chainId ?? `die-${die.dieIndex}`;
    if (!chains.has(key)) chains.set(key, []);
    chains.get(key).push(die);
  }
  let best = 0;
  for (const segments of chains.values()) {
    segments.sort((a, b) => (a.segmentIndex ?? 0) - (b.segmentIndex ?? 0));
    // A die holding several results (not split in segments): its earlier results come first
    const sequence = segments.flatMap(die => [
      ...(die.originalResults ?? []).slice(0, -1).map(r => r.result),
      die.modifiedValue,
      ...(die.newExplosions ?? [])
    ]);
    let n = 0;
    for (const value of sequence) {
      if (value !== 20) break;
      n++;
    }
    best = Math.max(best, n);
  }
  return best;
}

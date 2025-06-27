import { AdvancedRollModifier } from './advancedRollModifier.mjs';
import { isPhysicalAction, MAX_MODIFIER } from '../helpers/actorUtils.mjs';
import { ActorType, Die, ItemType, RollType } from '../helpers/constants.mjs';
import { SDM } from '../helpers/config.mjs';
import { capitalizeFirstLetter } from '../helpers/globalUtils.mjs';
import { createChatMessage } from '../helpers/chatUtils.mjs';

export class RollHandler {
  static async performRoll(actor, key, label, options = {}) {
    const {
      modifier = "",
      rollType = RollType.NORMAL,
      attack = "",
      heroicDice = 0,
      roll = "",
      rolledFrom,
      explode = true,
    } = options;

    try {
      if (roll) {
        return this.handleCustomRoll(actor, label, roll, { explode, modifier });
      }

      if (modifier && !foundry.dice.Roll.validate(modifier)) {
        ui.notifications.error(game.i18n.localize('SDM.ErrorInvalidModifier'));
        return;
      }

      // const availableHero = actor.system.hero_dice?.value ?? 0;

      const { rollFormula, flavor } = await this.prepareRollComponents(actor, key, label, {
        modifier,
        rollType,
        attack,
        heroicDice,
        rolledFrom,
        explode
      });

      const rollInstance = new Roll(rollFormula, actor.system);
      await rollInstance.evaluate();
      await actor.updateHeroDice(heroicDice);
      await createChatMessage({
        actor,
        flavor,
        rolls: [rollInstance],
        flags: { "sdm.isTraitRoll": true },
      });

      return rollInstance;
    } catch (error) {
      console.error("Roll execution failed:", error);
      throw error;
    }
  }

  static async handleItemRoll(actor, item, label, options = {}) {
    const {
      modifier = "",
      multiplier = "",
      rollType = RollType.NORMAL,
      heroicDice = 0,
      versatile = false,
      rolledFrom = ItemType.GEAR,
      explode = false,
      addAbility = '',
    } = options;

    try {
      if (modifier && !foundry.dice.Roll.validate(modifier)) {
        ui.notifications.error(game.i18n.localize('SDM.ErrorInvalidModifier'));
        return;
      }

      let baseFormula = versatile ? item.system.weapon_damage.versatile : item.system.weapon_damage.base;
      const damageBonus = item.system.weapon_damage.bonus;
      const isNegativeBonus = damageBonus[0] === '-';
      const finalFormula = `${baseFormula}${damageBonus ? `${isNegativeBonus ? '' : '+'}${damageBonus}` : ''}`
      if (!finalFormula && !foundry.dice.Roll.validate(finalFormula)) {
        ui.notifications.error(game.i18n.localize("SDM.ErrorMissingDamageFormula"));
        return;
      }

      const baseFormulaRoll = new Roll(finalFormula, actor);
      const dieFaces = baseFormulaRoll?.dice[0]?.faces;
      const ignoreEncumbered = true;

      const { rollFormula, flavor } = await this.prepareRollComponents(actor, addAbility, label, {
        modifier,
        multiplier,
        rollType,
        attack: '',
        heroicDice,
        rolledFrom,
        explode,
        ignoreEncumbered,
        dieFaces,
        versatile,
        itemFormula: finalFormula,
      });

      const rollInstance = new Roll(rollFormula, actor.system);
      await rollInstance.evaluate();
      await actor.updateHeroDice(heroicDice);
      await createChatMessage({
        actor,
        rolls: [rollInstance],
        flavor,
        flags: { "sdm.isDamageRoll": true },
      });

      return rollInstance;
    } catch (error) {
      console.error("Item roll failed:", error);
      throw error;
    }
  }

  static combineStatWithModifier(actor, addAbility, modifier) {
    if (!addAbility) return modifier.trim();

    const statPath = `abilities.${addAbility}.current`;
    const statProperty = AdvancedRollModifier._getActorProperty(actor, statPath);

    const combined = statProperty === 0
      ? modifier.trim()
      : [modifier.trim(), statProperty].filter(s => s).join("+");

    return this.sanitizeFormula(combined);
  }

  static sanitizeFormula(formula) {
    const cleaned = formula
      // First handle operator sequences
      .replace(/\+-+/g, "-")    // Convert "+-" to "-"
      .replace(/(?<!^)-+/g, "-") // Ensure single "-"
      .replace(/\++/g, "+")      // Convert multiple "+" to single "+"

      // Then clean edges and whitespace
      .replace(/(^[+ ]+)|([+ ]+$)/g, "")
      .replace(/\s+/g, "");

    foundry.dice.Roll.validate(cleaned);
    return cleaned;
  }

  static async handleCustomRoll(actor, label, baseFormula, options = {}) {
    const { explode = true, modifier = "" } = options;

    try {
      foundry.dice.Roll.validate(baseFormula);
      const sanitizedFormula = this.sanitizeFormula([`(${baseFormula})`, modifier].join("+"));
      const instance = await AdvancedRollModifier.create(sanitizedFormula, actor)
      const roll = await (instance.setExplosion(explode)).apply();
      await createChatMessage({
        actor,
        flavor: label,
        rolls: [roll],
        flags: { "sdm.isTraitRoll": true },
      });
      return roll;
    } catch (error) {
      console.error("Custom roll failed:", error);
      throw error;
    }
  }

  static async prepareRollComponents(actor, key, label, options) {
    const {
      modifier,
      multiplier = '',
      rollType,
      attack,
      heroicDice,
      rolledFrom,
      explode,
      dieFaces = Die.d20,
      ignoreEncumbered = false,
      versatile = false,
      itemFormula = '',
    } = options;

    try {
      const burdenPenalTy = actor.system.burden_penalty || 0;
      const rollModifier = this.calculateRollModifier(rollType, heroicDice);
      const diceFormula = this.buildDiceFormula({ modifier: rollModifier, explode, dieFaces, formula: itemFormula });
      const { cappedStat, hasExpertise, diceTerms, fixedValues } = this.calculateStatModifier(actor, key, attack, modifier, burdenPenalTy);
      const multipliedDiceFormula = multiplier ? `(${diceFormula})${multiplier}` : diceFormula;

      const formulaComponents = [multipliedDiceFormula, diceTerms, cappedStat];
      const escalatorDie = game.settings.get('sdm', 'escalatorDie') ?? 0;

      if (escalatorDie > 0) {
        formulaComponents.push(escalatorDie);
      }

      const formula = formulaComponents.join('+');
      const sanitizedFormula = this.sanitizeFormula(formula)

      return {
        rollFormula: sanitizedFormula,
        flavor: this.buildFlavorText({
          key,
          label,
          rollType,
          attack,
          hasExpertise,
          modifier: fixedValues,
          multiplier,
          rolledFrom,
          explode,
          rollModifier,
          heroicDice,
          versatile,
        })
      };
    } catch (error) {
      console.error("Component preparation failed:", error);
      throw error;
    }
  }

  static makeAllDiceExplode(rollFormula) {
    return rollFormula.replace(/\b(\d*d\d+)\b/g, '$1x');
  }

  static buildDiceFormula({
    formula = '',
    modifier = 0,
    dieFaces = Die.d20,
    explode = true,
  }) {
    // Validate inputs
    if (!Number.isInteger(dieFaces) || dieFaces < 2) {
      throw new Error(game.i18n.format('SDM.ErrorInvalidDiceFaces', { faces: dieFaces }));
    }

    // const diceCount = Math.abs(modifier) + 1;
    const keepModifier = modifier > 0 ? 'kh' : (modifier < 0 ? 'kl' : '');
    let diceExpression = formula || `1d${dieFaces}`;

    let final_formula = diceExpression;

    if (keepModifier) {
      final_formula = `{${diceExpression}, ${diceExpression}}${keepModifier}`
    }

    if (explode) {
      final_formula = this.makeAllDiceExplode(final_formula)
    }

    foundry.dice.Roll.validate(final_formula);
    return final_formula;
  }

  static buildFlavorText(params) {
    const {
      key,
      label,
      attack,
      hasExpertise,
      modifier,
      multiplier,
      rolledFrom,
      explode,
      rollModifier,
      heroicDice,
      versatile = false,
    } = params;

    const isDamageRoll = rolledFrom === ItemType.GEAR;
    const resultingRollType = rollModifier > 0 ? RollType.ADVANTAGE : (rollModifier < 0) ? RollType.DISADVANTAGE : RollType.NORMAL;
    const versatileLabel = game.i18n.localize(CONFIG.SDM.versatile);
    const rollModifierLabel = game.i18n.localize(`SDM.Roll${capitalizeFirstLetter(resultingRollType)}Abbr`);
    const parts = [`[${capitalizeFirstLetter(rolledFrom)}] ${hasExpertise ? '<b>*' : ''}${label}${hasExpertise ? '</b>' : ''}`];
    if ((attack || isDamageRoll) && key) parts.push(`(${game.i18n.localize(SDM.abilities[key])})`);
    if (isDamageRoll && versatile) parts.push(`(${versatileLabel})`);
    if (rollModifier !== 0) parts.push(`(${rollModifierLabel})`);
    // if (heroicDice > 0) parts.push(`(hero ${heroicDice}d6)`)
    if (isDamageRoll && multiplier) parts.push(`(${SDM.damageMultiplier[multiplier]})`);
    if (modifier) parts.push(`(${modifier >= 0 ? '+' : ''}${modifier})`);
    if (isDamageRoll && explode) parts.push(`(d*)`);

    return parts.join(' ');
  }

  static getEncumberanceModifier(actor, key) {
    const encumbered = actor.effects.getName('encumbered');
    const cumbersomeArmor = actor.effects.getName('cumbersome (armor)');
    return isPhysicalAction(key) && (encumbered || cumbersomeArmor) ? -1 : 0;
  }

  static calculateRollModifier(rollType, heroicDice) {
    let mod = 0;
    if (rollType === RollType.ADVANTAGE) mod += 1;
    if (rollType === RollType.DISADVANTAGE) mod -= 1;
    return mod + heroicDice;
  }

  static calculateStatModifier(actor, key, attack, modifier = '', burdenPenalTy = 0) {
    let expertise = 0;
    let hasExpertise = false;

    const components = this.parseModifierString(modifier);
    const { fixedValues, diceTerms } = this.separateFixedAndDice([...components, `${-burdenPenalTy}`]);

    if (attack) {
      const attackData = actor.system[attack];
      expertise = attackData.bonus;
    }
    const fixedValuesTotal = fixedValues.reduce((acc, fixVal) => acc + fixVal, 0);
    let baseAbility;
    if (actor.type === ActorType.CHARACTER) {
      baseAbility = actor.system.abilities[key]?.current || 0;
    } else if (actor.type === ActorType.NPC) {
      baseAbility = actor.system.bonus.major;
    }

    return {
      cappedStat: Math.min(baseAbility + expertise + fixedValuesTotal, MAX_MODIFIER),
      hasExpertise,
      diceTerms: diceTerms.join(''),
      fixedValues: fixedValuesTotal,
    };
  }

  static parseModifierString(modifier = '') {
    return modifier.split(/(?=[+-])/g).filter(c => c !== "");
  }

  static separateFixedAndDice(components) {
    return components.reduce((acc, component) => {
      if (component.includes('d')) {
        acc.diceTerms.push(component);
      } else {
        const value = parseInt(component, 10) || 0;
        acc.fixedValues.push(value);
      }
      return acc;
    }, { fixedValues: [], diceTerms: [] });
  }
}

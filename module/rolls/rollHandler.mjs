import { AdvancedRollModifier } from './advancedRollModifier.mjs';
import { isAttack, isPhysicalAction, MAX_MODIFIER } from '../helpers/actorUtils.mjs';
import { ActorType, Die, ItemType, RollType } from '../helpers/constants.mjs';
import { SDM } from '../helpers/config.mjs';
import { capitalizeFirstLetter } from '../helpers/globalUtils.mjs';

export class RollHandler {
  static async performRoll(actor, key, label, options = {}) {
    const {
      modifier = "",
      rollType = RollType.NORMAL,
      skill = "",
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
        ui.notifications.error("Invalid roll modifier");
        return;
      }

      // const availableHero = actor.system.hero_dice?.value ?? 0;

      const { rollFormula, flavor } = await this.prepareRollComponents(actor, key, label, {
        modifier,
        rollType,
        skill,
        heroicDice,
        rolledFrom,
        explode
      });

      const rollInstance = new Roll(rollFormula, actor.system);
      await rollInstance.evaluate();
      await actor.updateHeroDice(heroicDice);
      await this.sendRollToChat(rollInstance, actor, flavor, {
        "sdm.isTraitRoll": true,
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
        ui.notifications.error("Invalid roll modifier");
        return;
      }

      let baseFormula = versatile ? item.system.weapon_damage.versatile : item.system.weapon_damage.base;
      const damageBonus = item.system.weapon_damage.bonus;
      const isNegativeBonus = damageBonus[0] === '-';
      const finalFormula = `(${baseFormula})${damageBonus ? `${isNegativeBonus ? '' : '+'}${damageBonus}` : ''}`
      if (!finalFormula && !foundry.dice.Roll.validate(finalFormula)) {
        ui.notifications.error("Item doens't have configured damage roll formula");
        return;
      }

      const baseFormulaRoll = new Roll(finalFormula, actor);
      const dieFaces = baseFormulaRoll?.dice[0]?.faces;
      const ignoreEncumbered = true;

      const { rollFormula, flavor } = await this.prepareRollComponents(actor, addAbility, label, {
        modifier,
        multiplier,
        rollType,
        skill: '',
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
      await this.sendRollToChat(rollInstance, actor, flavor, {
        "sdm.isDamageRoll": true,
      });
      return rollInstance;
    } catch (error) {
      console.error("Item roll failed:", error);
      throw error;
    }
  }

  static combineStatWithModifier(actor, addAbility, modifier) {
    if (!addAbility) return modifier.trim();

    const statPath = `abilities.${addAbility}.final_current`;
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

      const roll = await AdvancedRollModifier.create(sanitizedFormula, actor)
        .setExplosion(explode)
        .apply();

      await this.sendRollToChat(roll, actor, label, {
        "sdm.isTraitRoll": true,
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
      skill,
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
      const { cappedStat, hasExpertise, diceTerms, fixedValues } = this.calculateStatModifier(actor, key, skill, modifier, burdenPenalTy);
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
          skill,
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

  static buildDiceFormula({
    formula = '',
    modifier = 0,
    dieFaces = Die.d20,
    explode = true,
  }) {
    // Validate inputs
    if (!Number.isInteger(dieFaces) || dieFaces < 2) {
      throw new Error(`Invalid dice faces: ${dieFaces}`);
    }

    const diceCount = Math.abs(modifier) + 1;
    const keepModifier = modifier > 0 ? 'kh' : (modifier < 0 ? 'kl' : '');
    const explodeMod = explode ? `x${dieFaces}` : '';
    let final_formula = `${diceCount}d${dieFaces}${keepModifier}${explodeMod}`;

    if (formula) {
      final_formula = `${formula}`;
      if (keepModifier) {
        final_formula = `{${formula}, ${formula}}${keepModifier}`;
      }
    }

    foundry.dice.Roll.validate(final_formula);
    return final_formula;
  }

  static buildFlavorText(params) {
    const {
      key,
      label,
      skill,
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
    const fatigueLabel = game.i18n.localize(CONFIG.SDM.fatigue);
    const versatileLabel = game.i18n.localize(CONFIG.SDM.versatile);
    const rollModifierLabel = game.i18n.localize(`SDM.Rolls.${resultingRollType}.abbr`);
    const parts = [`[${capitalizeFirstLetter(rolledFrom)}] ${hasExpertise ? '<b>*' : ''}${label}${hasExpertise ? '</b>' : ''}`];
    if ((skill || isDamageRoll) && key) parts.push(`(${game.i18n.localize(SDM.abilities[key])})`);
    if (isDamageRoll && versatile) parts.push(`(${versatileLabel})`);
    if (rollModifier !== 0) parts.push(`(${rollModifierLabel})`);
    if (heroicDice > 0) parts.push(`(hero ${heroicDice}d6)`)
    if (isDamageRoll && multiplier) parts.push(`(${SDM.damageMultiplier[multiplier]})`);
    if (modifier) parts.push(`(${modifier >= 0 ? '+' : ''}${modifier})`);
    if (isDamageRoll && explode) parts.push(`(d*)`);

    return parts.join(' ');
  }

  static async sendRollToChat(roll, actor, flavor, flags) {
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

  static calculateStatModifier(actor, key, skill, modifier = '', burdenPenalTy = 0) {
    let expertise = 0;
    let hasExpertise = false;

    const components = this.parseModifierString(modifier);
    const { fixedValues, diceTerms } = this.separateFixedAndDice([...components, `${-burdenPenalTy}`]);

    if (skill) {
      const skillData = actor.system[skill];
      expertise = skillData.bonus;
    }
    const fixedValuesTotal = fixedValues.reduce((acc, fixVal) => acc + fixVal, 0);
    let baseAbility;
    if (actor.type === ActorType.CHARACTER) {
      baseAbility = actor.system.abilities[key]?.final_current || 0;
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

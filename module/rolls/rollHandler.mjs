import { AdvancedRollModifier } from './advancedRollModifier.mjs';
import { isDefaultSkill, isPhysicalAction, MAX_MODIFIER } from '../helpers/actorUtils.mjs';
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

      // const availableHeroic = actor.system.heroics?.value ?? 0;

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
      await actor.updateHeroicDice(heroicDice);
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
      rolledFrom = ItemType.WEAPON,
      explode = false,
      addStat = '',
    } = options;

    try {
      if (modifier && !foundry.dice.Roll.validate(modifier)) {
        ui.notifications.error("Invalid roll modifier");
        return;
      }

      const baseFormula = versatile ? item.system.damage.versatile : item.system.damage.base;
      if (!baseFormula && !foundry.dice.Roll.validate(baseFormula)) {
        ui.notifications.error("Item doens't have configured damage roll formula");
        return;
      }

      const baseFormulaRoll = new Roll(baseFormula, actor);
      const dieFaces = baseFormulaRoll?.dice[0]?.faces;
      const ignoreEncumbered = true;

      const { rollFormula, flavor } = await this.prepareRollComponents(actor, addStat, label, {
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
      });

      const rollInstance = new Roll(rollFormula, actor.system);
      await rollInstance.evaluate();
      await actor.updateHeroicDice(heroicDice);
      await this.sendRollToChat(rollInstance, actor, flavor, {
        "sdm.isDamageRoll": true,
      });
      return rollInstance;
    } catch (error) {
      console.error("Item roll failed:", error);
      throw error;
    }
  }

  static combineStatWithModifier(actor, addStat, modifier) {
    if (!addStat) return modifier.trim();

    const statPath = `stats.${addStat}.final`;
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
      const sanitizedFormula = this.sanitizeFormula([baseFormula, modifier].join("+"));

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
      dieFaces = Die.D20,
      ignoreEncumbered = false,
      versatile = false,
    } = options;

    try {
      const encumberedMod = !ignoreEncumbered ? this.getEncumberanceModifier(actor, key) : 0;
      const fatigueDisadvantage = actor.system.fatigue?.disadvantage ?? false;
      const rollModifier = this.calculateRollModifier(encumberedMod, fatigueDisadvantage, rollType, heroicDice);
      const diceFormula = this.buildDiceFormula({ modifier: rollModifier, explode, dieFaces });
      const { cappedStat, hasExpertise, diceTerms, fixedValues } = this.calculateStatModifier(actor, key, skill, modifier);
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
          fatigueDisadvantage,
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
    modifier = 0,
    dieFaces = Die.D20,
    explode = true,
  }) {
    // Validate inputs
    if (!Number.isInteger(dieFaces) || dieFaces < 2) {
      throw new Error(`Invalid dice faces: ${dieFaces}`);
    }

    const diceCount = Math.abs(modifier) + 1;
    const keepModifier = modifier > 0 ? 'kh' : (modifier < 0 ? 'kl' : '');
    const explodeMod = explode ? `x${dieFaces}` : '';

    const formula = `${diceCount}d${dieFaces}${keepModifier}${explodeMod}`;
    foundry.dice.Roll.validate(formula);
    return formula;
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
      fatigueDisadvantage,
      heroicDice,
      versatile = false,
    } = params;

    const isDamageRoll = rolledFrom === ItemType.WEAPON;
    const resultingRollType = rollModifier > 0 ? RollType.ADVANTAGE : (rollModifier < 0) ? RollType.DISADVANTAGE : RollType.NORMAL;
    const fatigueLabel = game.i18n.localize(CONFIG.SDM.fatigue);
    const versatileLabel = game.i18n.localize(CONFIG.SDM.versatile);
    const rollModifierLabel = game.i18n.localize(`SDM.Rolls.${resultingRollType}.abbr`);
    const parts = [`[${capitalizeFirstLetter(rolledFrom)}] ${hasExpertise ? '<b>*' : ''}${label}${hasExpertise ? '</b>' : ''}`];
    if ((skill || isDamageRoll) && key) parts.push(`(${game.i18n.localize(SDM.stats[key])})`);
    if (isDamageRoll && versatile) parts.push(`(${versatileLabel})`);
    if (rollModifier !== 0) parts.push(`(${rollModifierLabel}${fatigueDisadvantage ? ` ${fatigueLabel}` : ''})`);
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

  static calculateRollModifier(encumberedMod, fatigueDisadvantage, rollType, heroicDice) {
    let mod = encumberedMod;
    if (rollType === RollType.ADVANTAGE) mod += 1;
    if (rollType === RollType.DISADVANTAGE) mod -= 1;
    if (fatigueDisadvantage) mod -= 1;
    return mod + heroicDice;
  }

  static calculateStatModifier(actor, key, skill, modifier = '') {
    let expertise = 0;
    let hasExpertise = false;

    const components = this.parseModifierString(modifier);
    const { fixedValues, diceTerms } = this.separateFixedAndDice(components);

    if (skill) {
      const skillData = isDefaultSkill(skill) ? actor.system[skill] : actor.system.skills.find(s => s.name === skill);
      hasExpertise = skillData?.expertise;
      expertise = hasExpertise ? actor.system.bonus * 2 : actor.system.bonus;
    }
    const fixedValuesTotal = fixedValues.reduce((acc, fixVal) => acc + fixVal, 0);
    let baseStat;
    if (actor.type === ActorType.CHARACTER) {
      baseStat = actor.system.stats[key]?.final || 0;
    } else if (actor.type === ActorType.NPC) {
      baseStat = actor.system.bonus.major;
    }

    return {
      cappedStat: Math.min(baseStat + expertise + fixedValuesTotal, MAX_MODIFIER),
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
import { ActorType, RollMode, RollType } from "../helpers/constants.mjs";
import { createChatMessage } from "../helpers/chatUtils.mjs";
import { $l10n, capitalizeFirstLetter } from "../helpers/globalUtils.mjs";

export default class SDMRoll {
  constructor({
    actor,
    type,
    from,
    mode = RollMode.NORMAL,
    formula = '1d20',
    versatileFormula = '',
    ability = '',
    skill = null,
    modifier = '',
    //TODO:  add extra situaltional modifiers like bonus for attack with specific weapon type like a mace
    multiplier = '',
    explodingDice = true,
    versatile = false,
  }) {
    this.actor = actor;
    this.type = type;
    this.from = from;
    this.mode = mode;
    this.formula = formula;
    this.ability = ability;
    this.skill = skill;
    this.modifier = modifier;
    this.multiplier = multiplier;
    this.explodingDice = explodingDice;
    this.versatile = versatile;
  }

  async evaluate() {
    const expression = this.#buildDiceComponent();
    const explodingExpression = this.#applyExplodingDice(expression);
    const multipliedExpression = this.#applyMultiplier(explodingExpression);
    const { fixedModifiers, diceModifiers } = this.#calculateModifiers();

    const formulaComponents = [multipliedExpression, diceModifiers, fixedModifiers];

    const escalatorDie = game.settings.get('sdm', 'escalatorDie') ?? 0;
    if (escalatorDie > 0) formulaComponents.push(escalatorDie);

    const formula = formulaComponents.join('+');
    const sanitizedFormula = this.#sanitizeExpression(formula); // ready to roll
    const flavor = this.#buildFlavorText(fixedModifiers, diceModifiers, escalatorDie);

    const flags = {};

    if (this.type === RollType.DAMAGE) {
      flags['sdm.isDamageRoll'] = true;
    } else {
      flags['sdm.isTraitRoll'] = true;
    }

    const rollInstance = new Roll(sanitizedFormula, this.actor.system);
    await rollInstance.evaluate();

    await createChatMessage({
      actor: this.actor,
      rolls: [rollInstance],
      flavor,
      flags,
    });

  }

  #buildDiceComponent() {
    const keepModifier = this.mode === RollMode.ADVANTAGE ? 'kh' :
      (this.mode === RollMode.DISADVANTAGE ? 'kl' : '');

    let diceExpression = keepModifier ? `{${this.formula}, ${this.formula}}${keepModifier}` : this.formula;
    return diceExpression;
  }

  #applyExplodingDice(rollExpression = '') {
    if (!this.explodingDice) {
      return rollExpression;
    }

    return rollExpression.replace(/\b(\d*d\d+)\b/g, '$1x');
  }

  #applyMultiplier(expression) {
    return this.multiplier ? `(${expression})${this.multiplier}` : expression;
  }

  #calculateModifiers() {
    const actorData = this.actor?.system;
    let abilityMod = 0;

    if (this.actor?.type === ActorType.CHARACTER) {
      abilityMod = actorData?.abilities[this.ability]?.current ?? 0;
    } else if (this.actor.type === ActorType.NPC) {
      abilityMod = actorData?.bonus ?? 0;
    }

    const burdenPenalty = actorData?.burden_penalty ?? 0;
    const burdenPenaltyBonus = actorData?.burden_penalty_bonus ?? 0;
    const skillMod = this.skill?.mod || 0;
    const allBonuses = burdenPenaltyBonus - burdenPenalty + abilityMod + skillMod;
    const modifierComponents = this.#parseModifierString(this.modifier);

    return this.#separateFixedAndDice([...modifierComponents, `${allBonuses}`]);
  }

  #sanitizeExpression(rollExpression) {
    const cleaned = rollExpression
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

  #buildFlavorText(fixedModifiers, diceModifiers) {
    const rollMode = this.mode === RollMode.NORMAL ? '' : $l10n(`SDM.Roll${capitalizeFirstLetter(this.mode)}Abbr`);
    const versatileLabel = $l10n('SDM.FeatureVersatile');

    const parts = [
      `[${$l10n(`SDM.${capitalizeFirstLetter(this.type)}`)}]`,
      this.from,
    ];

    if (this.type !== RollType.ABILITY && this.ability) parts.push(`(${$l10n(CONFIG.SDM.abilityAbbreviations[this.ability])})`);
    if (this.skill) parts.push(`(${this.skill.name})`)
    if (this.versatile) parts.push(`(${versatileLabel})`);
    if (diceModifiers) parts.push(`(${diceModifiers})`);
    if (fixedModifiers) parts.push(`(${fixedModifiers >= 0 ? '+' : ''}${fixedModifiers})`);
    if (rollMode) parts.push(`(${rollMode})`);
    if (this.multiplier) parts.push(`(${CONFIG.SDM.damageMultiplier[this.multiplier]})`);
    if (this.type === RollType.DAMAGE && this.explodingDice) parts.push(`(d*)`);

    const flavor = parts.join(' ');
    return flavor;
  }

  #parseModifierString(modifier = '') {
    return modifier.split(/(?=[+-])/g).filter(c => c !== "");
  }

  #separateFixedAndDice(components) {
    return components.reduce((acc, component) => {
      if (component.includes('d')) {
        acc.diceModifiers += component;
      } else {
        const value = parseInt(component, 10) || 0;
        acc.fixedModifiers += value;
      }
      return acc;
    }, { fixedModifiers: 0, diceModifiers: '' });
  }
}

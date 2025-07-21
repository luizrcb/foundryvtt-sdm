import { createChatMessage } from '../helpers/chatUtils.mjs';
import { ActorType, AttackTarget, RollMode, RollType } from '../helpers/constants.mjs';
import { $l10n, capitalizeFirstLetter } from '../helpers/globalUtils.mjs';

export default class SDMRoll {
  constructor({
    actor,
    type,
    from,
    mode = RollMode.NORMAL,
    formula = '1d20',
    ability = '',
    skill = null,
    modifier = '',
    //TODO:  add extra situaltional modifiers like bonus for attack with specific weapon type like a mace
    multiplier = '',
    explodingDice = true,
    versatile = false,
    targetActor,
    attackTarget = AttackTarget.PHYSICAL
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
    this.targetActor = targetActor;
    this.attackTarget = attackTarget;
  }

  async evaluate() {
    const expression = this.#buildDiceComponent();
    const explodingExpression = this.#applyExplodingDice(expression);
    const multipliedExpression = this.#applyMultiplier(explodingExpression);
    const { fixedModifiers, diceModifiers } = this.#calculateModifiers(this.type);

    const formulaComponents = [multipliedExpression, diceModifiers, fixedModifiers];

    const escalatorDie = game.settings.get('sdm', 'escalatorDie') ?? 0;
    if (escalatorDie > 0) formulaComponents.push(escalatorDie);

    const formula = formulaComponents.join('+');
    const sanitizedFormula = sanitizeExpression(formula); // ready to roll
    const flavor = this.#buildFlavorText(fixedModifiers, diceModifiers, escalatorDie);
    const isAttack = this.type === RollType.ATTACK;
    const isAbility = this.type === RollType.ABILITY;
    const isDamage = this.type === RollType.DAMAGE;
    let checkCritical = isAttack || isAbility;
    const flags = {};

    if (isDamage) {
      flags['sdm.isDamageRoll'] = true;
    } else {
      flags['sdm.isTraitRoll'] = true;
    }
    const attackMapping = {
      [AttackTarget.PHYSICAL]: {
        icon: '<i class="fas fa-shield-alt"></i>',
        property: 'defense'
      },
      [AttackTarget.MENTAL]: {
        icon: '<i class="fas fa-brain-circuit"></i>',
        property: 'mental_defense'
      },
      [AttackTarget.SOCIAL]: {
        icon: '<i class="fas fa-crown"></i>',
        property: 'social_defense'
      }
    };

    const rollInstance = new Roll(sanitizedFormula, this.actor.system);
    await rollInstance.evaluate();

    let content = await rollInstance.render();

    if (this.type === RollType.ATTACK && this.targetActor && this.targetActor !== this.actor) {
      checkCritical = false;
      const isNPCTarget = this.targetActor.type === ActorType.NPC;
      const target = isNPCTarget ? AttackTarget.PHYSICAL : this.attackTarget;

      let { icon, property } = attackMapping[target];

      const targetDefense = this.targetActor?.system[property] || 0;

      const attackResult = rollInstance.total;
      const { isNat1, isNat20 } = detectNat1OrNat20(rollInstance);
      const isSuccess = !isNat1 && (isNat20 || attackResult > targetDefense);

      let resultMessage = (isSuccess ? $l10n('SDM.Success') : $l10n('SDM.Failure')).toUpperCase();
      const textClass = isSuccess ? 'critical' : 'fumble';

      if (isNat1) {
        resultMessage = $l10n('SDM.CriticalFailure').toUpperCase();
        content = content.replace('dice-total', 'dice-total fumble');
      }

      if (isNat20) {
        resultMessage = $l10n('SDM.CriticalSuccess').toUpperCase();
        content = content.replace('dice-total', 'dice-total critical');
      }

      content +=
        `
      <br>
      <div>
        <span><b>${
        $l10n('SDM.Target')}:</b> ${this.targetActor.name}</span> <b>${
        $l10n('SDM.FieldDefense')}:</b> ${icon} ${targetDefense}</span><br>
        <b>${
        $l10n('SDM.Result')}:</b><span class="${textClass}"}> ${resultMessage}</span>
      <div>`;
    }

    await createChatMessage({
      actor: this.actor,
      rolls: [rollInstance],
      flavor,
      content,
      flags,
      checkCritical,
    });
  }

  #buildDiceComponent() {
    const keepModifier =
      this.mode === RollMode.ADVANTAGE ? 'kh' : this.mode === RollMode.DISADVANTAGE ? 'kl' : '';

    let diceExpression = keepModifier
      ? `{${this.formula}, ${this.formula}}${keepModifier}`
      : this.formula;
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

  #calculateModifiers(type) {
    const actorData = this.actor?.system;
    let abilityMod = 0;

    if (this.actor?.type === ActorType.CHARACTER) {
      abilityMod = actorData?.abilities[this.ability]?.current ?? 0;
    } else if (
      this.actor.type === ActorType.NPC &&
      ![RollType.DAMAGE, RollType.POWER].includes(type)
    ) {
      abilityMod = actorData?.bonus ?? 0;
    }

    const burdenPenalty = actorData?.burden_penalty ?? 0;
    const burdenPenaltyBonus = actorData?.burden_penalty_bonus ?? 0;
    const skillMod = this.skill?.mod || 0;
    const allBonuses = burdenPenaltyBonus - burdenPenalty + abilityMod + skillMod;
    const modifierComponents = this.#parseModifierString(this.modifier);

    return this.#separateFixedAndDice([...modifierComponents, `${allBonuses}`]);
  }

  #buildFlavorText(fixedModifiers, diceModifiers) {
    const rollMode =
      this.mode === RollMode.NORMAL ? '' : $l10n(`SDM.Roll${capitalizeFirstLetter(this.mode)}Abbr`);
    const versatileLabel = $l10n('SDM.FeatureVersatile');

    const parts = [`[${$l10n(`SDM.${capitalizeFirstLetter(this.type)}`)}]`, this.from];
    if (this.type === RollType.ATTACK && this.attackTarget !== AttackTarget.PHYSICAL) {
      parts.push(`(${$l10n('SDM.Attack' + capitalizeFirstLetter(this.attackTarget))})`);
    }
    if (this.type !== RollType.ABILITY && this.ability)
      parts.push(`(${$l10n(CONFIG.SDM.abilityAbbreviations[this.ability])})`);
    if (this.skill) parts.push(`(${this.skill.name})`);
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
    return modifier.split(/(?=[+-])/g).filter(c => c !== '');
  }

  #separateFixedAndDice(components) {
    return components.reduce(
      (acc, component) => {
        if (component.includes('d')) {
          acc.diceModifiers += component;
        } else {
          const value = parseInt(component, 10) || 0;
          acc.fixedModifiers += value;
        }
        return acc;
      },
      { fixedModifiers: 0, diceModifiers: '' }
    );
  }
}

export function sanitizeExpression(rollExpression) {
  const cleaned = rollExpression
    // First handle operator sequences
    .replace(/\+-+/g, '-') // Convert "+-" to "-"
    .replace(/(?<!^)-+/g, '-') // Ensure single "-"
    .replace(/\++/g, '+') // Convert multiple "+" to single "+"

    // Then clean edges and whitespace
    .replace(/(^[+ ]+)|([+ ]+$)/g, '')
    .replace(/\s+/g, '');

  foundry.dice.Roll.validate(cleaned);
  return cleaned;
}

/**
 * Recursively collect all DieTerm instances from any RollTerm tree.
 * Supports PoolTerm, ParentheticalTerm, OperatorTerm, etc.
 * @param {RollTerm} term
 * @returns {Die[]}
 */
export function collectAllDice(term) {
  if (term instanceof foundry.dice.terms.Die) return [term];
  if (term instanceof foundry.dice.terms.PoolTerm) {
    return term.rolls.flatMap(collectAllDice);
  }
  if (term instanceof foundry.dice.terms.ParentheticalTerm) {
    return collectAllDice(term.term);
  }
  if (Array.isArray(term.terms)) {
    return term.terms.flatMap(collectAllDice);
  }
  return [];
}

/**
 * Detects whether a d20 in the Roll resulted in a natural 1 or 20.
 * Only checks the first result on each d20 die.
 * @param {Roll} roll - An evaluated Roll object.
 * @returns {{ isNat1: boolean, isNat20: boolean }}
 */
export function detectNat1OrNat20(roll) {
  const results = [];

  for (const term of roll.terms) {
    if (term instanceof foundry.dice.terms.PoolTerm) {
      // PoolTerm: checar sub-rolls ativos
      term.results.forEach((res, index) => {
        if (!res.active) return;

        const subRoll = term.rolls[index];
        if (!subRoll) return;

        const dice = collectAllDice(subRoll);
        for (const die of dice) {
          if (!(die instanceof foundry.dice.terms.Die)) continue;

          const first = die.results.find(r => r.active);
          if (first) results.push(first.result);
        }
      });
    } else {
      // Termo normal: coleta recursiva
      const dice = collectAllDice(term);
      for (const die of dice) {
        if (!(die instanceof foundry.dice.terms.Die)) continue;

        const first = die.results.find(r => r.active);
        if (first) results.push(first.result);
      }
    }
  }

  // Determina se houve nat1 ou nat20
  for (const r of results) {
    if (r === 1) return { isNat1: true, isNat20: false };
    if (r === 20) return { isNat1: false, isNat20: true };
  }

  return { isNat1: false, isNat20: false };
}

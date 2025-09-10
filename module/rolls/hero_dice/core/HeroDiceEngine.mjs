import { ExplosiveDie } from '../models/ExplosiveDie.mjs';
import { RollAnalyzer } from './RollAnalyzer.mjs';
import { HeroDiceAllocator } from './HeroDiceAllocator.mjs';
import { KeepRule } from '../models/KeepRule.mjs';
import { Die } from '../../../helpers/constants.mjs';

/**
 * Core engine for processing heroic dice applications to rolls.
 * Handles the full workflow from roll analysis to final result calculation.
 */
export class HeroDiceEngine {
  /**
   * Processes heroic dice application to a roll
   * @async
   * @param {Roll} originalRoll - The original Foundry Roll to modify
   * @param {number} heroicDiceQty - Number of heroic dice to apply
   * @param {Actor} actor - Actor applying the heroic dice
   * @param {KeepRule} [keepRule] - Optional keep rule override
   * @returns {Promise<Object>} Final result object with:
   *   @property {number} total - Final modified roll total
   *   @property {ExplosiveDie[]} explosiveDice - Modified dice
   *   @property {ExplosiveDie[]} keptDice - Dice kept by keep rule
   *   @property {number} targetMultiplier - Multiplier applied to target group
   *   @property {number} nonTargetValue - Value from non-target terms
   *   @property {number} targetGroupTotal - Total of target group after modifications
   *   @property {Object} distribution - Heroic dice allocation details
   */
  static async process(originalRoll, heroicDiceQty, heroicBonusQty = 0, actor, { mode = "increase" } = {}) {
    const analyzer = new RollAnalyzer(originalRoll);
    const {
      targetDice,
      targetMultiplier,
      nonTargetValue,
      targetTerms,
      shouldExplode = false
    } = await analyzer.identifyTargetComponents();

    const explosiveDice = [];

    targetDice.forEach(dieTerm => {
      dieTerm.results.forEach((result, index) => {
        // Create a pseudo term for each individual die
        const pseudoTerm = {
          dieIndex: explosiveDice.length,
          results: [result]
        };

        const canExplode = (mode === "increase") && shouldExplode && !result.exploded;

        // Create separate ExplosiveDie for each die result
        explosiveDice.push(new ExplosiveDie(pseudoTerm, dieTerm.faces, canExplode));
      });
    });

    // Determine keep rule if not provided
    const keepRule = analyzer.getKeepRule(targetTerms);

    // Get heroic dice type from settings or actor
    const defaultHeroDiceType = game.settings.get('sdm', 'defaultHeroDiceType');
    const heroDiceType = actor?.system?.hero_dice?.dice_type || defaultHeroDiceType;

    // Roll heroic dice
    const heroicRoll = await this._rollHeroDice({
      quantity: heroicDiceQty + heroicBonusQty,
      faces: Die[heroDiceType]
    });

    // Update actor resource
    await this.updateHeroDice(actor, heroicDiceQty);

    // Prepare heroic results
    const heroicResults = heroicRoll.dice[0].results.map((hr, index) => ({
      result: hr.result,
      index
    }));

    // Allocate heroic dice to explosive dice
    const distribution = HeroDiceAllocator.allocate(explosiveDice, heroicResults, keepRule, { mode });

    // Apply heroic values to dice
    for (const exploDie of explosiveDice) {
      await exploDie.applyHeroic();
    }

    // Calculate and return final result
    return this._calculateFinalResult(
      explosiveDice,
      distribution,
      keepRule,
      targetMultiplier,
      nonTargetValue
    );
  }

  /**
   * Rolls heroic dice
   * @private
   * @async
   * @param {number} qty - Number of dice to roll
   * @param {number} faces - Number of faces per die
   * @returns {Promise<Roll>} The resulting Roll object
   */
  static async _rollHeroDice({
    quantity,
    faces = Die.d6,
    fixedResult,
    displayDice = true,
    healingHouseRule = false
  }) {
    const diceFormula = `${quantity}d${faces}`;
    let roll = new Roll(diceFormula);

    if (healingHouseRule) {
      roll = new Roll(`{${diceFormula}, ${diceFormula}}kh`);
    }

    await roll.evaluate();

    if (displayDice && game.dice3d) await game.dice3d.showForRoll(roll);

    if (fixedResult) return Promise.resolve(fixedResult);
    return roll;
  }

  /**
   * Updates actor's heroic dice resource
   * @private
   * @async
   * @param {Actor} actor - Actor to update
   * @param {number} qty - Quantity of dice to deduct
   */
  static async updateHeroDice(actor, qty) {
    const current = Math.max(0, actor.system.hero_dice?.value || 0);
    await actor.update({
      'system.hero_dice.value': Math.max(current - qty, 0)
    });
  }

  /**
   * Calculates final result after heroic dice application
   * @private
   * @param {ExplosiveDie[]} explosiveDice - Modified dice
   * @param {Object} distribution - Heroic dice allocation details
   * @param {KeepRule} keepRule - Keep rule used
   * @param {number} targetMultiplier - Multiplier for target group
   * @param {number} nonTargetValue - Value from non-target terms
   * @returns {Object} Final result object
   */
  static _calculateFinalResult(
    explosiveDice,
    distribution,
    keepRule,
    targetMultiplier,
    nonTargetValue
  ) {
    // Calculate totals for each die
    const diceWithTotals = explosiveDice.map(die => ({
      die,
      total: die.getTotal()
    }));

    const keptDice = diceWithTotals
      .sort((a, b) => (keepRule.type === 'kh' ? b.total - a.total : a.total - b.total))
      .slice(0, keepRule.count);

    let diceTotal = keptDice.reduce((sum, d) => sum + d.total, 0);
    let targetGroupTotal = diceTotal * targetMultiplier;

    let total = targetGroupTotal + nonTargetValue;

    return {
      total,
      explosiveDice,
      keptDice: keptDice.map(d => d.die),
      targetMultiplier,
      nonTargetValue,
      targetGroupTotal,
      diceTotal,
      distribution,
      keepRule
    };
  }
}

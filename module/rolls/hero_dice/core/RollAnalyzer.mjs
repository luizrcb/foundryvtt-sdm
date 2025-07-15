import { KeepRule } from '../models/KeepRule.mjs';

/**
 * Analyzes Foundry Roll objects to identify key components for heroic dice processing.
 * Extracts target dice groups, keep rules, multipliers, and non-target values from roll terms.
 */
export class RollAnalyzer {
  /**
   * Creates a RollAnalyzer instance
   * @param {Roll} roll - The Foundry Roll object to analyze
   */
  constructor(roll) {
    /**
     * The Roll object being analyzed
     * @type {Roll}
     */
    this.roll = roll;
  }

  /**
   * Identifies the target components in a roll for heroic dice application:
   * - Target dice group (primary dice to modify)
   - Multiplier affecting the target group
   - Non-target value (static modifiers/operations)
   * @returns {Object} Analysis result with:
   *   @property {Die[]} targetDice - Dice in the target group
   *   @property {number} targetMultiplier - Multiplier applied to target group
   *   @property {number} nonTargetValue - Calculated value of non-target terms
   */
  async identifyTargetComponents() {
    let targetDice = [];
    let targetMultiplier = 1;
    let nonTargetTerms = [];
    let targetTerms = [];
    let shouldExplode = false;
    let targetGroupIndices = new Set();

    /**
     * Extracts dice from various term types
     * @param {object} term - Foundry roll term
     * @returns {Die[]} Array of dice terms
     */
    const extractDice = term => {
      const dice = [];
      // Handle standard die terms
      if (term instanceof foundry.dice.terms.Die) {
        const explodingFound = term.modifiers.some(m => ['x'].includes(m));
        if (explodingFound) shouldExplode = true;
        dice.push(term);
      }
      // Handle pool terms (groups of dice)
      else if (term instanceof foundry.dice.terms.PoolTerm) {
        term.rolls.forEach(roll => {
          roll.dice.forEach(die => {
            dice.push(die);
            const explodingFound = die.modifiers.some(m => ['x'].includes(m));
            if (explodingFound) shouldExplode = true;
          });
        });
      }
      // Handle parenthetical terms (nested expressions)
      else if (term instanceof foundry.dice.terms.ParentheticalTerm) {
        term.roll.dice.forEach(die => {
          dice.push(die);
          const explodingFound = die.modifiers.some(m => ['x'].includes(m));
          if (explodingFound) shouldExplode = true;
        });
      }
      return dice;
    };

    // Find first eligible target group
    let firstTargetIndex = -1;
    for (let i = 0; i < this.roll.terms.length; i++) {
      const term = this.roll.terms[i];
      if (
        term instanceof foundry.dice.terms.PoolTerm ||
        term instanceof foundry.dice.terms.ParentheticalTerm ||
        term instanceof foundry.dice.terms.Die
      ) {
        firstTargetIndex = i;
        break;
      }
    }

    // Handle case with no target group
    if (firstTargetIndex === -1) {
      nonTargetTerms = this.roll.terms;
    }
    // Process identified target group
    else {
      const targetTerm = this.roll.terms[firstTargetIndex];
      targetDice = extractDice(targetTerm);
      targetGroupIndices.add(firstTargetIndex);

      // Check for multiplier after target group (e.g., "2d6 * 2")
      const nextIndex = firstTargetIndex + 1;
      if (nextIndex < this.roll.terms.length - 1) {
        const nextTerm = this.roll.terms[nextIndex];
        const nextNextTerm = this.roll.terms[nextIndex + 1];
        if (
          nextTerm instanceof foundry.dice.terms.OperatorTerm &&
          nextTerm.operator === '*' &&
          nextNextTerm instanceof foundry.dice.terms.NumericTerm
        ) {
          targetMultiplier = nextNextTerm.number;
          targetGroupIndices.add(nextIndex);
          targetGroupIndices.add(nextIndex + 1);
        }
      }

      // Collect non-target terms (outside target group)
      nonTargetTerms = this.roll.terms.filter((_, idx) => !targetGroupIndices.has(idx));
      targetTerms = this.roll.terms.filter((_, idx) => targetGroupIndices.has(idx));
    }

    // Calculate value of non-target terms
    let nonTargetValue = 0;
    if (nonTargetTerms.length > 0) {
      try {
        // Build formula from non-target terms
        let formulaParts = nonTargetTerms.map(term => {
          if (term instanceof foundry.dice.terms.OperatorTerm) return term.operator;
          if (term instanceof foundry.dice.terms.NumericTerm) return term.number;
          if (term instanceof foundry.dice.terms.Die) {
            return term.results.reduce(
              (acc, result) => (result.active ? acc + result.result : 0),
              0
            );
          }
        });
        const formulaStr = formulaParts.join('');

        if (formulaStr.trim()) {
          const roll = new Roll(formulaStr);
          await roll.evaluate();
          nonTargetValue = roll.total;
        }
      } catch {
        // Fallback to 0 if evaluation fails
        nonTargetValue = 0;
      }
    }

    return { targetDice, targetMultiplier, nonTargetValue, targetTerms, shouldExplode };
  }

  /**
   * Extracts the keep rule (kh/kl) from the roll
   * @returns {KeepRule} The identified keep rule
   */
  getKeepRule(targetTerms) {
    let keepRule = new KeepRule(KeepRule.TYPES.KEEP_HIGHEST, 0);
    let totalActiveDice = 0;
    let foundKeepMod = false;

    /**
     * Recursively processes roll terms to:
     * - Count active dice
     * - Find keep modifiers (kh/kl)
     * @param {object} term - Foundry roll term to process
     */
    const processTerm = term => {
      if (!term) return;

      // Process standard die terms
      if (term instanceof foundry.dice.terms.Die) {
        // Count active results
        const activeResults = term.results.filter(r => r.active).length;
        totalActiveDice += activeResults;

        // Check for keep modifiers in die term
        if (!foundKeepMod && term.modifiers) {
          const keepMod = term.modifiers.find(m => ['kh', 'kl'].includes(m));
          if (keepMod) {
            foundKeepMod = true;
            const match = keepMod.match(/(kh|kl)(\d*)/);
            if (match) {
              keepRule = new KeepRule(match[1], match[2] ? parseInt(match[2]) : 1);
            }
          }
        }
      }
      // Process pool terms (dice groups)
      else if (term instanceof foundry.dice.terms.PoolTerm) {
        // Count active dice in all rolls
        term.rolls.forEach(roll => {
          roll.dice.forEach(die => {
            totalActiveDice += die.results.filter(r => r.active).length;
          });
        });

        // Check for keep modifiers in pool term
        if (!foundKeepMod && term.modifiers) {
          const keepMod = term.modifiers.find(m => ['kh', 'kl'].includes(m));
          if (keepMod) {
            foundKeepMod = true;
            const match = keepMod.match(/(kh|kl)(\d*)/);
            if (match) {
              keepRule = new KeepRule(match[1], match[2] ? parseInt(match[2]) : 1);
            }
          }
        }
      }
      // Process parenthetical terms (nested expressions)
      else if (term instanceof foundry.dice.terms.ParentheticalTerm) {
        if (term.term && term.term.terms) {
          term.term.terms.forEach(innerTerm => processTerm(innerTerm));
        }
        if (term.roll && term.roll.terms) {
          term.roll.terms.forEach(innerTerm => processTerm(innerTerm));
        }
      }
      // Recursively process terms with sub-terms
      else if (term.terms) {
        term.terms.forEach(innerTerm => processTerm(innerTerm));
      }
    };

    const termsToProcess = targetTerms || this.roll.terms;

    // Process all terms in the roll
    termsToProcess.forEach(term => processTerm(term));

    // Default to 1 die if none found
    if (totalActiveDice === 0) totalActiveDice = 1;

    // Default to keeping all dice if no keep mod found
    if (!foundKeepMod) {
      keepRule = new KeepRule(KeepRule.TYPES.KEEP_HIGHEST, totalActiveDice);
    }

    return keepRule;
  }
}

/**
 * Represents a dice keeping rule (keep highest/keep lowest) for roll processing.
 * Determines which dice results are retained in a roll based on specified criteria.
 */
export class KeepRule {
  /**
   * Enumeration of valid keep rule types
   * @static
   * @property {string} KEEP_HIGHEST - Keep highest results ('kh')
   * @property {string} KEEP_LOWEST - Keep lowest results ('kl')
   */
  static TYPES = {
    KEEP_HIGHEST: 'kh',
    KEEP_LOWEST: 'kl'
  };

  /**
   * Creates a new KeepRule instance
   * @param {string} type - Keep rule type (must be one of KeepRule.TYPES values)
   * @param {number} count - Number of dice to keep
   * @throws {Error} If invalid type is provided
   */
  constructor(type, count) {
    if (!Object.values(KeepRule.TYPES).includes(type)) {
      throw new Error(`Invalid keep rule type: ${type}`);
    }

    if (typeof count !== 'number' || count < 0) {
      throw new Error(`Keep count must be a non-negative number: ${count}`);
    }

    /**
     * The rule type (kh/kl)
     * @type {string}
     */
    this.type = type;

    /**
     * Number of dice to keep
     * @type {number}
     */
    this.count = count;
  }

  /**
   * Determines if this rule keeps all dice in a set
   * @param {number} totalDice - Total number of dice in the set
   * @returns {boolean} True if we're keeping all dice, false otherwise
   */
  isKeepAll(totalDice) {
    return this.count === totalDice;
  }

  /**
   * Creates a string representation of the keep rule
   * @returns {string} The rule in dice notation format
   */
  toString() {
    return `${this.type}${this.count}`;
  }
}

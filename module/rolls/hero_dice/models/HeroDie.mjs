/**
 * Represents a single heroic die result within a roll.
 * Tracks both the numeric result and its position in the original roll.
 */
export class HeroDie {
  /**
   * Creates a HeroDie instance
   * @param {number} result - The numeric result of the die roll
   * @param {number} index - The positional index of this die in the original roll
   */
  constructor(result, index) {
    if (typeof result !== 'number' || isNaN(result)) {
      throw new Error(`Invalid die result: ${result}. Must be a number.`);
    }

    if (typeof index !== 'number' || index < 0) {
      throw new Error(`Invalid die index: ${index}. Must be non-negative integer.`);
    }

    /**
     * The numeric result of the heroic die roll
     * @type {number}
     */
    this.result = result;

    /**
     * The positional index of this die in the original roll
     * @type {number}
     */
    this.index = index;
  }

  /**
   * Creates a string representation of the heroic die
   * @returns {string} The die in notation format (e.g., "HeroDie[3]@0")
   */
  toString() {
    return `HeroDie[${this.result}]@${this.index}`;
  }

  /**
   * Compares this heroic die to another for sorting purposes
   * @param {HeroDie} other - Another HeroDie instance to compare with
   * @returns {number} Negative if this < other, positive if this > other, 0 if equal
   */
  compareTo(other) {
    return this.result - other.result;
  }
}

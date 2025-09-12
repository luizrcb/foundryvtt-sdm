/**
 * Represents a die that can explode and be modified by heroic dice allocations.
 * Tracks original results, heroic modifications, and new explosions.
 */
export class ExplosiveDie {
  /**
   * Creates an ExplosiveDie instance
   * @param {Object} dieTerm - The original die term from Foundry Roll
   * @param {number} dieTerm.dieIndex - Index of the die in the roll
   * @param {Array}  dieTerm.results - Original roll results
   * @param {number} faces - Number of faces on the die
   * @param {boolean} [canExplode=true] - Whether the die can explode when max value is reached
   * @param {Object} [opts]
   * @param {'increase'|'decrease'} [opts.mode='increase'] - allocation mode (explosions only in 'increase')
   * @param {string|null} [opts.groupId=null] - pool roll group this die belongs to (for pool kh/kl)
   */
  constructor(dieTerm, faces, canExplode = true, opts = {}) {
    /**
     * Index of the die in the original roll
     * @type {number}
     */
    this.dieIndex = dieTerm.dieIndex;

    /**
     * Number of faces on the die
     * @type {number}
     */
    this.faces = faces;

    /**
     * Allocation mode (increase/decrease). Explosions only happen in increase mode.
     * @type {'increase'|'decrease'}
     */
    this.mode = opts.mode ?? 'increase';

    /**
     * Whether the die can explode when reaching max value
     * (disabled automatically if mode !== 'increase')
     * @type {boolean}
     */
    this.canExplode = (this.mode === 'increase') && !!canExplode;

    this.chainId = dieTerm.chainId ?? null;
    this.segmentIndex = dieTerm.segmentIndex ?? 0;
    this.isExplosionSegment = !!dieTerm.isExplosionSegment;

    /**
     * Optional group id (all dice from the same pool roll share the same id)
     * @type {string|null}
     */
    this.groupId = opts.groupId ?? null;

    /**
     * Original roll results before modifications
     * @type {Array<{result: number, exploded: boolean, active: boolean}>}
     */
    this.originalResults = dieTerm.results.map(r => ({
      result: r.result,
      exploded: r.exploded,
      active: r.active
    }));

    /**
     * Active results from the original roll
     * @type {Array<{result: number, exploded: boolean, active: boolean}>}
     */
    this.activeResults = this.originalResults.filter(r => r.active);

    /**
     * Last active value before heroic modifications
     * @type {number}
     */
    this.lastActiveValue =
      this.activeResults.length > 0 ? this.activeResults[this.activeResults.length - 1].result : 0;

    /**
     * Current modified value after heroic allocations
     * @type {number}
     */
    this.modifiedValue = this.lastActiveValue;

    /**
     * Heroic dice allocated to this die
     * @type {Array<{result: number, index: number}>}
     */
    this.heroicAllocated = [];

    /**
     * New explosions caused by heroic allocations
     * @type {number[]}
     */
    this.newExplosions = [];

    /**
     * When true (used in decrease mode for explosion segments), this die is removed (counts as 0).
     * @type {boolean}
     */
    this.removed = false;
  }

  /**
   * Gets the base value before heroic modifications
   * @returns {number} Last active value from original roll
   */
  getBaseValue() {
    return this.lastActiveValue;
  }

  /**
   * Calculates the total value of the die including:
   * - Original active results
   * - Heroic modifications
   * - New explosions
   * (If removed, returns 0.)
   * @returns {number} Total value of the die
   */
  getTotal() {
    if (this.removed) return 0;
    return this.modifiedValue + this.newExplosions.reduce((sum, val) => sum + val, 0);
  }

  /**
   * Applies heroic allocations already recorded on this die (modifiedValue/heroicAllocated),
   * potentially triggering explosions (only in increase mode when allowed).
   * @returns {Promise<ExplosiveDie>} Returns itself after modification
   */
  async applyHeroic() {
    // If we've already hit faces and have pending explosions handled, nothing to do
    if (this.modifiedValue === this.faces && this.newExplosions.length) return this;

    // Clamp overflows above faces before explosion processing
    if (this.modifiedValue > this.faces) {
      this.modifiedValue = this.faces;
    }

    // Only INCREASE mode with canExplode rolls further explosions
    if (this.canExplode) {
      while (this.modifiedValue >= this.faces) {
        // Lock at faces for this segment
        this.modifiedValue = this.faces;

        // Roll the explosion
        const explosionRoll = await new Roll(`1d${this.faces}`).evaluate();
        if (game.dice3d) await game.dice3d.showForRoll(explosionRoll);

        // Append explosion value to chain
        this.newExplosions.push(explosionRoll.total);

        // Stop if this explosion is not max again
        if (explosionRoll.total !== this.faces) break;
        // else loop to chain more explosions
      }
    }

    return this;
  }

  /**
   * Gets the full result chain including:
   * - Original results
   * - Modified value after heroics
   * - New explosions
   * @returns {number[]} Complete sequence of results
   */
  getResultChain() {
    return [
      ...this.originalResults.map(r => r.result),
      ...(this.heroicAllocated.length > 0 ? [this.modifiedValue] : []),
      ...this.newExplosions
    ];
  }
}

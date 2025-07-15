/**
 * Represents a die that can explode and be modified by heroic dice allocations.
 * Tracks original results, heroic modifications, and new explosions.
 */
export class ExplosiveDie {
  /**
   * Creates an ExplosiveDie instance
   * @param {Object} dieTerm - The original die term from Foundry Roll
   * @param {number} dieTerm.dieIndex - Index of the die in the roll
   * @param {Array} dieTerm.results - Original roll results
   * @param {number} faces - Number of faces on the die
   * @param {boolean} [canExplode=true] - Whether the die can explode when max value is reached
   */
  constructor(dieTerm, faces, canExplode = true) {
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
     * Whether the die can explode when reaching max value
     * @type {boolean}
     */
    this.canExplode = canExplode;

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
   * @returns {number} Total value of the die
   */
  getTotal() {
    return this.modifiedValue + this.newExplosions.reduce((sum, val) => sum + val, 0);
  }

  /**
   * Applies a heroic value to the die, potentially triggering explosions
   * @param {number} heroicValue - Value to add to the die
   * @returns {Promise<ExplosiveDie>} Returns itself after modification
   */
  async applyHeroic() {
    // 1. Aplicar o valor heroico diretamente ao dado
    if (this.modifiedValue === this.faces && this.newExplosions.length) return this;

    if (this.modifiedValue > this.faces) {
      this.modifiedValue = this.faces;
    }

    // 2. Verificar e processar explosões
    if (this.canExplode) {
      while (this.modifiedValue >= this.faces) {
        // Limitar ao valor máximo
        this.modifiedValue = this.faces;

        // Rolar a explosão
        const explosionRoll = await new Roll(`1d${this.faces}`).evaluate();
        if (game.dice3d) await game.dice3d.showForRoll(explosionRoll);

        // Adicionar o resultado da explosão
        this.newExplosions.push(explosionRoll.total);

        // Parar se não for outra explosão máxima
        if (explosionRoll.total !== this.faces) break;
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

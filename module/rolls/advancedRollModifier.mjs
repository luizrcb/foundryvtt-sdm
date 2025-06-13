export class AdvancedRollModifier {
  constructor(baseFormula, actor = null) {
    this.originalFormula = baseFormula;
    this.actor = actor;
    this.explode = false;
    this._parsedTerms = [];
  }

  static async create(baseFormula, actor) {
    try {
      foundry.dice.Roll.validate(baseFormula);
      const instance = new AdvancedRollModifier(baseFormula, actor);
      await instance._parseFormula();
      return instance;
    } catch (error) {
      console.error("Formula validation failed:", error);
      throw new Error(`Invalid roll formula: ${baseFormula} - ${error.message}`);
    }
  }

  setExplosion(explode) {
    this.explode = !!explode;
    return this;
  }

  async apply() {
    try {
      const modifiedRoll = new Roll(this._constructFormula(), this.actor?.system);
      this._applyExplosion(modifiedRoll);
      await modifiedRoll.evaluate();
      return modifiedRoll;
    } catch (error) {
      console.error("Roll modification failed:", error);
      throw error;
    }
  }

  async _parseFormula() {
    try {
      const roll = new Roll(this.originalFormula);
      await roll.evaluate();
      this._parsedTerms = roll.terms;
    } catch (error) {
      console.error("Formula parsing failed:", error);
      throw error;
    }
  }

  _constructFormula() {
    try {
      const formula = Roll.getFormula(this._parsedTerms);
      foundry.dice.Roll.validate(formula);
      return formula;
    } catch (error) {
      console.error("Formula construction failed:", error);
      throw error;
    }
  }

  _applyExplosion(roll) {
    if (!this.explode) return;

    for (const term of roll.terms) {
      if (term instanceof foundry.dice.terms.Die && !term.modifiers.includes('x')) {
        term.modifiers.push('x');
        term.modifiers.push(`${term.faces}`); // xN syntax for max face explosion
      }
    }
  }

  static async resolveStatReferences(formula, actor) {
    try {
      foundry.dice.Roll.validate(formula);
      const statPattern = /@([a-zA-Z0-9_.]+)/g;
      const stats = [];

      const resolvedFormula = formula.replace(statPattern, (match, path) => {
        stats.push(path);
        return `{${stats.length - 1}}`;
      });

      const resolvedStats = await Promise.all(
        stats.map(path => this._getActorProperty(actor, path))
      );

      const finalFormula = resolvedFormula.replace(/{(\d+)}/g, (_, index) => {
        return resolvedStats[index] ?? 0;
      });

      foundry.dice.Roll.validate(finalFormula);
      return finalFormula;
    } catch (error) {
      console.error("Stat resolution failed:", error);
      throw error;
    }
  }

  static _getActorProperty(actor, path) {
    if (!actor) return 0;

    try {
      const value = path.split('.')
        .reduce((obj, key) => obj?.[key] ?? 0, actor.system);

      return Number.isFinite(value) ? parseInt(value) : 0;
    } catch (error) {
      console.warn(`Property path '${path}' resolution failed:`, error);
      return 0;
    }
  }
}
import { ActorType } from "../helpers/constants.mjs";

export class SdmCombatant extends Combatant {
  /** @override */
  _getInitiativeFormula() {
    const actor = this.actor;

    // Use specific initiative formula if defined
    if (actor.system.initiative) {
      const formula = actor.system.initiative;
      return formula;
    }

    // Fallback to global config
    return super._getInitiativeFormula();
  }

}

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

    if (actor.type === ActorType.NPC) {
      const npcFormula = '2d6 + @bonus'
      return npcFormula;
    }

    // Fallback to global config
    return super._getInitiativeFormula();
  }

}

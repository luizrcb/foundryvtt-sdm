import { ActorType } from '../helpers/constants.mjs';
import { NPC_DEFAULT_INITIATIVE } from '../settings.mjs';

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
      const npcFormula = game.settings.get('sdm', 'npcInitiativeFormula') || NPC_DEFAULT_INITIATIVE;
      return npcFormula;
    }

    // Fallback to global config
    return super._getInitiativeFormula();
  }

  _preCreate(data, options, userId) {
    const actor = fromUuidSync('Actor.'+ data?.actorId);
    if (actor?.type === ActorType.CARAVAN) return false;
  }
}

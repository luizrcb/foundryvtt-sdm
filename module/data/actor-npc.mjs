import { npcBaseFields } from './npc-base-data.mjs';
import SdmActorBase from './base-actor.mjs';

const fields = foundry.data.fields;

export default class SdmNPC extends SdmActorBase {
  static LOCALIZATION_PREFIXES = [...super.LOCALIZATION_PREFIXES, 'SDM.Actor.NPC'];

  static defineSchema() {
    const baseActorSchema = super.defineSchema();

    return {
      ...baseActorSchema,
      ...npcBaseFields(),

      // npc wage
      cost: new fields.NumberField({
        required: false,
        nullable: true,
        integer: true,
        initial: 0
      }),

      //  supply =

      isWarrior: new fields.BooleanField({
        required: true,
        initial: false
      }),

      isHelper: new fields.BooleanField({
        required: true,
        initial: false
      }),

      isPorter: new fields.BooleanField({
        required: true,
        initial: false
      }),

      base_speed: new fields.NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0,
        choices: CONFIG.SDM.reverseSpeedValues
      })
    };
  }

  getRollData() {
    const data = {};

    data.level = this.level;
    data.life = this.life;
    data.defense = this.defense;
    data.bonus = this.bonus;
    data.damage = this.damage;

    return data;
  }
}

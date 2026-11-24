import { SLOTS_PER_SACK } from '../helpers/constants.mjs';
import SdmActorBase from './base-actor.mjs';
import { npcBaseFields } from './npc-base-data.mjs';

const fields = foundry.data.fields;

export default class SdmNPC extends SdmActorBase {
  static LOCALIZATION_PREFIXES = [...super.LOCALIZATION_PREFIXES, 'SDM.Actor.NPC'];
  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };

    const baseActorSchema = super.defineSchema();

    return {
      ...baseActorSchema,
      ...npcBaseFields(),

      // Bonuses from effects, the same keys as characters': added to the typed defense (mental and
      // social: the defense against those attacks). Defaults fill old NPCs: no migration.
      defense_bonus: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
      mental_defense_bonus: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
      social_defense_bonus: new fields.NumberField({ required: true, nullable: false, initial: 0 }),

      // Temporary life, as characters have it (consumables, Colonist's night, effects): taken before life
      temporary_life: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false }),
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
        max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
      }),

      // npc wage
      cost: new fields.StringField({
        required: false,
        nullable: true,
        blank: true,
        initial: ''
      }),

      supply: new fields.StringField({
        required: false,
        nullable: true,
        blank: true,
        initial: ''
      }),

      isWarrior: new fields.BooleanField({
        required: true,
        initial: false
      }),

      createdFromTable: new fields.StringField({
        required: false,
        initial: ''
      }),

      isHelper: new fields.BooleanField({
        required: true,
        initial: false
      }),

      isPorter: new fields.BooleanField({
        required: true,
        initial: false
      }),

      isPet: new fields.BooleanField({
        required: true,
        initial: false
      }),

      experience: new fields.StringField({ required: true, initial: '0' }),

      speed: new fields.NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0,
        choices: CONFIG.SDM.reverseSpeedValues
      }),

      burden_penalty: new fields.NumberField({
        ...requiredInteger,
        initial: 0,
        min: 0
      }),

      burden_penalty_bonus: new fields.NumberField({
        ...requiredInteger,
        initial: 0,
        min: 0
      })
    };
  }

  get item_slots() {
    return Math.trunc(this.capacity * SLOTS_PER_SACK);
  }

  get trait_slots() {
    return game.settings.get('sdm', 'baseTraitSlots');
  }

  getRollData() {
    const data = {};

    data.bonus = this.bonus;
    data.burden_penalty = this.burden_penalty || 0;
    data.burden_penalty_bonus = this.burden_penalty_bonus;
    data.damage = this.damage;
    data.defense = this.defense;
    data.level = this.level;
    data.life = this.life;
    data.system = this;

    return data;
  }
}

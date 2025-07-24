import SdmActorBase from './base-actor.mjs';

export default class SdmNPC extends SdmActorBase {
  static LOCALIZATION_PREFIXES = [...super.LOCALIZATION_PREFIXES, 'SDM.Actor.NPC'];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.initiative = new fields.StringField({
      required: true,
      initial: '',
      validate: v => foundry.dice.Roll.validate(v),
      validationError: game.i18n.localize('SDM.ErrorValidationRollFormula')
    });

    schema.level = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0
    });

    schema.life = new fields.SchemaField({
      value: new fields.NumberField({
        ...requiredInteger,
        initial: 1,
        min: 0
      }),
      max: new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 })
    });

    schema.morale = new fields.NumberField({ ...requiredInteger, initial: 2, min: 2 });

    schema.defense = new fields.NumberField({ ...requiredInteger, initial: 7, min: 1 });

    schema.bonus = new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 });

    schema.damage = new fields.StringField({
      required: true,
      initial: '1d4',
      validate: v => foundry.dice.Roll.validate(v),
      validationError: game.i18n.localize('SDM.ErrorValidationRollFormula')
    });

    // npc wage
    schema.cost = new fields.NumberField({
      required: false,
      nullable: true,
      integer: true,
      initial: 0
    });

    // schema.supply =

    schema.isWarrior = new fields.BooleanField({
      required: true,
      initial: false
    });

    schema.isHelper = new fields.BooleanField({
      required: true,
      initial: false
    });

    schema.isPorter = new fields.BooleanField({
      required: true,
      initial: false
    });

    schema.speed = new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
      choices: CONFIG.SDM.reverseSpeedValues
    });

    return schema;
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

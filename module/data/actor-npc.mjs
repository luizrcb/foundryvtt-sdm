import SdmActorBase from './base-actor.mjs';

export default class SdmNPC extends SdmActorBase {
  static LOCALIZATION_PREFIXES = [
    ...super.LOCALIZATION_PREFIXES,
    'SDM.Actor.NPC',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.initiative = new fields.StringField({
      required: true, initial: '2d6kl',
      validate: v => foundry.dice.Roll.validate(v),
      validationError: "must be a valid Roll formula",
    });

    schema.level = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    });

    schema.life = new fields.SchemaField({
      value: new fields.NumberField({
        ...requiredInteger,
        initial: 1,
        min: 0,
      }),
      max: new fields.NumberField({ ...requiredInteger, initial: 4, min: 4 }),
    });

    schema.morale = new fields.NumberField({...requiredInteger, initial: 2, min: 2 });

    schema.defense = new fields.NumberField({...requiredInteger, initial: 7, min: 1 });

    schema.bonus = new fields.NumberField({...requiredInteger, initial: 1, min: 0 });

    schema.damage = new fields.StringField({
      required: true, initial: '1d4',
      validate: v => foundry.dice.Roll.validate(v),
      validationError: "must be a valid Roll formula",
    });

    schema.cost = new fields.StringField({ required: false, nullable: true });

    schema.isWarrior = new fields.BooleanField({
      required: true, initial: false,
    });

    schema.isHelper = new fields.BooleanField({
      required: true, initial: false,
    });

    schema.isPorter = new fields.BooleanField({
      required: true, initial: false,
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

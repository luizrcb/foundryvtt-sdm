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
 
    schema.level = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    });

    schema.target = new fields.NumberField({...requiredInteger, initial: 10, min: 10 });

    schema.life = new fields.SchemaField({
      value: new fields.NumberField({
        ...requiredInteger,
        initial: 4,
        min: 0,
      }),
      max: new fields.NumberField({ ...requiredInteger, initial: 4, min: 4 }),
    });

    schema.initiative = new fields.StringField({
      required: true, initial: '1d6',
      validate: v => foundry.dice.Roll.validate(v),
      validationError: "must be a valid Roll formula",
    });

    schema.bonus = new fields.SchemaField({
      major: new fields.NumberField({
        ...requiredInteger,
        initial: 2,
        min: 2,
      }),
      minor: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });

    schema.damage = new fields.StringField({
      required: true, initial: '1d4',
      validate: v => foundry.dice.Roll.validate(v),
      validationError: "must be a valid Roll formula",
    });

    schema.cost = new fields.StringField({ required: false, nullable: true });

    schema.skills = new fields.ArrayField(
      new fields.StringField({ required: true, blank: false }),
      { required: false, initial: [] },
    );

    schema.isWarrior = new fields.BooleanField({
      required: true, initial: true,
    });

    schema.isHelper = new fields.BooleanField({
      required: true, initial: false,
    });

    schema.isPorter = new fields.BooleanField({
      required: true, initial: false,
    });

    return schema;
  }

  prepareDerivedData() {
  }
}

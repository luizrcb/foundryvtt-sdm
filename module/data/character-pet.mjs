export default class CharacterPetModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    return {
      name: new fields.StringField({ required: true, blank: false }),
      defense: new fields.NumberField({
        ...requiredInteger,
        initial: 10,
        min: 10
      }),
      experience: new fields.StringField({ required: true, initial: '0' }),
      bonus: new fields.SchemaField({
        major: new fields.NumberField({
          ...requiredInteger,
          initial: 2,
          min: 2
        }),
        minor: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
      }),
      level: new fields.NumberField({
        ...requiredInteger,
        initial: 0,
        min: 0
      }),
      life: new fields.SchemaField({
        value: new fields.NumberField({
          ...requiredInteger,
          initial: 4,
          min: 0
        }),
        max: new fields.NumberField({ ...requiredInteger, initial: 4, min: 4 })
      }),
      ability: new fields.StringField({ required: false, blank: true }),

      damage: new fields.StringField({
        required: true,
        initial: '1d4',
        validate: v => foundry.dice.Roll.validate(v),
        validationError: game.i18n.localize('SDM.ErrorValidationRollFormula')
      }),

      features: new fields.HTMLField()
    };
  }
}

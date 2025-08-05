const fields = foundry.data.fields;

const requiredInteger = { required: true, nullable: false, integer: true };

export function attributeFields() {
   return {
      initiative: new fields.StringField({
        required: true,
        initial: '',
        validate: v => foundry.dice.Roll.validate(v),
        validationError: game.i18n.localize('SDM.ErrorValidationRollFormula')
      }),

      level: new fields.NumberField({
        ...requiredInteger,
        initial: 0,
        min: 0
      }),

      life: new fields.SchemaField({
        value: new fields.NumberField({
          ...requiredInteger,
          initial: 1,
          min: 0
        }),
        max: new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 })
      }),

      morale: new fields.NumberField({ ...requiredInteger, initial: 2, min: 0 }),

      defense: new fields.NumberField({ ...requiredInteger, initial: 7, min: 1 }),

      bonus: new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 }),

      damage: new fields.StringField({
        required: true,
        initial: '1d4',
        validate: v => foundry.dice.Roll.validate(v),
        validationError: game.i18n.localize('SDM.ErrorValidationRollFormula')
      })
  };
}

export default class AttributesDataModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...attributeFields(),
    };
  }
}

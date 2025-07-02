export default class PowerDataModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      level: new fields.NumberField({ required: true, initial: 1, min: 1 }),
      range: new fields.StringField({ required: true, blank: true, initial: '' }),
      target: new fields.StringField({ required: true, blank: true, initial: '' }),
      duration: new fields.StringField({ required: true, blank: true, initial: '' }),
      overcharge: new fields.StringField({ required: false, blank: true, initial: '' }),
      roll_formula: new fields.StringField({
        required: false, blank: true, initial: '',
        validate: v => !v || v && foundry.dice.Roll.validate(v),
        validationError: game.i18n.localize("SDM.ErrorValidationRollFormula"),
      }),
    };
  }
}

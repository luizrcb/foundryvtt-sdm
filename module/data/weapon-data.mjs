import { RangeOption } from "../helpers/constants.mjs";

export default class WeaponDataModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      damage: new fields.SchemaField({
        base: new fields.StringField({
          required: false, blank: true, initial: '1d4',
          validate: v => !v || v && foundry.dice.Roll.validate(v),
          validationError: game.i18n.localize("SDM.ErrorValidationRollFormula"),
        }),
        versatile: new fields.StringField({
          required: false, blank: true, initial: '1d4',
          validate: v => !v || v && foundry.dice.Roll.validate(v),
          validationError: game.i18n.localize("SDM.ErrorValidationRollFormula"),
        }),
        bonus: new fields.StringField({
          required: false, blank: true, initial: '',
          validate: v => !v || v && foundry.dice.Roll.validate(v),
          validationError: game.i18n.localize("SDM.ErrorValidationRollFormula"),
        }),
      }),

      range: new fields.StringField({
        required: false, blank: true, initial: '', choices:
          Object.values(RangeOption).reduce((acc, key) => {
            acc[key] = game.i18n.localize(`SDM.Item.Range.${key}`);
            return acc;
          }, {}),
      }),

      versatile: new fields.BooleanField({ required: true, initial: false }),
    }
  }
}

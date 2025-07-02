import { ArmorType } from "../helpers/constants.mjs";

export default class ArmorDataModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      value: new fields.NumberField({
        required: true, integer: true, min: 0, initial: 0,
      }),

      type: new fields.StringField({
        require: false, blank: true, initial: '', choices:
          Object.values(ArmorType).reduce((acc, key) => {
            acc[key] = game.i18n.localize(`SDM.Item.Armor.Type.${key}`);
            return acc;
          }, {}),
      }),

      cumbersome: new fields.BooleanField({ initial: false }),

      powered: new fields.SchemaField({
        max_charges: new fields.NumberField({
          required: false, integer: true, min: 0,
        }),
        remaining_charges: new fields.NumberField({
          required: false, integer: true, min: 0,
        }),
      }, { required: false, nullable: true, initial: null }),

    }
  }
}

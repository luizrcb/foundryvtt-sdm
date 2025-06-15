import SdmItemBase from './base-item.mjs';
import { ArmorType } from '../helpers/constants.mjs'

export default class SdmArmor extends SdmItemBase {
  static LOCALIZATION_PREFIXES = [
    'SDM.Item.base',
    'SDM.Item.Armor',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.readied = new fields.BooleanField({ initial: false });

    schema.armor = new fields.NumberField({
      ...requiredInteger,
      initial: 1,
      min: 0,
    });

    schema.type = new fields.StringField({
      require: true, initial: ArmorType.LIGHT, choices:
        Object.values(ArmorType).reduce((acc, key) => {
          acc[key] = game.i18n.localize(`SDM.Item.Armor.Type.${key}`);
          return acc;
        }, {}),
    });

    schema.cumbersome = new fields.BooleanField({ initial: false });

    schema.powered = new fields.SchemaField({
      max_charges: new fields.NumberField({
        required: false, integer: true, min: 0,
      }),
      remaining_charges: new fields.NumberField({
        required: false, integer: true, min: 0,
      }),
    }, { required: false, nullable: true, initial: null });

    return schema;
  }
}

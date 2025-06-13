import SdmItemBase from './base-item.mjs';
import ItemSizeDataModel from './item-size.mjs';
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

    schema.equipped = new fields.BooleanField({ initial: true });

    schema.size = new fields.EmbeddedDataField(ItemSizeDataModel);

    schema.cumbersome = new fields.BooleanField({ initial: false });

    schema.powered = new fields.SchemaField({
      maxCharges: new fields.NumberField({
        required: false, integer: true, min: 0,
      }),
      remainingCharges: new fields.NumberField({
        required: false, integer: true, min: 0,
      }),
    }, { required: false, nullable: true, initial: null });

    return schema;
  }
}

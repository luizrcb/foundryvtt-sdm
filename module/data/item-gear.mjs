import SdmItemBase from './base-item.mjs';
import { getDefaultAbility } from '../helpers/globalUtils.mjs'
import PowerDataModel from './power-data.mjs';
import ArmorDataModel from './armor-data.mjs';
import WeaponDataModel from './weapon-data.mjs';


export default class SdmGear extends SdmItemBase {
  static LOCALIZATION_PREFIXES = [
    'SDM.Item.base',
    'SDM.Item.Gear',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    schema.default_ability = getDefaultAbility();

    schema.type = new fields.StringField({
      required: false, blank: true, initial: '',
      choices: Object.entries(CONFIG.SDM.gearType).reduce((acc, [key, value]) => {
        acc[key] = game.i18n.localize(value);
        return acc;
      }, {}),
    });

    schema.power = new fields.EmbeddedDataField(PowerDataModel);

    schema.powers = new fields.ArrayField(
      new fields.EmbeddedDataField(PowerDataModel),
    );

    schema.armor = new fields.EmbeddedDataField(ArmorDataModel);

    schema.weapon = new fields.EmbeddedDataField(WeaponDataModel);

    return schema;
  }
}

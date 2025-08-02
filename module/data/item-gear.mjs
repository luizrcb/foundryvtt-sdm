import SdmItemBase from './base-item.mjs';
import { getDefaultAbility } from '../helpers/globalUtils.mjs';
import PowerDataModel from './power-data.mjs';
import ArmorDataModel from './armor-data.mjs';
import WardDataModel from './ward_data.mjs';
import WeaponDataModel from './weapon-data.mjs';

export default class SdmGear extends SdmItemBase {
  static LOCALIZATION_PREFIXES = ['SDM.Item.base', 'SDM.Item.Gear'];

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    schema.default_ability = getDefaultAbility();

    schema.type = new fields.StringField({
      required: false,
      blank: true,
      initial: '',
      choices: Object.entries({
        ...CONFIG.SDM.gearType,
        '': 'TYPE.Gear',
      }).reduce((acc, [key, value]) => {
        acc[key] = game.i18n.localize(value);
        return acc;
      }, {})
    });

    schema.power = new fields.EmbeddedDataField(PowerDataModel);
    schema.powers_current_index = new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0});

    schema.max_powers = new fields.NumberField({ required: true, nullable: false, integer: true, initial: 3, min: 0 });

    schema.powers = new fields.ArrayField(new fields.EmbeddedDataField(PowerDataModel));

    schema.armor = new fields.EmbeddedDataField(ArmorDataModel);

    schema.ward = new fields.EmbeddedDataField(WardDataModel);

    schema.weapon = new fields.EmbeddedDataField(WeaponDataModel);

    return schema;
  }
}

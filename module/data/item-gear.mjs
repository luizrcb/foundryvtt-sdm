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
        '': 'TYPE.Gear'
      }).reduce((acc, [key, value]) => {
        acc[key] = game.i18n.localize(value);
        return acc;
      }, {})
    });

    schema.starting_kit = new fields.BooleanField({ required: true, initial: false });

    schema.is_supply = new fields.BooleanField({ required: true, initial: false });
    schema.supply_type = new fields.StringField({
      required: true,
      blank: true,
      initial: 'human',
      choices: CONFIG.SDM.SupplyType
    });

    schema.packed_remaining_items = new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 10,
      min: 0
    });

    schema.power = new fields.EmbeddedDataField(PowerDataModel);
    schema.powers_current_index = new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
      min: 0
    });

    schema.max_powers = new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 3,
      min: 0
    });

    schema.powers = new fields.ArrayField(new fields.EmbeddedDataField(PowerDataModel));

    schema.armor = new fields.EmbeddedDataField(ArmorDataModel);

    schema.ward = new fields.EmbeddedDataField(WardDataModel);

    schema.weapon = new fields.EmbeddedDataField(WeaponDataModel);

    schema.cure_steps = new fields.SchemaField({
      completed: new fields.NumberField({
        required: true,
        initial: 0,
        min: 0,
      }),
      required: new fields.NumberField({
        required: true,
        initial: 0,
        min: 0,
      }),
    }, { nullable: false });

    return schema;
  }

  static migrateData(source) {
    this._migrateData(source);
    return super.migrateData(source);
  }

  /** @inheritDoc */
  static _migrateData(source) {
    SdmGear.#migrateRange(source);
    SdmGear.#migrateFeatures(source);
  }

  /**
   * Migrate weapon range
   * @param {object} source  The candidate source data from which the model will be constructed.
   */
  static #migrateRange(source) {
    if (!source.weapon) return;

    if (source.weapon.range === 'melee') source.weapon.range = 'close';
    if (source.weapon.range === 'long') source.weapon.range = 'medium';
    if (source.weapon.range === 'extreme') source.weapon.range = 'long';
  }

  static #migrateFeatures(source) {
    if (typeof source.features === 'string') {
      source.features = [];
    }

    if (source.features && source.features.length) {
      source.features = [...source.features].filter(f => f && f.trim() !== '').sort();
    }

    return;
  }
}

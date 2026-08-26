import { ArmorType, RangeOption, WardType } from '../helpers/constants.mjs';
import { $l10n, capitalizeFirstLetter, getDefaultAbility } from '../helpers/globalUtils.mjs';
import ArmorDataModel from './armor-data.mjs';
import SdmItemBase from './base-item.mjs';
import PowerDataModel from './power-data.mjs';
import WardDataModel from './ward_data.mjs';
import WeaponDataModel from './weapon-data.mjs';

export default class SdmGear extends SdmItemBase {
  static LOCALIZATION_PREFIXES = ['SDM.Item.base', 'SDM.Item.Gear'];

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    schema.default_ability = getDefaultAbility();

    schema.container = new fields.DocumentUUIDField({
      required: true,
      blank: true,
      initial: ''
    });

    schema.capacity = new fields.SchemaField(
      {
        max: new fields.NumberField({
          required: true,
          initial: 1,
          min: 1,
          max: 10
        })
      },
      { nullable: false }
    );

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
      initial: '',
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

    schema.cure_steps = new fields.SchemaField(
      {
        completed: new fields.NumberField({
          required: true,
          initial: 0,
          min: 0
        }),
        required: new fields.NumberField({
          required: true,
          initial: 0,
          min: 0,
          max: 20
        })
      },
      { nullable: false }
    );

    schema.pet = new fields.DocumentUUIDField({ required: true, blank: true, initial: '' });

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
    if (source.weapon.range === 'extreme') source.weapon.range = 'long';
  }

  static #migrateFeatures(source) {
    if (typeof source.features === 'string') {
      source.features = [];
    }

    if (source.features && source.features.length) {
      source.features = [...source.features].filter(f => f && f.trim() !== '').sort();
    }
  }

  static get compendiumBrowserFilters() {
    const filters = new Map();
    SdmItemBase.addCommonFilters(filters);

    filters.set('subtype', {
      label: 'SDM.FILTERS.Subtype',
      type: 'set',
      config: {
        keyPath: 'system.type',
        sort: false,
        blank: true,
        choices: CONFIG.SDM.gearType
      }
    });

    filters.set('powerLevel', {
      label: 'SDM.FILTERS.PowerLevel',
      type: 'range',
      config: {
        keyPath: 'system.power.level',
        min: 0
      }
    });

    filters.set('powerDangerous', {
      label: 'SDM.FILTERS.PowerDangerous',
      type: 'boolean',
      config: { keyPath: 'system.power.is_dangerous' }
    });

    filters.set('armorValue', {
      label: 'SDM.FILTERS.ArmorValue',
      type: 'range',
      config: {
        keyPath: 'system.armor.value',
        min: 0
      }
    });

    const armorChoices =
      Object.values(ArmorType).reduce((acc, key) => {
        acc[key] = $l10n(`SDM.ArmorType${capitalizeFirstLetter(key)}`);
        return acc;
      }, {});

    filters.set('armorType', {
      label: 'SDM.FILTERS.ArmorType',
      type: 'set',
      config: {
        keyPath: 'system.armor.type',
        sort: false,
        choices: armorChoices
      }
    });

    filters.set('wardValue', {
      label: 'SDM.FILTERS.WardValue',
      type: 'range',
      config: {
        keyPath: 'system.ward.value',
        min: 0
      }
    });

    const wardChoices =
      Object.values(WardType).reduce((acc, key) => {
        acc[key] = game.i18n.localize(`SDM.WardType${capitalizeFirstLetter(key)}`);
        return acc;
      }, {});
    filters.set('wardType', {
      label: 'SDM.FILTERS.WardType',
      type: 'set',
      config: {
        keyPath: 'system.ward.type',
        sort: false,
        choices: wardChoices
      }
    });

    const rangeChoices =
      CONFIG.SDM.rangeOptions ??
      Object.values(RangeOption).reduce((acc, key) => {
        acc[key] = game.i18n.localize(`SDM.Range${capitalizeFirstLetter(key)}`);
        return acc;
      }, {});
    filters.set('weaponRange', {
      label: 'SDM.FILTERS.WeaponRange',
      type: 'set',
      config: {
        keyPath: 'system.weapon.range',
        sort: false,
        choices: rangeChoices
      }
    });

    return filters;
  }
}

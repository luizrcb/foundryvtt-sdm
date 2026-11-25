import { ArmorType, RangeOption, WardType } from '../helpers/constants.mjs';
import { $l10n, capitalizeFirstLetter, getDefaultAbility } from '../helpers/globalUtils.mjs';
import ArmorDataModel from './armor-data.mjs';
import SdmItemBase from './base-item.mjs';
import PowerDataModel from './power-data.mjs';
import { defineLightField } from './light-field.mjs';
import { defineTriggerSchema, defineTriggersField } from './triggers-field.mjs';
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

    // Roll triggers shown on chat cards ("Stuns on natural 13"), with optional actions
    schema.triggers = defineTriggersField();

    // Pay to boost the damage (Piezo Mace: spend 1d6 life for x2). Mandatory: paid on every damage roll.
    schema.boost = new fields.SchemaField({
      enabled: new fields.BooleanField({ initial: false }),
      resource: new fields.StringField({
        required: true,
        blank: false,
        initial: 'life',
        choices: ['life', 'str', 'end', 'agi', 'cha', 'aur', 'tho', 'hero_die']
      }),
      cost: new fields.StringField({ required: true, blank: true, initial: '' }),
      // 1 (or 0) = no multiplier: neutral until the GM sets one
      multiplier: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 1, min: 0 }),
      extra: new fields.StringField({ required: true, blank: true, initial: '' }),
      // The damage becomes this formula instead of the weapon's (Swagger Stick: 1d4 → 1d12)
      damage: new fields.StringField({ required: true, blank: true, initial: '' }),
      // When it applies, shown with the option ("vs vampires")
      note: new fields.StringField({ required: true, blank: true, initial: '' }),
      mandatory: new fields.BooleanField({ initial: false })
    });

    // Conditions its bearer can't get while it is readied (nasal filters: nausea)
    schema.immunities = new fields.ArrayField(new fields.StringField({ blank: false }), { initial: [] });
    // Damage multiplied against a target with these conditions (Stabber: ×2 against surprised)
    schema.damage_vs = new fields.SchemaField({
      statuses: new fields.ArrayField(new fields.StringField({ blank: false }), { initial: [] }),
      multiplier: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 2, min: 1 })
    });

    // Consumables (feature "consumable"): what "Use" restores (formulas) on its targets;
    // its effects are copied onto them (and do not apply while it is only carried)
    schema.use = new fields.SchemaField({
      life: new fields.StringField({ required: true, blank: true, initial: '' }),
      ability: new fields.StringField({ required: true, blank: true, initial: '' }),
      // Which abilities it can restore: any, only physical (str/end/agi) or only mental (cha/aur/tho)
      ability_group: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'physical', 'mental'] }),
      // Temporary life it grants (Red Juice +1d8)
      temp_life: new fields.StringField({ required: true, blank: true, initial: '' }),
      // Life it costs the user (Kaffetropist: lose 1d3 life throwing up), every time
      harm: new fields.StringField({ required: true, blank: true, initial: '' }),
      // Conditions it removes from its targets, every time (a bandage stops bleeding, an antidote cures poison)
      cures: new fields.ArrayField(new fields.StringField({ blank: false }), { initial: [] }),
      // Every use is a rest for its targets (Red Nutrislurry): the rest dialog opens for each one
      rest: new fields.BooleanField({ required: true, initial: false }),
      // More of what Use does: the trigger actions (a condition, light, cast, counters, charges…), on
      // the Use's targets, every time
      actions: defineTriggerSchema(),
      // Who it is meant for (machines, pack animals…): a reminder in the Use dialog, not checked
      for: new fields.StringField({ required: true, blank: true, initial: '' }),
      // Purges the targets of other consumables: the effects they copied are removed
      purge: new fields.BooleanField({ required: true, initial: false }),
      // Not used up: Use spends only what it costs (Harm, a usage roll, charges or uses it has), never
      // the item itself (Field Glove)
      keep: new fields.BooleanField({ required: true, initial: false }),
      // On the user only (a glove, a stimulant): its targets are the user, whoever is targeted
      self: new fields.BooleanField({ required: true, initial: false }),
      // A single-use replenisher: Use recharges one item that is running low or run out, picked then,
      // of a kind (any; small: 1 stone or less; a weapon; a machine)
      replenishes: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'any', 'small', 'weapon', 'machine'] }),
      // Overdose: after `after` doses within the period, each dose asks for a save against a condition
      // (or one of the item's effects); escalating, the difficulty goes up one step per dose
      overdose: new fields.SchemaField({
        status: new fields.StringField({ required: true, blank: true, initial: '' }),
        effect: new fields.StringField({ required: true, blank: true, initial: '' }),
        after: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 1, min: 0 }),
        period: new fields.StringField({ required: true, blank: true, initial: 'days', choices: ['', 'days', 'weeks'] }),
        ability: new fields.StringField({ required: true, blank: true, initial: '' }),
        difficulty: new fields.StringField({ required: true, blank: true, initial: 'easy', choices: ['', 'veryEasy', 'easy', 'hard', 'veryHard'] }),
        escalate: new fields.BooleanField({ required: true, initial: true })
      }),
      // A roll table drawn every time it is used (strange beliefs, vision dreams…)
      table: new fields.StringField({ required: true, blank: true, initial: '' }),
      // How long its effects last on the targets (when the effect sets no duration of its own)
      duration: new fields.SchemaField({
        value: new fields.NumberField({ required: true, nullable: true, integer: true, initial: null, min: 0 }),
        units: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'rounds', 'minutes', 'hours', 'days', 'weeks'] })
      })
    });
    // Token light (light category or glowing feature): a preset, or custom radii in grid squares
    schema.light = defineLightField();
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

  /**
   * Gear without an album holds no powers: its power limit only counts with the album feature
   * (so a mod adding the feature and +1 power, like Projector, gives exactly that).
   */
  prepareBaseData() {
    super.prepareBaseData?.();
    if (this.type !== 'power_album' && !this.features?.has?.('album')) this.max_powers = 0;
  }

  static migrateData(source) {
    this._migrateData(source);
    return super.migrateData(source);
  }

  /** @inheritDoc */
  static _migrateData(source) {
    SdmGear.#migrateRange(source);
    SdmGear.#migrateConsumable(source);
    SdmGear.#migrateFeatures(source);
  }

  /** "Usable" used to be a checkbox: it is the consumable feature now. */
  static #migrateConsumable(source) {
    if (!source.use || source.use.enabled === undefined) return;
    if (source.use.enabled) {
      const features = Array.isArray(source.features) ? source.features : [];
      if (!features.includes('consumable')) source.features = [...features, 'consumable'];
    }
    delete source.use.enabled;
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

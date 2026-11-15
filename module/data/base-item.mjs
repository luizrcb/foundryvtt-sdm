import { GearType } from '../helpers/constants.mjs';
import { defineCountersField } from './counters-field.mjs';
import { $l10n } from '../helpers/globalUtils.mjs';
import { getSlotsTaken } from '../helpers/itemUtils.mjs';
import HallmarkBaseDataModel from './hallmark-base-data.mjs';
import ItemSizeDataModel from './item-size.mjs';
import NPCBaseDataModel from './npc-base-data.mjs';

export default class SdmItemBase extends foundry.abstract.TypeDataModel {
  /** @inheritDoc */
  static migrateData(source) {
    // Animation damage source: the automatic option used to be stored as a blank string
    if (source?.animation && !source.animation.damageSource) source.animation.damageSource = 'auto';
    // Triggers: "reaches its maximum" merged into "is full"
    if (Array.isArray(source?.triggers)) {
      for (const trigger of source.triggers) {
        if (!trigger) continue;
        if (trigger.condition === 'counterMax') trigger.condition = 'full';
        // Numbers became formulas (counter references)
        for (const key of ['value', 'counter_step', 'charges_amount']) {
          if (typeof trigger[key] === 'number') trigger[key] = String(trigger[key]);
        }
      }
    }
    return super.migrateData(source);
  }

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = {};
    // also known as equipped
    schema.readied = new fields.BooleanField({ initial: false });

    schema.categories = new fields.SetField(
      new fields.StringField({ required: true, blank: false, nullable: false })
    );

    schema.status = new fields.StringField({
      required: false,
      nullable: true,
      blank: true,
      initial: '',
      choices: CONFIG.SDM.itemStatus
    });

    schema.resources = new fields.StringField({
      required: false,
      nullable: true,
      blank: true,
      initial: '',
      choices: CONFIG.SDM.itemResources
    });

    // Counters the item keeps (kills, skulls, hits…), keyed by a slug of their name; effects read
    // them as @item.counters.<key>.value. Separate from charges (ammunition, battery, uses).
    schema.counters = defineCountersField();

    // Uses kept in one of the counters instead of charges (uses left, or uses spent up to its max)
    schema.uses = new fields.SchemaField({
      counter: new fields.StringField({ required: true, blank: true, initial: '' }),
      mode: new fields.StringField({ required: true, blank: false, initial: 'left', choices: ['left', 'spent'] })
    });

    // The item can still make its damage roll while run out (it is still a plain weapon)
    schema.works_when_run_out = new fields.BooleanField({ required: true, initial: false });

    schema.charges = new fields.SchemaField({
      value: new fields.NumberField({
        required: true,
        nullable: false,
        initial: 0,
        min: 0
      }),
      max: new fields.NumberField({ requied: true, nullable: false, initial: 0, min: 0 })
    });

    schema.replenish = new fields.SchemaField({
      value: new fields.NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0,
        min: 0
      }),
      // Attacks with the item make the usage roll (off: replenish is spent only by Use, lighting…)
      on_attack: new fields.BooleanField({ required: true, initial: true })
    });

    schema.area = new fields.SchemaField({
      value: new fields.StringField({
        required: false,
        blank: true,
        nullable: true,
        initial: ''
      })
    });

    schema.range = new fields.SchemaField({
      value: new fields.StringField({
        required: false,
        blank: true,
        nullable: true,
        initial: ''
      })
    });

    schema.flare = new fields.SchemaField({
      value: new fields.NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0,
        min: 0
      })
    });

    schema.pocket = new fields.SchemaField({
      value: new fields.NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0,
        min: 0
      })
    });

    schema.draining = new fields.SchemaField({
      value: new fields.NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0,
        min: 0
      })
    });

    schema.resistant = new fields.SchemaField({
      value: new fields.StringField({
        required: true,
        nullable: false,
        initial: ''
      })
    });

    schema.cost = new fields.NumberField({
      required: false,
      nullable: true,
      integer: true,
      initial: 0
    });

    schema.cost_frequency = new fields.StringField({
      required: false,
      nullable: true,
      blank: true,
      initial: '',
      choices: CONFIG.SDM.frequency
    });

    schema.description = new fields.HTMLField();

    // Notes only shown to GMs on the item sheet
    schema.gm_notes = new fields.HTMLField();

    schema.quantity = new fields.NumberField({
      required: true,
      integer: true,
      initial: 1,
      min: 0
    });

    schema.slots_override = new fields.NumberField({
      required: false,
      initial: undefined
    });

    schema.size = new fields.EmbeddedDataField(ItemSizeDataModel);

    schema.features = new fields.SetField(
      new fields.StringField({ required: true, blank: false, nullable: false }),
      {
        min: 0
      }
    );

    schema.attributes = new fields.EmbeddedDataField(NPCBaseDataModel);

    // Animated items (feature "animated"): the NPC that represents the item when it comes to life
    schema.animation = new fields.SchemaField({
      table: new fields.StringField({ required: true, blank: true, initial: '' }),
      mode: new fields.StringField({
        required: true,
        initial: 'energy',
        choices: { energy: 'SDM.Animation.ModeEnergy', walks: 'SDM.Animation.ModeWalks' }
      }),
      actor: new fields.StringField({ required: true, blank: true, initial: '' }),
      active: new fields.BooleanField({ required: true, initial: false }),
      // Turn back into the item when the combat it fights in ends
      endWithCombat: new fields.BooleanField({ required: true, initial: false }),
      // Charges spent each time the item is animated (0: animating is free)
      chargeCost: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0 }),
      // Items with replenish: each animation is a use (usage roll; running low: last use)
      usageRoll: new fields.BooleanField({ required: true, initial: false }),
      // The creature's own size (weight) and speed
      size: new fields.SchemaField({
        value: new fields.NumberField({ required: true, initial: 1, min: 0 }),
        unit: new fields.StringField({ required: true, initial: 'sacks' })
      }),
      speed: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
      // Weapons: where the creature's damage comes from ('' = automatic)
      damageSource: new fields.StringField({
        required: true,
        blank: false,
        initial: 'auto',
        choices: {
          auto: 'SDM.Animation.DamageAuto',
          weapon: 'SDM.Animation.DamageWeapon',
          creature: 'SDM.Animation.DamageCreature'
        }
      }),
      // false until the attributes are filled from the table or edited by the Referee
      filled: new fields.BooleanField({ required: true, initial: false })
    });

    schema.is_hallmark = new fields.BooleanField({
      required: true,
      initial: false
    });

    schema.hallmark = new fields.EmbeddedDataField(HallmarkBaseDataModel);

    return schema;
  }

  get container_taken() {
    const parent = this.parent?.parent;
    if (!parent) return 0;

    if (this.type !== GearType.CONTAINER) return 0;

    return parent.items
      .filter(i => i.type === 'gear' && i.system?.container === this.parent.uuid)
      .reduce((sum, i) => sum + getSlotsTaken(i.system, true), 0);
  }

  get slots_taken() {
    return getSlotsTaken(this);
  }

  /**
   * Compendium browser filters shared by mounts and vehicles.
   * @param {Map} filters
   * @param {object} [options]
   * @param {boolean} [options.automatic=false] add the vehicle-only "automatic" filter
   */
  static addTransportFilters(filters, { automatic = false } = {}) {
    filters.set('transportType', {
      label: 'SDM.FILTERS.TransportType',
      type: 'set',
      config: {
        keyPath: 'type',
        sort: false,
        choices: () => ({
          mount: $l10n('TYPES.Item.mount'),
          vehicle: $l10n('TYPES.Item.vehicle')
        })
      }
    });

    filters.set('transportLevel', {
      label: 'SDM.FILTERS.TransportLevel',
      type: 'range',
      config: { keyPath: 'system.level', min: 0 }
    });

    filters.set('transportCapacity', {
      label: 'SDM.FILTERS.TransportCapacity',
      type: 'range',
      config: { keyPath: 'system.capacity', min: 0 }
    });

    filters.set('transportSpeed', {
      label: 'SDM.FILTERS.TransportSpeed',
      type: 'range',
      config: { keyPath: 'system.speed' }
    });

    if (automatic) {
      filters.set('transportAutomatic', {
        label: 'SDM.FILTERS.TransportAutomatic',
        type: 'boolean',
        config: { keyPath: 'system.automatic' }
      });
    }
  }

  static addCommonFilters(filters) {
    filters.set('cost', {
      label: 'SDM.FILTERS.Cost',
      type: 'range',
      config: {
        keyPath: 'system.cost',
        min: 0
      }
    });

    filters.set('sizeValue', {
      label: 'SDM.FILTERS.SizeValue',
      type: 'range',
      config: {
        keyPath: 'system.size.value',
        min: 0
      }
    });

    filters.set('sizeUnit', {
      label: 'SDM.FILTERS.SizeUnit',
      type: 'set',
      config: {
        keyPath: 'system.size.unit',
        sort: false,
        choices: () =>
          Object.fromEntries(Object.entries(CONFIG.SDM.sizeUnits).map(([k, v]) => [k, $l10n(v)]))
      }
    });

    filters.set('startingKit', {
      label: 'SDM.FILTERS.StartingKit',
      type: 'boolean',
      config: { keyPath: 'system.starting_kit' }
    });

    filters.set('supplyType', {
      label: 'SDM.FILTERS.SupplyType',
      type: 'set',
      config: {
        keyPath: 'system.supply_type',
        sort: false,
        choices: () =>
          Object.fromEntries(Object.entries(CONFIG.SDM.SupplyType).map(([k, v]) => [k, $l10n(v)]))
      }
    });

    filters.set('paths', {
      label: 'SDM.FILTERS.Paths',
      type: 'set',
      config: {
        keyPath: 'system.categories',
        multiple: true,
        sort: true,
        choices: () =>
          Object.fromEntries(CONFIG.SDM.paths.map(c => [c, $l10n(`SDM.Category.${c}`)]))
      }
    });

    filters.set('features', {
      label: 'SDM.FILTERS.Features',
      type: 'set',
      config: {
        keyPath: 'system.features',
        multiple: false,
        sort: true,
        choices: () => {
          return Object.fromEntries(
            [...CONFIG.SDM.features].map(f => [f, $l10n(`SDM.ItemFeature.${f}`)])
          );
        }
      }
    });

    filters.set('categories', {
      label: 'SDM.FILTERS.Categories',
      type: 'set',
      config: {
        keyPath: 'system.categories',
        multiple: true,
        sort: true,
        choices: () =>
          Object.fromEntries(CONFIG.SDM.categories.map(c => [c, $l10n(`SDM.Category.${c}`)]))
      }
    });
  }
}

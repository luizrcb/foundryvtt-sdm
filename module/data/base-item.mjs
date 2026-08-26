import { GearType } from '../helpers/constants.mjs';
import { $l10n } from '../helpers/globalUtils.mjs';
import { getSlotsTaken } from '../helpers/itemUtils.mjs';
import HallmarkBaseDataModel from './hallmark-base-data.mjs';
import ItemSizeDataModel from './item-size.mjs';
import NPCBaseDataModel from './npc-base-data.mjs';

export default class SdmItemBase extends foundry.abstract.TypeDataModel {
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
      })
    });

    schema.area = new fields.SchemaField({
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

    schema.quantity = new fields.NumberField({
      required: true,
      integer: true,
      initial: 1,
      min: 0
    });

    schema.size = new fields.EmbeddedDataField(ItemSizeDataModel);

    schema.features = new fields.SetField(
      new fields.StringField({ required: true, blank: false, nullable: false }),
      {
        min: 0
      }
    );

    schema.attributes = new fields.EmbeddedDataField(NPCBaseDataModel);

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
            CONFIG.SDM.features.map(f => [f, $l10n(`SDM.ItemFeature.${f}`)])
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

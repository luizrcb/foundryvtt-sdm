import SdmItemBase from './base-item.mjs';

export default class SdmVehicle extends SdmItemBase {
  static LOCALIZATION_PREFIXES = ['SDM.Item.base', 'SDM.Item.Vehicle'];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.level = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0
    });

    // weekly supply upkeep (free text, like the legacy transport rows); cost reuses base `system.cost`
    schema.supply = new fields.StringField({
      required: false,
      blank: true,
      initial: ''
    });

    // cargo capacity in sacks
    schema.capacity = new fields.NumberField({
      ...requiredInteger,
      initial: 1,
      min: 0
    });

    schema.speed = new fields.NumberField({
      ...requiredInteger,
      initial: 0
      // uncapped: values outside -3..2 are allowed (see CONFIG.SDM.formatSpeed)
    });

    // automatic = self-propelled: doesn't need to be hauled by mounts
    schema.automatic = new fields.BooleanField({ initial: false });

    return schema;
  }

  static get compendiumBrowserFilters() {
    const filters = new Map();
    SdmItemBase.addCommonFilters(filters);
    SdmItemBase.addTransportFilters(filters, { automatic: true });
    return filters;
  }
}

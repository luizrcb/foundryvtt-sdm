import { PullMode } from '../helpers/constants.mjs';
import SdmItemBase from './base-item.mjs';

export default class SdmMount extends SdmItemBase {
  static LOCALIZATION_PREFIXES = ['SDM.Item.base', 'SDM.Item.Mount'];

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

    // sacks; carried on its back (1×) while unassigned
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

    // item.id (NOT uuid) of a vehicle on the same actor. Empty = unassigned.
    schema.pull_vehicle_id = new fields.StringField({
      required: true,
      blank: true,
      initial: ''
    });

    // blank = not pulling (unassigned mounts have no pull mode)
    schema.pull_mode = new fields.StringField({
      required: false,
      blank: true,
      initial: '',
      choices: CONFIG.SDM.pullModes
    });

    return schema;
  }

  /** @override */
  async _preUpdate(changes, options, user) {
    const allowed = await super._preUpdate(changes, options, user);
    if (allowed === false) return false;

    // Unassigned mounts are neither carting nor dragging: clear the mode with the assignment
    const vehicleId = foundry.utils.getProperty(changes, 'system.pull_vehicle_id');
    if (vehicleId === '' && this.pull_mode) {
      foundry.utils.setProperty(changes, 'system.pull_mode', '');
    }

    // Assigning a mount without a mode defaults it to carting (the common case)
    const modeChange = foundry.utils.getProperty(changes, 'system.pull_mode');
    if (vehicleId && !modeChange && !this.pull_mode) {
      foundry.utils.setProperty(changes, 'system.pull_mode', PullMode.CARTING);
    }
  }

  static get compendiumBrowserFilters() {
    const filters = new Map();
    SdmItemBase.addCommonFilters(filters);
    SdmItemBase.addTransportFilters(filters);
    return filters;
  }
}

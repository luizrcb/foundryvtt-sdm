import { $l10n } from '../helpers/globalUtils.mjs';

export class SDMActiveEffectData extends foundry.data.ActiveEffectTypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      ...super.defineSchema(),
      isItemMod: new fields.BooleanField({ required: true, initial: false, label: $l10n('SDM.IsItemMod') }),
      modType: new fields.StringField({ blank: true, required: false, initial: '', choices: CONFIG.SDM.itemModType, label: $l10n('SDM.ItemModType') }),
      // A mod gained as a hallmark level upgrade: it does not use one of the item's mod slots
      isHallmarkUpgrade: new fields.BooleanField({
        required: true,
        initial: false,
        label: $l10n('SDM.IsHallmarkUpgrade'),
        hint: $l10n('SDM.IsHallmarkUpgradeHint')
      }),
      // Cost of the mod (customization cost = mod cost × number of upgrades, or the item cost if higher)
      modCost: new fields.NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 0,
        label: $l10n('SDM.ItemModCost'),
        hint: $l10n('SDM.ItemModCostHint')
      }),
      // Ride mods priced per capacity ("€500/cap"): the cost is modCost × the ride's capacity
      modCostPerCapacity: new fields.BooleanField({
        required: true,
        initial: false,
        label: $l10n('SDM.ItemModCostPerCapacity'),
        hint: $l10n('SDM.ItemModCostPerCapacityHint')
      })
    };
  }
}

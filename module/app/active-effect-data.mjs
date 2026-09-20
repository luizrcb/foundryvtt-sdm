import { $l10n } from '../helpers/globalUtils.mjs';

export class SDMActiveEffectData extends foundry.data.ActiveEffectTypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      ...super.defineSchema(),
      isItemMod: new fields.BooleanField({ required: true, initial: false, label: $l10n('SDM.IsItemMod') }),
      modType: new fields.StringField({ blank: true, required: false, initial: '', choices: CONFIG.SDM.itemModType, label: $l10n('SDM.ItemModType') })
    };
  }
}

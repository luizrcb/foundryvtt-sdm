import SdmItemBase from './base-item.mjs';
import PowerDataModel from './power-data.mjs';

export default class SdmBurden extends SdmItemBase {
  static LOCALIZATION_PREFIXES = [
    'SDM.Item.base',
    'SDM.Item.Burden',
  ];

   static defineSchema() {
      const fields = foundry.data.fields;
      const schema = super.defineSchema();

      schema.type = new fields.StringField({
      required: false, blank: true, initial: '',
      choices: Object.entries(CONFIG.SDM.burdenType).reduce((acc, [key, value]) => {
          acc[key] = game.i18n.localize(value);
          return acc;
        }, {}),
      });

      schema.power = new fields.EmbeddedDataField(PowerDataModel, { required: false, nullable: true, initial: null });

      return schema;
    }

}

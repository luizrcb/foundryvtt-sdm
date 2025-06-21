import { SizeUnit } from '../helpers/constants.mjs';

export default class ItemSizeDataModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      value: new foundry.data.fields.NumberField({ required: true, initial: 1, min: 0 }),
      unit: new foundry.data.fields.StringField({
        required: true, initial: SizeUnit.STONES,
        choices: Object.values(SizeUnit).reduce((acc, key) => {
          acc[key] = game.i18n.localize(CONFIG.SDM.sizeUnits[key]);
          return acc;
        }, {}),
      }),
    };
  }
}

import { WardType } from '../helpers/constants.mjs';
import { capitalizeFirstLetter } from '../helpers/globalUtils.mjs';

export default class WardDataModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      value: new fields.NumberField({
        required: true,
        integer: true,
        min: 0,
        initial: 0
      }),

      type: new fields.StringField({
        require: false,
        blank: true,
        initial: '',
        choices: Object.values(WardType).reduce((acc, key) => {
          acc[key] = game.i18n.localize(`SDM.ItemWard${capitalizeFirstLetter(key)}`);
          return acc;
        }, {})
      }),

      armor: new fields.NumberField({
        required: false,
        integer: true,
        min: 0,
        initial: 0
      })
    };
  }
}

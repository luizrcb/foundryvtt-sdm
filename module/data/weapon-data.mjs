import { RangeOption } from '../helpers/constants.mjs';
import { capitalizeFirstLetter } from '../helpers/globalUtils.mjs';

export default class WeaponDataModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      damage: new fields.SchemaField({
        base: new fields.StringField({
          required: false,
          blank: true,
          initial: '1d4',
          validate: v => !v || (v && foundry.dice.Roll.validate(v)),
          validationError: game.i18n.localize('SDM.ErrorValidationRollFormula')
        }),
        versatile: new fields.StringField({
          required: false,
          blank: true,
          initial: '1d4',
          validate: v => !v || (v && foundry.dice.Roll.validate(v)),
          validationError: game.i18n.localize('SDM.ErrorValidationRollFormula')
        }),
        bonus: new fields.StringField({
          required: false,
          blank: true,
          initial: '',
          validate: v => !v || (v && foundry.dice.Roll.validate(v)),
          validationError: game.i18n.localize('SDM.ErrorValidationRollFormula')
        })
      }),

      range: new fields.StringField({
        required: false,
        blank: true,
        initial: '',
        choices: CONFIG.SDM.rangeType,
      }),

      versatile: new fields.BooleanField({ required: true, initial: false }),

      // Damage to the creatures adjacent to the target, once per attack that hits (Mouth of the Void: 1d6)
      splash: new fields.StringField({ required: true, blank: true, initial: '' })
    };
  }
}

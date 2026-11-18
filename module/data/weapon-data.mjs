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

      // Splash, once per attack: more creatures than the target, each against its own defense
      // (helpers/areas.mjs, rolls/attackFeatures.mjs). Mouth of the Void: around the target, 1d6.
      splash: new fields.StringField({ required: true, blank: true, initial: '' }),
      // Its damage: the formula above, the weapon's damage, or half of it
      splash_damage: new fields.StringField({ required: true, blank: false, initial: 'formula', choices: ['formula', 'weapon', 'half'] }),
      // Where: around the target (adjacent), a cone from the attacker (placed), or behind the target (a line or a cone)
      splash_shape: new fields.StringField({ required: true, blank: false, initial: 'around', choices: ['around', 'cone', 'behind_line', 'behind_cone'] }),
      splash_size: new fields.StringField({ required: true, blank: false, initial: 'small', choices: ['small', 'medium', 'large'] }),
      splash_across: new fields.NumberField({ required: true, nullable: false, min: 0, initial: 0 }),
      splash_affects: new fields.StringField({ required: true, blank: false, initial: 'everyone', choices: ['everyone', 'enemies', 'allies'] })
    };
  }
}

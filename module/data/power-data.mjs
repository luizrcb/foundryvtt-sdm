import { defineLightField } from './light-field.mjs';
import { getDefaultAbility } from '../helpers/globalUtils.mjs';
import { DEFAULT_POWER_ICON } from '../helpers/constants.mjs';

export default class PowerDataModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      img: new fields.FilePathField({
        required: false,
        nullable: true,
        blank: true,
        categories: ['IMAGE'],
        initial: DEFAULT_POWER_ICON
      }),
      name: new fields.StringField({ required: false, blank: true, initial: '' }),
      description: new fields.HTMLField(),
      is_dangerous: new fields.BooleanField({ required: true, initial: false }),
      // Removed after it is used (with confirmation): e.g. a power caught from someone else
      single_use: new fields.BooleanField({ required: true, initial: false }),
      // Casting it lights the caster's token ('none': no light)
      light: defineLightField({ preset: 'none' }),
      level: new fields.NumberField({ required: true, initial: 1, min: 0 }),
      range: new fields.StringField({ required: true, blank: true, initial: '' }),
      // Area of the power (small, medium, large) and its shape, placed from the power's card (helpers/areas.mjs)
      area: new fields.StringField({ required: true, blank: true, initial: '' }),
      area_shape: new fields.StringField({ required: true, blank: false, initial: 'circle' }),
      area_affects: new fields.StringField({ required: true, blank: false, initial: 'everyone' }),
      area_linger: new fields.BooleanField({ required: true, initial: false }),
      area_rounds: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
      area_across: new fields.NumberField({ required: true, nullable: false, min: 0, initial: 0 }),
      area_follows: new fields.BooleanField({ required: true, initial: false }),
      area_resolve: new fields.StringField({ required: true, blank: false, initial: 'attack' }),
      area_save_ability: new fields.StringField({ required: true, blank: true, initial: '' }),
      area_save_difficulty: new fields.StringField({ required: true, blank: true, initial: '' }),
      area_save_target: new fields.NumberField({ required: true, nullable: false, integer: true, min: 1, initial: 13 }),
      area_save_pass: new fields.StringField({ required: true, blank: false, initial: 'avoid' }),
      // A lingering area each round: damage, also on entering, and a condition (see base-item area)
      area_round_damage: new fields.StringField({ required: true, blank: false, initial: 'none' }),
      area_round_formula: new fields.StringField({ required: true, blank: true, initial: '' }),
      area_round_enter: new fields.BooleanField({ required: true, initial: false }),
      area_round_condition: new fields.StringField({ required: true, blank: true, initial: '' }),
      area_round_condition_rounds: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 1 }),
      target: new fields.StringField({ required: true, blank: true, initial: '' }),
      duration: new fields.StringField({ required: true, blank: true, initial: '' }),
      overcharge: new fields.StringField({ required: false, blank: true, initial: '' }),
      roll_formula: new fields.StringField({
        required: false,
        blank: true,
        initial: '',
        validate: v => !v || (v && foundry.dice.Roll.validate(v)),
        validationError: game.i18n.localize('SDM.ErrorValidationRollFormula')
      }),
      overcharge_roll_formula: new fields.StringField({
        required: false,
        blank: true,
        initial: '',
        validate: v => !v || (v && foundry.dice.Roll.validate(v)),
        validationError: game.i18n.localize('SDM.ErrorValidationRollFormula')
      }),
      default_ability: getDefaultAbility()
    };
  }
}

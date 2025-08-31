import { getDefaultAbility } from "../helpers/globalUtils.mjs";

export default class PowerDataModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      img: new fields.FilePathField({ required: false, nullable: true, blank: true, categories: ["IMAGE"], initial: 'icons/svg/book.svg' }),
      name: new fields.StringField({ required: false, blank: true, initial: '' }),
      description: new fields.HTMLField(),
      level: new fields.NumberField({ required: true, initial: 1, min: 0 }),
      range: new fields.StringField({ required: true, blank: true, initial: '' }),
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
      default_ability: getDefaultAbility(),
    };
  }
}

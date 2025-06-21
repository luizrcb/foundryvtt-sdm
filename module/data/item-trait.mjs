import { AttackType, SkillMod } from '../helpers/constants.mjs';
import { getDefaultAbility } from '../helpers/globalUtils.mjs';
import SdmItemBase from './base-item.mjs';

export default class SdmTrait extends SdmItemBase {
  static LOCALIZATION_PREFIXES = [
    'SDM.Item.base',
    'SDM.Item.Trait',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.is_skill = new fields.BooleanField({
      required: true, initial: false,
    });

    schema.skill_mod = new fields.NumberField({
      required: false, initial: 0, min: 0,
      choices: Object.entries(SkillMod).reduce((acc, [key, value]) => {
        acc[value] = key;
        return acc;
      }, {}),
    });

    schema.skill_mod_bonus = new fields.NumberField({
      ...requiredInteger, initial: 0,
    });

    schema.default_ability = getDefaultAbility();

    schema.default_attack = new fields.StringField({
      required: false,
      nullable: true,
      initial: AttackType.MELEE,
    });

    schema.is_spell = new fields.BooleanField({
      required: true, initial: false,
    });

    schema.spell_power = new fields.NumberField({
      required: false,
      nullable: true,
    });

    schema.roll_formula = new fields.StringField({
      required: false, blank: true, initial: '',
      validate: v => !v || v && foundry.dice.Roll.validate(v),
      validationError: game.i18n.localize("SDM.ErrorValidationRollFormula"),
    });

    return schema;
  }


  prepareDerivedData() {
    this.skill_mod_final = this.skill_mod + this.skill_mod_bonus;
  }
}

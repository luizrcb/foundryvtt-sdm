import { SkillMod } from '../helpers/constants.mjs';
import { getDefaultAbility } from '../helpers/globalUtils.mjs';
import SdmItemBase from './base-item.mjs';
import PowerDataModel from './power-data.mjs';

export default class SdmTrait extends SdmItemBase {
  static LOCALIZATION_PREFIXES = [
    'SDM.Item.base',
    'SDM.Item.Trait',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.default_ability = getDefaultAbility();

    schema.type = new fields.StringField({
      required: false, blank: true, initial: '',
      choices: Object.entries(CONFIG.SDM.traitType).reduce((acc, [key, value]) => {
        acc[key] = game.i18n.localize(value);
        return acc;
      }, {}),
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

    schema.power = new fields.EmbeddedDataField(PowerDataModel, { required: false, nullable: true, initial: null });

    return schema;
  }


  prepareDerivedData() {
    this.skill_mod_final = this.skill_mod + this.skill_mod_bonus;
  }
}

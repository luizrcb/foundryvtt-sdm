import { getDefaultAbility } from '../helpers/globalUtils.mjs';
import SdmItemBase from './base-item.mjs';
import PowerDataModel from './power-data.mjs';
import SkillDataModel from './skill-data.mjs';

export default class SdmTrait extends SdmItemBase {
  static LOCALIZATION_PREFIXES = ['SDM.Item.base', 'SDM.Item.Trait'];

  static defineSchema() {
    const fields = foundry.data.fields;

    const schema = super.defineSchema();

    schema.default_ability = getDefaultAbility();

    schema.type = new fields.StringField({
      required: false,
      blank: true,
      initial: '',
      choices: Object.entries({
        ...CONFIG.SDM.traitType,
        '': 'TYPE.Trait'
      }).reduce((acc, [key, value]) => {
        acc[key] = game.i18n.localize(value);
        return acc;
      }, {})
    });

    schema.skill = new fields.EmbeddedDataField(SkillDataModel);

    schema.power = new fields.EmbeddedDataField(PowerDataModel);

    return schema;
  }

  prepareDerivedData() {

   const defaultModifierStep = game.settings.get('sdm', 'skillModifierStep');
   const shouldUseCustomModifiers = this.skill.custom_modifiers;

   const skillStep = shouldUseCustomModifiers ? this.skill.modifier_step : defaultModifierStep;

    this.skill.modifier_final =
      (this.skill.rank * skillStep) + this.skill.modifier_bonus;
  }
}

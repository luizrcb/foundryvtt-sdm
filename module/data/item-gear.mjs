import SdmItemBase from './base-item.mjs';
import { getDefaultAbility } from '../helpers/globalUtils.mjs'

export default class SdmGear extends SdmItemBase {
  static LOCALIZATION_PREFIXES = [
    'SDM.Item.base',
    'SDM.Item.Gear',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.readied = new fields.BooleanField({ initial: false });

    schema.default_ability = getDefaultAbility();

    schema.is_spell = new fields.BooleanField({
      required: true, initial: false,
    });

    schema.power = new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 1,
      min: 1,
      max: 15,
    });

    schema.formula = new fields.StringField({
      required: false, blank: true, initial: '',
      validate: v => !v || (v && foundry.dice.Roll.validate(v)),
      validationError: "must be a valid Roll formula",
    });

    return schema;
  }
}

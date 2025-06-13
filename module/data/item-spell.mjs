import SdmItemBase from './base-item.mjs';

export default class SdmSpell extends SdmItemBase {
  static LOCALIZATION_PREFIXES = [
    'SDM.Item.base',
    'SDM.Item.Spell',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

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

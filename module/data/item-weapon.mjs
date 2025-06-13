import SdmItemBase from './base-item.mjs';
import ItemSizeDataModel from './item-size.mjs';
import { RangeOption, } from '../helpers/constants.mjs';

export default class SdmWeapon extends SdmItemBase {
  static LOCALIZATION_PREFIXES = [
    'SDM.Item.base',
    'SDM.Item.Weapon',
  ];

  static defineSchema() {
    const schema = super.defineSchema();

    const fields = foundry.data.fields;
    const { BooleanField, SchemaField, EmbeddedDataField, StringField, HTMLField } = fields;

    schema.equipped = new BooleanField({ initial: false });

    schema.size = new EmbeddedDataField(ItemSizeDataModel);

    schema.damage = new SchemaField({
      base: new StringField({
        required: true, initial: '1d4',
        validate: v => foundry.dice.Roll.validate(v),
        validationError: "must be a valid Roll formula",
      }),
      versatile: new StringField({
        required: false, nullabe: true, blank: true, initial: '',
        validate: v => !v || foundry.dice.Roll.validate(v),
        validationError: "must be a valid Roll formula",
      }),
      statBonus: new StringField({
        required: false, initial: 'str', blank: true,
        choices: Object.keys(CONFIG.SDM.statAbbreviations).reduce((acc, key) => {
          acc[key] = game.i18n.localize(CONFIG.SDM.statAbbreviations[key]);
          return acc;
        }, {}),
      })
    });

    schema.range = new StringField({
      required: true, initial: RangeOption.CLOSE, choices:
        Object.values(RangeOption).reduce((acc, key) => {
          acc[key] = game.i18n.localize(`SDM.Item.Range.${key}`);
          return acc;
        }, {}),
    });

    schema.versatile = new BooleanField({ required: true, initial: false });

    return schema;
  }
}

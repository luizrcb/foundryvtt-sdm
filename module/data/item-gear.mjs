import SdmItemBase from './base-item.mjs';
import { getDefaultAbility } from '../helpers/globalUtils.mjs'
import { ArmorType, RangeOption } from '../helpers/constants.mjs'


export default class SdmGear extends SdmItemBase {
  static LOCALIZATION_PREFIXES = [
    'SDM.Item.base',
    'SDM.Item.Gear',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    // also known as equipped
    schema.readied = new fields.BooleanField({ initial: false });

    schema.default_ability = getDefaultAbility();

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
      validationError: "must be a valid Roll formula",
    });

    schema.is_armor = new fields.BooleanField({
      required: true, initial: false,
    });

    schema.armor_value = new fields.NumberField({
      required: false,
      nullable: true,
    });

    schema.armor_type = new fields.StringField({
      require: false, blank: true, initial: '', choices:
        Object.values(ArmorType).reduce((acc, key) => {
          acc[key] = game.i18n.localize(`SDM.Item.Armor.Type.${key}`);
          return acc;
        }, {}),
    });

    schema.cumbersome_armor = new fields.BooleanField({ initial: false });

    schema.powered_armor = new fields.SchemaField({
      max_charges: new fields.NumberField({
        required: false, integer: true, min: 0,
      }),
      remaining_charges: new fields.NumberField({
        required: false, integer: true, min: 0,
      }),
    }, { required: false, nullable: true, initial: null });

    schema.is_weapon = new fields.BooleanField({
      required: true, initial: false,
    });

    schema.weapon_damage = new fields.SchemaField({
      base: new fields.StringField({
        required: false, blank: true, initial: '',
        validate: v => !v || v && foundry.dice.Roll.validate(v),
        validationError: "must be a valid Roll formula",
      }),
      versatile: new fields.StringField({
        required: false, blank: true, initial: '',
        validate: v => !v || v && foundry.dice.Roll.validate(v),
        validationError: "must be a valid Roll formula",
      }),
      bonus: new fields.StringField({
        required: false, blank: true, initial: '',
        validate: v => !v || v && foundry.dice.Roll.validate(v),
        validationError: "must be a valid Roll formula",
      }),
    });

    schema.weapon_range = new fields.StringField({
      required: false, blank: true, initial: '', choices:
        Object.values(RangeOption).reduce((acc, key) => {
          acc[key] = game.i18n.localize(`SDM.Item.Range.${key}`);
          return acc;
        }, {}),
    });

    schema.versatile_weapon = new fields.BooleanField({ required: true, initial: false });

    return schema;
  }
}

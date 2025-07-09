import SdmItemBase from './base-item.mjs';
import { SDM } from '../helpers/config.mjs';

export default class SdmMount extends SdmItemBase {
  static LOCALIZATION_PREFIXES = ['SDM.Item.base', 'SDM.Item.Mount'];

  static defineSchema() {
    const schema = super.defineSchema();
    const { fields } = foundry.data;

    schema.level = new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
      min: 0
    });

    schema.requires = new fields.StringField({
      required: false,
      nullable: true,
      blank: true
    });

    // in SACKS
    schema.capacity = new fields.NumberField({
      required: true,
      initial: 1,
      min: 1,
      integer: true
    });

    schema.pulledLoad = new fields.SchemaField(
      {
        motorId: new fields.DocumentUUIDField({
          required: false,
          nullable: true,
          blank: true,
          validate: v => !v || !!fromUuidSync(v) // Valida se o veículo existe
        }),
        mode: new fields.StringField({
          choices: Object.entries(SDM.pullModes).reduce((acc, [key, value]) => {
            acc[key] = game.i18n.localize(value);
            return acc;
          }, {}),
          required: false,
          blank: true,
          initial: ''
        })
      },
      {
        nullable: true,
        required: false
      }
    );

    schema.riders = new fields.ArrayField(
      new fields.DocumentUUIDField({
        validate: id => !!fromUuidSync(id)
      }),
      {
        required: false,
        initial: []
      }
    );

    schema.speed = new fields.StringField({
      required: true,
      nullable: false,
      initial: 'standard',
      choices: Object.entries(SDM.speedType).reduce((acc, [key, value]) => {
        acc[key] = game.i18n.localize(value);
        return acc;
      }, {})
    });

    schema.tags = new fields.ArrayField(new fields.StringField(), { initial: [] });

    return schema;
  }
}

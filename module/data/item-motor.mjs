import SdmItemBase from './base-item.mjs';
import { SDM } from '../helpers/config.mjs';

export default class SdmMotor extends SdmItemBase {
  static LOCALIZATION_PREFIXES = ['SDM.Item.base', 'SDM.Item.Motor'];

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

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
      blank: true,
      initial: ''
    });

    schema.capacity = new fields.NumberField({
      required: true,
      initial: 1,
      min: 1,
      integer: true
    });

    schema.requiredMounts = new fields.NumberField({
      required: true,
      initial: 0,
      min: 0,
      integer: true
    });

    schema.pulledBy = new fields.ArrayField(
      new fields.DocumentUUIDField({
        required: false,
        nullable: true,
        blank: true,
        validate: v => !v || !!fromUuidSync(v), // Valida ID da montaria
        label: 'SDM.Item.Motor.PulledBy'
      }),
      { initial: [] }
    );

    schema.passengers = new fields.ArrayField(
      new fields.DocumentUUIDField({
        validate: v => !!fromUuidSync(v) // Valida IDs de passageiros
      }),
      { initial: [], label: 'SDM.Item.Motor.Passengers' }
    );

    schema.selfPulled = new fields.BooleanField({
      required: true,
      initial: false,
      label: 'SDM.Item.Motor.SelfPulled'
    });

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

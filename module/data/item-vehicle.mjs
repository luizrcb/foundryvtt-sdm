import SdmItemBase from './base-item.mjs';
import { SDM } from '../helpers/config.mjs';

export default class SdmVehicle extends SdmItemBase {
  static LOCALIZATION_PREFIXES = ['SDM.Item.base', 'SDM.Item.Vehicle'];

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
        validate: v => !v || !!fromUuidSync(v),
        label: 'SDM.Item.Vehicle.PulledBy'
      }),
      { initial: [] }
    );

    schema.passengers = new fields.ArrayField(
      new fields.DocumentUUIDField({
        validate: v => !!fromUuidSync(v)
      }),
      { initial: [], label: 'SDM.Item.Vehicle.Passengers' }
    );

    schema.selfPulled = new fields.BooleanField({
      required: true,
      initial: false,
      label: 'SDM.Item.Vehicle.SelfPulled'
    });

    schema.speed = new fields.NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
      choices: CONFIG.SDM.reverseSpeedValues,
    });

    schema.tags = new fields.ArrayField(new fields.StringField(), { initial: [] });

    return schema;
  }
}

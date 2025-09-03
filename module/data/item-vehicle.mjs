import SdmItemBase from './base-item.mjs';
import { transportBaseFields } from './transport-base-data.mjs';

const fields = foundry.data.fields;

export default class SdmVehicle extends SdmItemBase {
  static LOCALIZATION_PREFIXES = ['SDM.Item.base', 'SDM.Item.Vehicle'];

  static defineSchema() {
    const baseItemSchema = super.defineSchema();

    return {
      ...baseItemSchema,

      ...transportBaseFields(),

      requiredMounts: new fields.NumberField({
        required: true,
        initial: 0,
        min: 0,
        integer: true
      }),

      pulledBy: new fields.ArrayField(
        new fields.DocumentUUIDField({
          required: false,
          nullable: true,
          blank: true,
          validate: v => !v || !!fromUuidSync(v),
          label: 'SDM.Item.Vehicle.PulledBy'
        }),
        { initial: [] }
      ),

      passengers: new fields.ArrayField(
        new fields.DocumentUUIDField({
          validate: v => !!fromUuidSync(v)
        }),
        { initial: [], label: 'SDM.Item.Vehicle.Passengers' }
      ),

      selfPulled: new fields.BooleanField({
        required: true,
        initial: false,
        label: 'SDM.Item.Vehicle.SelfPulled'
      }),

      tags: new fields.ArrayField(new fields.StringField(), { initial: [] })
    };
  }

  getRollData() {
    const data = {};

    data.level = this.level;
    data.capacity = this.capacity;
    data.base_speed = this.base_speed;
    data.weapon = this.weapon;
    data.damage = this.weapon.damage.base;

    return data;
  }
}

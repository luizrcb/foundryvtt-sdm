import SdmItemBase from './base-item.mjs';
import { SDM } from '../helpers/config.mjs';
import { SpeedType } from '../helpers/constants.mjs';
import { transportBaseFields } from './transport-base-data.mjs';

const { fields } = foundry.data;

export default class SdmMount extends SdmItemBase {
  static LOCALIZATION_PREFIXES = ['SDM.Item.base', 'SDM.Item.Mount'];

  static defineSchema() {
    const baseItemSchema = super.defineSchema();

    return {
      ...baseItemSchema,

      ...transportBaseFields(),

      pulledLoad: new fields.SchemaField(
        {
          vehicleId: new fields.DocumentUUIDField({
            required: false,
            nullable: true,
            blank: true,
            validate: v => !v || !!fromUuidSync(v)
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
      ),

      riders: new fields.ArrayField(
        new fields.DocumentUUIDField({
          validate: id => !!fromUuidSync(id)
        }),
        {
          required: false,
          initial: []
        }
      ),

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

import { SpeedType, SpeedValues } from "../helpers/constants.mjs";

const fields = foundry.data.fields;

const requiredInteger = { required: true, nullable: false, integer: true };

export function transportBaseFields() {
  return {
    level: new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0
    }),

    capacity: new fields.NumberField({
      ...requiredInteger,
      initial: 1,
      min: 0,
    }),

    base_speed: new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      choices: CONFIG.SDM.reverseSpeedValues,
    }),

    supply: new fields.StringField({
      required: false,
      nullable: true,
      blank: true,
      initial: ''
    }),
  };
}

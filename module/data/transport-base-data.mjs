const fields = foundry.data.fields;

const requiredInteger = { required: true, nullable: false, integer: true };

export function transportBaseFields() {
  return {
    name: new fields.StringField({ required: false, nullable: true, blank: true, initial: '' }),
    level: new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0
    }),
    capacity: new fields.NumberField({
      ...requiredInteger,
      initial: 1,
      min: 0
    }),
    cargo: new fields.StringField({
      required: false,
      nullable: true,
      blank: true,
      initial: ''
    }),
    speed: new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      choices: CONFIG.SDM.reverseSpeedValues
    }),

    cost: new fields.StringField({
      required: false,
      nullable: true,
      blank: true,
      initial: ''
    }),
    supply: new fields.StringField({
      required: false,
      nullable: true,
      blank: true,
      initial: ''
    })
  };
}

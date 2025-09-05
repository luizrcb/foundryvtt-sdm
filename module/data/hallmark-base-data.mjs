const fields = foundry.data.fields;

const requiredInteger = { required: true, nullable: false, integer: true };

export function hallmarkBaseFields() {
  return {
    level: new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0
    }),

    experience: new fields.StringField({ required: true, initial: '0' }),

  };
}

export default class HallmarkBaseDataModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...npcBaseFields()
    };
  }
}

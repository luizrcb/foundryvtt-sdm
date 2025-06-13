export default class AbilityDataModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      name: new foundry.data.fields.StringField({ required: true, blank: false }),
      sources: new foundry.data.fields.NumberField({
        required: true, integer: true, nullable: false, min: 0, max: 4, initial: 0,
      }),
    };
  }
}

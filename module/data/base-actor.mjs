export default class SdmActorBase extends foundry.abstract
  .TypeDataModel {
  static LOCALIZATION_PREFIXES = ["SDM.Actor.base"];

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = {};

    schema.biography = new fields.HTMLField();
    schema.features = new fields.HTMLField();

    return schema;
  }
}

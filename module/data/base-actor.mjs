import { SizeUnit } from "../helpers/constants.mjs";

export default class SdmActorBase extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ['SDM.Actor.base'];

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = {};

    schema.biography = new fields.HTMLField();
    schema.notes = new fields.HTMLField();

    schema.size = new fields.SchemaField({
      value: new foundry.data.fields.NumberField({ required: true, initial: 1, min: 0 }),
      unit: new foundry.data.fields.StringField({
        required: true,
        initial: SizeUnit.SACKS,
        choices: Object.values(SizeUnit).reduce((acc, key) => {
          acc[key] = game.i18n.localize(CONFIG.SDM.sizeUnits[key]);
          return acc;
        }, {})
      })
    });

    return schema;
  }
}

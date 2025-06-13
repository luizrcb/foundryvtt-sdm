import ItemSizeDataModel from './item-size.mjs';

export default class SdmItemBase extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = {};

    schema.cost = new fields.StringField({
      required: false, blank: true,
    });

    schema.description = new fields.HTMLField();

    schema.quantity = new fields.NumberField({
      required: true, integer: true, initial: 1, min: 0,
    });

    schema.size = new fields.EmbeddedDataField(ItemSizeDataModel);

    schema.features = new fields.HTMLField();

    return schema;
  }
}

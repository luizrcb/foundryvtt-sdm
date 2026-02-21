import SdmItemBase from './base-item.mjs';
import PowerDataModel from './power-data.mjs';

export default class SdmBurden extends SdmItemBase {
  static LOCALIZATION_PREFIXES = ['SDM.Item.base', 'SDM.Item.Burden'];

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    schema.type = new fields.StringField({
      required: false,
      blank: true,
      initial: '',
      choices: Object.entries({
        ...CONFIG.SDM.burdenType,
        '': 'TYPE.Burden'
      }).reduce((acc, [key, value]) => {
        acc[key] = game.i18n.localize(value);
        return acc;
      }, {})
    });

    schema.power = new fields.EmbeddedDataField(PowerDataModel);

    schema.cure_steps = new fields.SchemaField(
      {
        completed: new fields.NumberField({
          required: true,
          initial: 0,
          min: 0
        }),
        required: new fields.NumberField({
          required: true,
          initial: 0,
          min: 0
        })
      },
      { nullable: false }
    );

    return schema;
  }

  static migrateData(source) {
    this._migrateData(source);
    return super.migrateData(source);
  }

  /** @inheritDoc */
  static _migrateData(source) {
    SdmBurden.#migrateFeatures(source);
  }

  static #migrateFeatures(source) {
    if (typeof source.features === 'string') {
      source.features = [];
    }

    if (source.features && source.features.length) {
      source.features = [...source.features].filter(f => f && f.trim() !== '').sort();
    }
  }
}

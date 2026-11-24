/** Light settings (items with the light category or glowing feature, and powers that create light). */
export function defineLightField({ preset = '' } = {}) {
  const fields = foundry.data.fields;
  return new fields.SchemaField({
    preset: new fields.StringField({
      required: true,
      blank: true,
      initial: preset,
      choices: ['', 'none', 'torch', 'lantern', 'candle', 'glow', 'custom']
    }),
    bright: new fields.NumberField({ required: true, nullable: false, min: 0, initial: 4 }),
    dim: new fields.NumberField({ required: true, nullable: false, min: 0, initial: 8 }),
    color: new fields.StringField({ required: true, blank: true, initial: '#ff9329' }),
    animation: new fields.StringField({ required: true, blank: true, initial: 'torch' }),
    speed: new fields.NumberField({ required: true, nullable: false, min: 0, max: 10, integer: true, initial: 5 }),
    intensity: new fields.NumberField({ required: true, nullable: false, min: 0, max: 10, integer: true, initial: 5 })
  });
}

/** Counters (kills, skulls, hits…) kept by items and actors, keyed by a slug of their name. */
export function defineCountersField() {
  const fields = foundry.data.fields;
  return new fields.TypedObjectField(
    new fields.SchemaField({
      label: new fields.StringField({ required: true, blank: false, initial: 'Counter' }),
      value: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0 }),
      max: new fields.NumberField({ required: false, nullable: true, integer: true, initial: null, min: 0 }),
      reset_value: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0 }),
      reset_on_combat_end: new fields.BooleanField({ initial: false }),
      // Also reset at the start of each combat round, at the start of its owner's turn, when its
      // owner rests, or when the game date changes (a new day)
      reset_each: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'round', 'turn', 'rest', 'day'] })
    })
  );
}

/**
 * Roll triggers (gear, traits and burdens): what happens on a roll result, shown on the chat card,
 * with optional actions. Rolls not tied to an item (attacks, saves, ability checks, defeat) check the
 * actor's readied gear and all its traits and burdens.
 */
export function defineTriggersField() {
  const fields = foundry.data.fields;
  return new fields.ArrayField(
    new fields.SchemaField({
      roll: new fields.StringField({
        required: true,
        blank: false,
        initial: 'attack',
        choices: ['attack', 'damage', 'power', 'usage', 'save', 'ability', 'defeat', 'counter']
      }),
      // Counter triggers: which of the item's counters is watched
      watch: new fields.StringField({ required: true, blank: true, initial: '' }),
      // Attack triggers: which attacks ('' any)
      attack: new fields.StringField({
        required: true,
        blank: true,
        initial: '',
        choices: ['', 'melee', 'ranged', 'fantascience', 'oldtech']
      }),
      // Saves and ability checks: which ability ('' any)
      ability: new fields.StringField({ required: true, blank: true, initial: '' }),
      // Power rolls of an album: which power, by name ('' any)
      power: new fields.StringField({ required: true, blank: true, initial: '' }),
      condition: new fields.StringField({
        required: true,
        blank: false,
        initial: 'natural',
        choices: [
          'natural',
          'naturalAtLeast',
          'naturalAtMost',
          'total',
          'totalAtLeast',
          'totalAtMost',
          'die',
          'max',
          'min',
          'matching',
          'success',
          'failure',
          'counterMax',
          'runningLow',
          'runOut'
        ]
      }),
      value: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 13 }),
      text: new fields.StringField({ required: true, blank: true, initial: '' }),
      // Actions when it fires (all optional)
      table: new fields.StringField({ required: true, blank: true, initial: '' }),
      effect: new fields.StringField({ required: true, blank: true, initial: '' }),
      // Who gets the effect: the targeted tokens, or the one who rolled
      effect_target: new fields.StringField({
        required: true,
        blank: false,
        initial: 'targets',
        choices: ['targets', 'self']
      }),
      wear: new fields.StringField({
        required: true,
        blank: true,
        initial: '',
        choices: ['', 'notch', 'break', 'running_low', 'run_out', 'repair', 'repair_full', 'recharge']
      }),
      counter: new fields.StringField({ required: true, blank: true, initial: '' }),
      // add (the step; negative lowers), set (to the step's number) or reset (to the counter's reset value)
      counter_mode: new fields.StringField({ required: true, blank: false, initial: 'add', choices: ['add', 'set', 'reset'] }),
      counter_step: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 1 })
    })
  );
}

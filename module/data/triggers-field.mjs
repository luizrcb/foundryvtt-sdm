/**
 * Roll triggers (gear, traits and burdens): what happens on a roll result, shown on the chat card,
 * with optional actions. Rolls not tied to an item (attacks, saves, ability checks, defeat) check the
 * actor's readied gear and all its traits and burdens. Item rolls (damage, power, usage) fire the triggers
 * of the item that rolled, or of any readied gear / trait / burden whose trigger watches that item ("From").
 *
 * Item pickers store '@self' (the item holding the trigger) or an item identifier (the slug of its
 * name, as @items.<identifier> references use), so they keep working on copies and compendium items.
 */
export function defineTriggersField() {
  const fields = foundry.data.fields;
  return new fields.ArrayField(
    new fields.SchemaField({
      roll: new fields.StringField({
        required: true,
        blank: false,
        initial: 'attack',
        choices: ['attack', 'damage', 'power', 'usage', 'save', 'ability', 'defeat', 'counter', 'charges']
      }),
      // Item rolls (damage, power, usage): whose rolls fire it: this item (''), any item, or one item
      from: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'any', 'item', 'unarmed'] }),
      from_item: new fields.StringField({ required: true, blank: true, initial: '' }),
      // Counter triggers: which counter is watched, the item's own ('') or its owner's ('actor')
      watch: new fields.StringField({ required: true, blank: true, initial: '' }),
      watch_scope: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'actor'] }),
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
          // Every roll of that kind (e.g. every damage roll of a weapon applies a condition)
          'always',
          // Legacy: migrated to 'full'
          'counterMax',
          'runningLow',
          'runOut',
          // Counters and charges: every change, every rise, every drop; full / empty once per crossing
          'changes',
          'increases',
          'decreases',
          'full',
          'empty'
        ]
      }),
      // A number, or a formula reading counters and other values (@item.counters.kills.value; no dice)
      value: new fields.StringField({ required: true, blank: true, initial: '13' }),
      text: new fields.StringField({ required: true, blank: true, initial: '' }),
      // A cost paid before the actions (life, an ability or hero dice; a formula), optionally asking first
      cost_resource: new fields.StringField({
        required: true,
        blank: true,
        initial: '',
        choices: ['', 'life', 'str', 'end', 'agi', 'cha', 'aur', 'tho', 'hero_die']
      }),
      cost: new fields.StringField({ required: true, blank: true, initial: '' }),
      cost_ask: new fields.BooleanField({ required: true, initial: false }),
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
      // Copied only if a save fails (like the Condition action's save)
      effect_save: new fields.BooleanField({ initial: false }),
      effect_save_ability: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'str', 'end', 'agi', 'cha', 'aur', 'tho'] }),
      // A condition put on the targets or self (any status of the Token HUD list), no effect needed on the item
      status: new fields.StringField({ required: true, blank: true, initial: '' }),
      status_target: new fields.StringField({ required: true, blank: false, initial: 'targets', choices: ['targets', 'self'] }),
      // Put the condition on (apply) or take it off (remove)
      status_mode: new fields.StringField({ required: true, blank: false, initial: 'apply', choices: ['apply', 'remove'] }),
      // Put on only if a save fails: NPC targets roll it, characters get a save request with the
      // suggested ability ('' = by the condition: Aura for the mind, else Endurance)
      status_save: new fields.BooleanField({ initial: false }),
      status_save_ability: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'str', 'end', 'agi', 'cha', 'aur', 'tho'] }),
      wear: new fields.StringField({
        required: true,
        blank: true,
        initial: '',
        choices: ['', 'notch', 'break', 'running_low', 'run_out', 'repair', 'repair_full', 'recharge']
      }),
      counter: new fields.StringField({ required: true, blank: true, initial: '' }),
      // The counter action changes this item's counter ('') or the owner's ('actor')
      counter_scope: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'actor'] }),
      // Counter / charge triggers: add and spend amounts are multiplied by the size of the change
      by_change: new fields.BooleanField({ required: true, initial: false }),
      // Counter / charge triggers with "≥" or "≤": fire only when the condition becomes true
      once: new fields.BooleanField({ required: true, initial: false }),
      // add (the step; negative lowers), set (to the step's number) or reset (to the counter's reset value)
      counter_mode: new fields.StringField({ required: true, blank: false, initial: 'add', choices: ['add', 'set', 'reset'] }),
      counter_step: new fields.StringField({ required: true, blank: true, initial: '1' }),
      // Use a power: a power item or an album ('' none, '@self', or an identifier); which album power
      // (by name; blank: the album's selected one); free: no cast dialog and no cost
      cast: new fields.StringField({ required: true, blank: true, initial: '' }),
      cast_power: new fields.StringField({ required: true, blank: true, initial: '' }),
      cast_free: new fields.BooleanField({ required: true, initial: false }),
      // Use a consumable ('' none, '@self', or an identifier), as its Use action
      use: new fields.StringField({ required: true, blank: true, initial: '' }),
      // Light: light / put out / toggle an item's light ('@self' or an identifier)
      light: new fields.StringField({
        required: true,
        blank: true,
        initial: '',
        choices: ['', 'light', 'put_out', 'toggle']
      }),
      light_item: new fields.StringField({ required: true, blank: true, initial: '@self' }),
      // Charges: spend, add or set an item's charges (or the uses of its uses counter)
      charges_mode: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'spend', 'add', 'set'] }),
      charges_amount: new fields.StringField({ required: true, blank: true, initial: '1' }),
      charges_item: new fields.StringField({ required: true, blank: true, initial: '@self' })
    })
  );
}

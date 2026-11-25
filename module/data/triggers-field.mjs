/**
 * Roll triggers (gear, traits and burdens): what happens on a roll result, shown on the chat card,
 * with optional actions. Rolls not tied to an item (attacks, saves, ability checks, defeat) check the
 * actor's readied gear and all its traits and burdens. Item rolls (damage, power, usage) and a consumable's
 * Use (no roll: it always fires) fire the triggers
 * of the item that rolled, or of any readied gear / trait / burden whose trigger watches that item ("From").
 *
 * Item pickers store '@self' (the item holding the trigger) or an item identifier (the slug of its
 * name, as @items.<identifier> references use), so they keep working on copies and compendium items.
 */
export function defineTriggersField() {
  return new foundry.data.fields.ArrayField(defineTriggerSchema());
}

/** One trigger (its roll, condition and actions): a new field each call (a field has one parent). */
export function defineTriggerSchema() {
  const fields = foundry.data.fields;
  return new fields.SchemaField({
      roll: new fields.StringField({
        required: true,
        blank: false,
        initial: 'attack',
        choices: ['attack', 'damage', 'power', 'usage', 'use', 'save', 'ability', 'defeat', 'counter', 'charges', 'kill', 'death', 'hit']
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
      // The save's difficulty: standard (''), very easy / easy (target −4 / −2), hard / very hard (+2 / +4)
      // or an exact target ("target": the *_save_target number)
      effect_save_difficulty: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'veryEasy', 'easy', 'hard', 'veryHard', 'target'] }),
      effect_save_target: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 13, min: 1 }),
      // A condition put on the targets or self (any status of the Token HUD list), no effect needed on the item
      status: new fields.StringField({ required: true, blank: true, initial: '' }),
      status_target: new fields.StringField({ required: true, blank: false, initial: 'targets', choices: ['targets', 'self'] }),
      // Put the condition on (apply) or take it off (remove)
      status_mode: new fields.StringField({ required: true, blank: false, initial: 'apply', choices: ['apply', 'remove'] }),
      // Put on only if a save fails: NPC targets roll it, characters get a save request with the
      // suggested ability ('' = by the condition: Aura for the mind, else Endurance)
      // How long the condition lasts (blank: until removed); world-time units expire with the calendar
      status_duration: new fields.NumberField({ required: true, nullable: true, integer: true, initial: null, min: 0 }),
      status_duration_units: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'rounds', 'minutes', 'hours', 'days', 'weeks'] }),
      status_save: new fields.BooleanField({ initial: false }),
      status_save_ability: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'str', 'end', 'agi', 'cha', 'aur', 'tho'] }),
      status_save_difficulty: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'veryEasy', 'easy', 'hard', 'veryHard', 'target'] }),
      status_save_target: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 13, min: 1 }),
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
        choices: ['', 'light', 'put_out', 'toggle', 'flare']
      }),
      light_item: new fields.StringField({ required: true, blank: true, initial: '@self' }),
      // Flare: lit for a while, then out on its own
      light_duration: new fields.NumberField({ required: true, nullable: true, integer: true, initial: 1, min: 0 }),
      light_duration_units: new fields.StringField({ required: true, blank: true, initial: 'rounds', choices: ['', 'rounds', 'minutes', 'hours', 'days', 'weeks'] }),
      // Life: heal or damage the targets or the one who rolled (a number or a formula)
      life_mode: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'heal', 'damage'] }),
      life_amount: new fields.StringField({ required: true, blank: true, initial: '1d6' }),
      life_target: new fields.StringField({ required: true, blank: false, initial: 'targets', choices: ['targets', 'self'] }),
      // Ability damage: lower an ability of the targets or the one who rolled ('choose': the roller picks)
      ability_damage: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'choose', 'str', 'end', 'agi', 'cha', 'aur', 'tho'] }),
      ability_damage_amount: new fields.StringField({ required: true, blank: true, initial: '1' }),
      ability_damage_target: new fields.StringField({ required: true, blank: false, initial: 'targets', choices: ['targets', 'self'] }),
      // Purge: remove the effects of consumables from the targets or the one who rolled ('' none)
      purge: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'targets', 'self'] }),
      // Roll a formula to chat (blank: none)
      roll_formula: new fields.StringField({ required: true, blank: true, initial: '' }),
      // Hero dice the one who rolled gains (negative: loses), never above the maximum (blank: none)
      hero_dice: new fields.StringField({ required: true, blank: true, initial: '' }),
      // Animate or deanimate an animated item ('@self' or an identifier)
      animate: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'animate', 'deanimate'] }),
      animate_item: new fields.StringField({ required: true, blank: true, initial: '@self' }),
      // Charges: spend, add or set an item's charges (or the uses of its uses counter)
      charges_mode: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'spend', 'add', 'set'] }),
      charges_amount: new fields.StringField({ required: true, blank: true, initial: '1' }),
      charges_item: new fields.StringField({ required: true, blank: true, initial: '@self' }),
      // Summon: creatures (an NPC, or a roll table whose results are NPCs) next to the one who rolled
      // (helpers/summons.mjs): how many, at what level (blank: their own), for how many rounds (0: until
      // dismissed), up to how many at once (blank: no limit), placed nearby or by hand, gone at 0 life
      summon: new fields.StringField({ required: true, blank: true, initial: '' }),
      summon_count: new fields.StringField({ required: true, blank: true, initial: '1' }),
      summon_level: new fields.StringField({ required: true, blank: true, initial: '' }),
      summon_rounds: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
      summon_limit: new fields.StringField({ required: true, blank: true, initial: '' }),
      summon_place: new fields.StringField({ required: true, blank: false, initial: 'auto', choices: ['auto', 'manual'] }),
      summon_ends_at_zero: new fields.BooleanField({ required: true, initial: false })
    });
}

import { $l10n } from '../helpers/globalUtils.mjs';
import { defineTriggersField } from '../data/triggers-field.mjs';

/** Aura reach: a zone band of the scene, or a distance of its own. */
export const AURA_BANDS = {
  close: 'SDM.RangeClose',
  short: 'SDM.RangeShort',
  medium: 'SDM.RangeMedium',
  custom: 'SDM.Aura.CustomDistance'
};
/** An aura's light: none, the aura's own reach, a light preset, or custom. */
export const AURA_LIGHTS = {
  none: 'SDM.Light.Preset.none',
  reach: 'SDM.Aura.LightReach',
  torch: 'SDM.Light.Preset.torch',
  lantern: 'SDM.Light.Preset.lantern',
  candle: 'SDM.Light.Preset.candle',
  glow: 'SDM.Light.Preset.glow',
  custom: 'SDM.Light.Preset.custom'
};
export const ROUND_DAMAGE_TARGETS = {
  inside: 'SDM.RoundDamage.Inside',
  lastFoe: 'SDM.RoundDamage.LastFoe'
};
export const AURA_DISPOSITIONS = {
  allies: 'SDM.Aura.Allies',
  enemies: 'SDM.Aura.Enemies',
  any: 'SDM.Aura.Any'
};

export class SDMActiveEffectData extends foundry.data.ActiveEffectTypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      ...super.defineSchema(),
      isItemMod: new fields.BooleanField({ required: true, initial: false, label: $l10n('SDM.IsItemMod') }),
      // A mod's roll triggers: they join its item's while it is installed (and enabled)
      triggers: defineTriggersField(),
      modType: new fields.StringField({ blank: true, required: false, initial: '', choices: CONFIG.SDM.itemModType, label: $l10n('SDM.ItemModType') }),
      // A mod gained as a hallmark level upgrade: it does not use one of the item's mod slots
      isHallmarkUpgrade: new fields.BooleanField({
        required: true,
        initial: false,
        label: $l10n('SDM.IsHallmarkUpgrade'),
        hint: $l10n('SDM.IsHallmarkUpgradeHint')
      }),
      // Cost of the mod (customization cost = mod cost × number of upgrades, or the item cost if higher)
      modCost: new fields.NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 0,
        label: $l10n('SDM.ItemModCost'),
        hint: $l10n('SDM.ItemModCostHint')
      }),
      // Ride mods priced per capacity ("€500/cap"): the cost is modCost × the ride's capacity
      modCostPerCapacity: new fields.BooleanField({
        required: true,
        initial: false,
        label: $l10n('SDM.ItemModCostPerCapacity'),
        hint: $l10n('SDM.ItemModCostPerCapacityHint')
      }),
      // Aura: the effect radiates from its actor's tokens to other tokens in range (see helpers/auras.mjs)
      aura: new fields.SchemaField({
        enabled: new fields.BooleanField({ required: true, initial: false, label: $l10n('SDM.Aura.Enabled'), hint: $l10n('SDM.Aura.EnabledHint') }),
        // A zone band of the scene (close / short / medium) or a distance of its own
        band: new fields.StringField({ required: true, initial: 'close', choices: AURA_BANDS, label: $l10n('SDM.Aura.Band') }),
        // A reach of its own in grid spaces (squares or hexes beyond the token's edge); distance (world unit)
        // is the older way, still read when spaces is 0
        spaces: new fields.NumberField({ required: true, nullable: false, min: 0, initial: 0, label: $l10n('SDM.Aura.Spaces'), hint: $l10n('SDM.Aura.SpacesHint') }),
        distance: new fields.NumberField({ required: true, nullable: false, min: 0, initial: 0, label: $l10n('SDM.Aura.Distance') }),
        disposition: new fields.StringField({ required: true, initial: 'allies', choices: AURA_DISPOSITIONS, label: $l10n('SDM.Aura.Disposition') }),
        applyToSelf: new fields.BooleanField({ required: true, initial: false, label: $l10n('SDM.Aura.ApplyToSelf'), hint: $l10n('SDM.Aura.ApplyToSelfHint') }),
        canStack: new fields.BooleanField({ required: true, initial: false, label: $l10n('SDM.Aura.CanStack'), hint: $l10n('SDM.Aura.CanStackHint') }),
        bestFormula: new fields.StringField({ required: true, blank: true, initial: '', label: $l10n('SDM.Aura.BestFormula'), hint: $l10n('SDM.Aura.BestFormulaHint') }),
        evaluateOnSource: new fields.BooleanField({ required: true, initial: true, label: $l10n('SDM.Aura.EvaluateOnSource'), hint: $l10n('SDM.Aura.EvaluateOnSourceHint') }),
        walls: new fields.BooleanField({ required: true, initial: true, label: $l10n('SDM.Aura.Walls'), hint: $l10n('SDM.Aura.WallsHint') }),
        combatOnly: new fields.BooleanField({ required: true, initial: false, label: $l10n('SDM.Aura.CombatOnly') }),
        showRadius: new fields.BooleanField({ required: true, initial: false, label: $l10n('SDM.Aura.ShowRadius'), hint: $l10n('SDM.Aura.ShowRadiusHint') }),
        color: new fields.ColorField({ required: false, nullable: true, initial: null, label: $l10n('SDM.Aura.Color') }),
        // Light from the source token (not the copies): the aura's reach, a light preset, or one of its own
        // (bright / dim in grid spaces from the token's middle); its color is the aura's
        lightPreset: new fields.StringField({ required: true, initial: 'none', choices: AURA_LIGHTS, label: $l10n('SDM.Aura.Light'), hint: $l10n('SDM.Aura.LightHint') }),
        lightBright: new fields.NumberField({ required: true, nullable: false, min: 0, initial: 2, label: $l10n('SDM.Aura.LightBright') }),
        lightDim: new fields.NumberField({ required: true, nullable: false, min: 0, initial: 4, label: $l10n('SDM.Aura.LightDim') }),
        lightAnimation: new fields.StringField({
          required: true,
          blank: true,
          initial: '',
          label: $l10n('SDM.Aura.LightAnimation'),
          choices: () => ({ '': '', ...Object.fromEntries(Object.entries(CONFIG.Canvas.lightAnimations ?? {}).map(([key, value]) => [key, value.label ?? key])) })
        })
      }),
      // A form (shapeshifting, helpers/forms.mjs): while on, its actor takes its look, its granted items
      // and its temporary life, and sets its own gear aside as the form says
      form: new fields.SchemaField({
        enabled: new fields.BooleanField({ required: true, initial: false }),
        // The look: shown name, token image, scale and size in squares (blank / 0: unchanged), the portrait too
        name: new fields.StringField({ required: true, blank: true, initial: '' }),
        img: new fields.StringField({ required: true, blank: true, initial: '' }),
        scale: new fields.NumberField({ required: true, nullable: true, min: 0, initial: null }),
        size: new fields.NumberField({ required: true, nullable: true, min: 0, initial: null }),
        portrait: new fields.BooleanField({ required: true, initial: false }),
        // Becomes a creature: an NPC's look, and its attacks and traits when Grants is empty
        creature: new fields.StringField({ required: true, blank: true, initial: '' }),
        // Without an NPC: the form's own defense, speed and ability scores (blank: unchanged)
        defense: new fields.NumberField({ required: true, nullable: true, integer: true, initial: null }),
        speed: new fields.NumberField({ required: true, nullable: true, integer: true, initial: null }),
        abilities: new fields.SchemaField(
          Object.fromEntries(
            Object.keys(CONFIG.SDM.abilities).map(key => [key, new fields.NumberField({ required: true, nullable: true, integer: true, initial: null })])
          )
        ),
        // What it takes from that NPC: its life (as temporary life, when none is set), defense, attack
        // bonus (NPCs in the form), its own damage (a natural attack) and speed
        take: new fields.SchemaField({
          life: new fields.BooleanField({ initial: true }),
          defense: new fields.BooleanField({ initial: true }),
          bonus: new fields.BooleanField({ initial: true }),
          damage: new fields.BooleanField({ initial: true }),
          speed: new fields.BooleanField({ initial: true })
        }),
        // Items added while it lasts (uuids), their uses fresh each time or remembered
        grants: new fields.ArrayField(new fields.StringField({ required: true, blank: false })),
        uses: new fields.StringField({ required: true, blank: false, initial: 'fresh', choices: ['fresh', 'remembered'] }),
        // What of its own the user keeps: everything, the mind only (weapons, armor, wards set aside), nothing
        keeps: new fields.StringField({ required: true, blank: false, initial: 'mind', choices: ['everything', 'mind', 'nothing'] }),
        powers: new fields.StringField({ required: true, blank: false, initial: 'usable', choices: ['usable', 'off'] }),
        // Temporary life (a formula on the user); ends when it runs out
        tempLife: new fields.StringField({ required: true, blank: true, initial: '' }),
        endsAtZero: new fields.BooleanField({ required: true, initial: false })
      }),
      // Damage at the start of each combat round: to the tokens in its aura, or to the last foe its actor attacked
      roundDamage: new fields.SchemaField({
        formula: new fields.StringField({ required: true, blank: true, initial: '', label: $l10n('SDM.RoundDamage.Formula'), hint: $l10n('SDM.RoundDamage.FormulaHint') }),
        target: new fields.StringField({ required: true, initial: 'inside', choices: ROUND_DAMAGE_TARGETS, label: $l10n('SDM.RoundDamage.Target') })
      })
    };
  }
}

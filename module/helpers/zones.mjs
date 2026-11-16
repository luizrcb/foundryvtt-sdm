/**
 * Movement and range zones (When Time Fades: "Movement and Range").
 *
 * The book measures distance in four zones, close / short / medium / long, and in how many rounds it
 * takes to get from one to the next (short: 1 round, medium: 2, long: 3+ and then it's a chase).
 * How many meters a zone is depends on the scene: a house is not a desert. So:
 *  - zone scales (indoor, city, desert, vehicles…) give where close, short and medium end, in meters;
 *    the GM edits them and picks the world default (Zones menu);
 *  - each scene picks a scale and may change any of the three numbers (Scene config, Grid tab);
 *  - distances on the canvas are converted from the scene's grid units (ft, m, mi…).
 * Speed (−3…+2, like mounts and vehicles) is zones per round: normal 1, fast 2, very fast 3,
 * slow 1 every 2 rounds, very slow 1 every 3 rounds… Slowed lowers it by 1 (conditions.mjs).
 *
 * Optional, each with a setting: the target's zone in the attack/power roll dialog, a reminder of the
 * free attack when a token moves away from an adjacent enemy in combat, the token ruler colored
 * by the rounds the move takes, and a Token HUD button that shows the zones around a token (local).
 */

import { ActorType, GearType, ItemType, RollMode } from './constants.mjs';
import { UnarmedDamageItem } from './itemUtils.mjs';

/**
 * Where close, short and medium end, in the world's distance unit (feet or meters, a world setting).
 * Long is anything beyond. Each unit has its own numbers, chosen so the zones cover the same number
 * of squares on the grid each scale is meant for (5 ft = 1.5 m, 30 ft = 10 m…): the game plays the
 * same in feet and in meters, only the numbers on screen differ.
 * A zone is both a range (a short-range weapon hits the short zone) and movement (short is 1 round
 * away), so a scale shrinks for obstacles and tight places but only grows with how fast the fight
 * moves (riding, vehicles, ships, aircraft), never because the place is open: an open desert crossed
 * on foot is On foot, its long sight lines are the long zone, which has no end.
 */
export const ZONE_PRESETS = {
  m: {
    // d20 battlemaps (5 ft squares, 30 ft moves): close = adjacent, short = one move, medium = two
    battlemap: { close: 1.5, short: 9, medium: 18 },
    indoor: { close: 2, short: 6, medium: 15 },
    underground: { close: 2, short: 8, medium: 25 },
    forest: { close: 3, short: 10, medium: 30 },
    // The book's on-foot column
    onFoot: { close: 3, short: 10, medium: 40 },
    mounted: { close: 5, short: 30, medium: 150 },
    // The book's autogolem column
    vehicle: { close: 10, short: 50, medium: 200 },
    ships: { close: 10, short: 30, medium: 150 },
    air: { close: 20, short: 100, medium: 500 }
  },
  ft: {
    battlemap: { close: 5, short: 30, medium: 60 },
    indoor: { close: 5, short: 20, medium: 50 },
    underground: { close: 5, short: 25, medium: 80 },
    forest: { close: 10, short: 30, medium: 100 },
    onFoot: { close: 10, short: 30, medium: 130 },
    mounted: { close: 15, short: 90, medium: 450 },
    vehicle: { close: 30, short: 150, medium: 600 },
    ships: { close: 30, short: 90, medium: 450 },
    air: { close: 60, short: 300, medium: 1500 }
  }
};
export const ZONE_SCALE_KEYS = Object.keys(ZONE_PRESETS.m);
export const DEFAULT_ZONE_SCALE = 'battlemap';
/** Grid size per square each scale is meant for (min, max), per unit: shown and checked in the scene config. */
const SCALE_GRID = {
  m: {
    battlemap: [1.5, 1.5],
    indoor: [1.5, 1.5],
    underground: [1.5, 1.5],
    forest: [1.5, 1.5],
    onFoot: [1.5, 3],
    mounted: [3, 5],
    vehicle: [10, 10],
    ships: [10, 10],
    air: [20, 20]
  },
  ft: {
    battlemap: [5, 5],
    indoor: [5, 5],
    underground: [5, 5],
    forest: [5, 5],
    onFoot: [5, 10],
    mounted: [10, 15],
    vehicle: [30, 30],
    ships: [30, 30],
    air: [60, 60]
  }
};
/** The world's distance unit: 'ft' (default, as the system always set its grid) or 'm'. */
export const DISTANCE_UNITS = ['ft', 'm'];
export function worldUnit() {
  const unit = setting('distanceUnit', 'ft');
  return DISTANCE_UNITS.includes(unit) ? unit : 'ft';
}
const presets = () => ZONE_PRESETS[worldUnit()];
/** A scene's scale "none": a travel map (pointcrawl, region) with no zones at all. */
export const NO_ZONES = 'none';
// Scales renamed before release: city → on foot, open wilds → mounted, sea / air → air
const RENAMED_SCALES = { city: 'onFoot', wilds: 'mounted', sea: 'air' };
const scaleKey = key => RENAMED_SCALES[key] ?? key;
export const ZONE_BANDS = ['close', 'short', 'medium', 'long'];
const LIMITS = ['close', 'short', 'medium'];

const setting = (key, fallback) => {
  try {
    return game.settings.get('sdm', key);
  } catch {
    return fallback;
  }
};
const positive = value => {
  const n = Number(value);
  return value !== null && value !== '' && Number.isFinite(n) && n > 0 ? n : null;
};

/* -------------------------------------------- */
/*  Settings                                    */
/* -------------------------------------------- */

export function registerZoneSettings() {
  game.settings.register('sdm', 'defaultZoneScale', {
    name: 'SDM.Zones.DefaultScale',
    hint: 'SDM.Zones.DefaultScaleHint',
    scope: 'world',
    config: false,
    type: String,
    default: DEFAULT_ZONE_SCALE,
    choices: Object.fromEntries(ZONE_SCALE_KEYS.map(key => [key, `SDM.Zones.Scale.${key}`]))
  });
  // Feet or meters for every zone number, and the grid of new scenes; changing it converts the scenes
  game.settings.register('sdm', 'distanceUnit', {
    name: 'SDM.Zones.Unit',
    hint: 'SDM.Zones.UnitHint',
    scope: 'world',
    config: false,
    type: String,
    default: 'ft',
    choices: { ft: 'SDM.Zones.UnitFt', m: 'SDM.Zones.UnitM' },
    onChange: () => convertWorldUnit()
  });
  // The unit the saved zone numbers (scales table, scene overrides) are written in
  game.settings.register('sdm', 'zoneValuesUnit', {
    scope: 'world',
    config: false,
    type: String,
    default: 'm'
  });
  // Edited in the Zones menu (table of scales, in the world unit); empty: the presets
  game.settings.register('sdm', 'zoneScales', {
    name: 'SDM.Zones.Scales',
    hint: 'SDM.Zones.ScalesHint',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });
  game.settings.register('sdm', 'zoneRangeCheck', {
    name: 'SDM.Zones.RangeCheck',
    hint: 'SDM.Zones.RangeCheckHint',
    scope: 'world',
    config: false,
    type: Boolean,
    default: true
  });
  game.settings.register('sdm', 'freeAttackRulerWarning', {
    name: 'SDM.Zones.RulerWarningSetting',
    hint: 'SDM.Zones.RulerWarningSettingHint',
    scope: 'world',
    config: false,
    type: Boolean,
    default: true
  });
  game.settings.register('sdm', 'freeAttackReminder', {
    name: 'SDM.Zones.FreeAttackSetting',
    hint: 'SDM.Zones.FreeAttackSettingHint',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });
  game.settings.register('sdm', 'zoneHighlight', {
    name: 'SDM.Zones.Highlight',
    hint: 'SDM.Zones.HighlightHint',
    scope: 'world',
    config: false,
    type: Boolean,
    default: true
  });
  game.settings.register('sdm', 'zoneRuler', {
    name: 'SDM.Zones.Ruler',
    hint: 'SDM.Zones.RulerHint',
    scope: 'world',
    config: false,
    type: Boolean,
    default: true
  });
}

/** A scale as the GM configured it (world setting) over the defaults. */
export function getZoneScale(key) {
  const base = presets()[key] ?? presets()[DEFAULT_ZONE_SCALE];
  const configured = setting('zoneScales', {})?.[key] ?? {};
  return sorted(Object.fromEntries(LIMITS.map(limit => [limit, positive(configured[limit]) ?? base[limit]])));
}

/** Zones never shrink outward: short is at least close, medium at least short. */
function sorted(limits) {
  limits.short = Math.max(limits.short, limits.close);
  limits.medium = Math.max(limits.medium, limits.short);
  return limits;
}

export function worldZoneScale() {
  const key = scaleKey(setting('defaultZoneScale', DEFAULT_ZONE_SCALE));
  return ZONE_PRESETS.m[key] ? key : DEFAULT_ZONE_SCALE;
}

/** False on a travel map (scene scale "none"): no ruler colors, range check, free attack note or HUD zones. */
export function zonesActive(scene = canvas?.scene) {
  return scene?.getFlag?.('sdm', 'zones')?.scale !== NO_ZONES;
}

/** The scene's zone limits in the world unit: its scale (or the world's) and any number the scene changed. */
export function sceneZoneLimits(scene = canvas?.scene) {
  const flags = scene?.getFlag?.('sdm', 'zones') ?? {};
  const key = ZONE_PRESETS.m[scaleKey(flags.scale)] ? scaleKey(flags.scale) : worldZoneScale();
  const scale = getZoneScale(key);
  return { scale: key, ...sorted(Object.fromEntries(LIMITS.map(limit => [limit, positive(flags[limit]) ?? scale[limit]]))) };
}

/* -------------------------------------------- */
/*  Distances                                   */
/* -------------------------------------------- */

// Feet use the game convention (5 ft square = 1.5 m), so feet and meters scenes play alike
const METRIC = /^(m|meters?|metres?|metros?)$/;
const IMPERIAL = /^(ft|feet|foot|pes|pés|pe|pé)$/;
const UNIT_METERS = [
  [METRIC, 1],
  [IMPERIAL, 0.3],
  [/^(yd|yds|yards?|jardas?)$/, 0.9144],
  [/^(km|kilometers?|kilometres?|quilometros?|quilômetros?)$/, 1000],
  [/^(mi|miles?|milhas?)$/, 1609.344]
];

const normalUnits = units => `${units ?? ''}`.trim().toLowerCase().replace(/\.$/, '');
const unitMeters = units => UNIT_METERS.find(([pattern]) => pattern.test(normalUnits(units)))?.[1];

/** World units in one of the scene's grid units (unknown units are taken as the world unit). */
export function metersPerUnit(scene = canvas?.scene) {
  const scene_ = unitMeters(scene?.grid?.units);
  return scene_ ? scene_ / unitMeters(worldUnit()) : 1;
}

/** Zone index (0 close … 3 long) of a distance in the world unit. */
export function bandForMeters(distance, limits = sceneZoneLimits()) {
  if (distance <= limits.close) return 0;
  if (distance <= limits.short) return 1;
  if (distance <= limits.medium) return 2;
  return 3;
}

/* -------------------------------------------- */
/*  Changing the world unit                     */
/* -------------------------------------------- */

// Grid sizes that mean the same squares in both units (the suggested grids of the scales)
const GRID_PAIRS = [
  [1.5, 5],
  [3, 10],
  [5, 15],
  [10, 30],
  [20, 60]
];
const round = (value, step) => Math.round(value / step) * step;

/** A distance from one unit to the other: the matching grid size, else the convention (1 ft = 0.3 m). */
function convertDistance(value, from, to) {
  if (from === to) return value;
  const pair = GRID_PAIRS.find(([m, ft]) => (from === 'm' ? m : ft) === value);
  if (pair) return to === 'm' ? pair[0] : pair[1];
  return to === 'ft' ? round(value / 0.3, value / 0.3 >= 20 ? 5 : 0.5) : round(value * 0.3, 0.1);
}

/** A zone number: the other unit's preset when it was the preset, else converted. */
function convertLimit(value, key, limit, from, to) {
  const n = positive(value);
  if (n === null) return value;
  if (ZONE_PRESETS[from]?.[key]?.[limit] === n) return ZONE_PRESETS[to][key][limit];
  return convertDistance(n, from, to);
}

/**
 * The world unit changed (or the saved numbers are in another unit): convert the scales table, each
 * scene's zone numbers and (`scenes`) the grid of every scene in feet or meters. The active GM does
 * it, once. Worlds from before the setting only get their zone numbers converted: their scenes are
 * left as they are until the GM changes the unit.
 */
export async function convertWorldUnit({ scenes = true } = {}) {
  if (!game.user?.isGM || game.users.activeGM !== game.user) return;
  const to = worldUnit();
  const from = setting('zoneValuesUnit', 'm');
  const sameUnit = from === to;
  if (!sameUnit) {
    const table = foundry.utils.deepClone(setting('zoneScales', {}) ?? {});
    for (const [key, values] of Object.entries(table)) {
      for (const limit of LIMITS) values[limit] = convertLimit(values?.[limit], scaleKey(key), limit, from, to);
    }
    await game.settings.set('sdm', 'zoneScales', table);
  }
  const pattern = to === 'm' ? IMPERIAL : METRIC;
  const updates = [];
  for (const scene of game.scenes) {
    const update = { _id: scene.id };
    const sceneFrom = scenes && pattern.test(normalUnits(scene.grid?.units)) ? (to === 'm' ? 'ft' : 'm') : null;
    if (sceneFrom) {
      update['grid.distance'] = convertDistance(Number(scene.grid.distance) || 0, sceneFrom, to);
      update['grid.units'] = to;
    }
    const flags = scene.getFlag('sdm', 'zones');
    if (!sameUnit && flags) {
      const key = ZONE_PRESETS.m[scaleKey(flags.scale)] ? scaleKey(flags.scale) : worldZoneScale();
      for (const limit of LIMITS) {
        if (positive(flags[limit]) !== null) update[`flags.sdm.zones.${limit}`] = convertLimit(flags[limit], key, limit, from, to);
      }
    }
    if (Object.keys(update).length > 1) updates.push(update);
  }
  if (updates.length) await Scene.updateDocuments(updates);
  if (!sameUnit) await game.settings.set('sdm', 'zoneValuesUnit', to);
  if (updates.length || !sameUnit) ui.notifications?.info(game.i18n.format('SDM.Zones.UnitConverted', { unit: to, count: updates.length }));
}

/** New scenes take the world unit's grid (1.5 m) when they come with the system's default (5 ft). */
function onPreCreateScene(scene, data) {
  if (worldUnit() !== 'm' || foundry.utils.hasProperty(data, 'grid.units')) return;
  if (IMPERIAL.test(normalUnits(scene.grid?.units))) {
    scene.updateSource({ 'grid.distance': convertDistance(Number(scene.grid.distance) || 5, 'ft', 'm'), 'grid.units': 'm' });
  }
}

const tokenSize = doc => Math.max(Number(doc?.width) || 1, Number(doc?.height) || 1);

function centerOf(doc, x = doc.x, y = doc.y) {
  const grid = canvas.grid;
  return {
    x: x + ((Number(doc.width) || 1) * grid.sizeX) / 2,
    y: y + ((Number(doc.height) || 1) * grid.sizeY) / 2
  };
}

/** Distance in scene units between two token documents, edge to edge (big tokens reach further). */
function unitsBetween(docA, centerA, docB, centerB) {
  const path = canvas.grid.measurePath([centerA, centerB]);
  const reach = ((tokenSize(docA) - 1 + (tokenSize(docB) - 1)) / 2) * canvas.grid.distance;
  return Math.max(0, (path?.distance ?? 0) - reach);
}

/** The actor's token on the current scene (a controlled one first). */
export function tokenFor(actor) {
  if (!actor || !canvas?.ready) return null;
  const controlled = canvas.tokens.controlled.find(token => token.actor === actor);
  return controlled ?? actor.getActiveTokens?.(false, false)?.[0] ?? null;
}

/** { band, units, meters } from one token to another on the current scene, or null. */
export function measureTokens(source, target) {
  if (!canvas?.ready || !source?.document || !target?.document) return null;
  if (source.document.parent !== canvas.scene || target.document.parent !== canvas.scene) return null;
  const units = unitsBetween(source.document, centerOf(source.document), target.document, centerOf(target.document));
  const meters = units * metersPerUnit();
  return { band: bandForMeters(meters), units, meters };
}

/* -------------------------------------------- */
/*  Speed                                       */
/* -------------------------------------------- */

/** Zones per round for a speed value: 0 → 1, +1 → 2, −1 → ½, −2 → ⅓… */
export function zonesPerRound(speed = 0) {
  const s = Math.round(Number(speed) || 0);
  return s >= 0 ? 1 + s : 1 / (1 - s);
}

/** Rounds to cross into a zone (0 close … 3 long) at a speed. */
export function roundsToBand(band, speed = 0) {
  if (band <= 0) return 0;
  return Math.ceil(band / zonesPerRound(speed) - 1e-9);
}

/** Speed name (Normal, Slow…) and what it means in zones. */
export function describeSpeed(speed = 0) {
  const s = Math.round(Number(speed) || 0);
  const clamped = Math.min(Math.max(s, -3), 2);
  // "Very Slow (-2)" → "Very Slow": the number is for the select, the sheet shows the name
  const name = game.i18n
    .localize(CONFIG.SDM.reverseSpeedValues?.[`${clamped}`] ?? 'SDM.SpeedStandard')
    .replace(/\s*\([^()]*\)\s*$/, '');
  let zones;
  if (s > 0) zones = game.i18n.format('SDM.Zones.SpeedZones', { zones: 1 + s });
  else if (s === 0) zones = game.i18n.localize('SDM.Zones.SpeedOneZone');
  else zones = game.i18n.format('SDM.Zones.SpeedEvery', { rounds: 1 - s });
  return { value: s, name, zones, hint: `${name}: ${zones}` };
}

/** Context for the speed field on actor sheets (`speed.hbs`). */
export function speedContext(actor) {
  const effective = Math.round(Number(actor.system?.speed) || 0);
  const source = Math.round(Number(actor._source?.system?.speed) || 0);
  const described = describeSpeed(effective);
  return {
    ...described,
    source,
    slowed: effective < source,
    // An array keeps the order by value (object keys like "-1" would sort after "0", "1", "2")
    choices: Object.entries(CONFIG.SDM.reverseSpeedValues ?? {})
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([value, label]) => ({ value, label }))
  };
}

/* -------------------------------------------- */
/*  Range in the roll dialog                    */
/* -------------------------------------------- */

const esc = text => foundry.utils.escapeHTML(String(text ?? ''));
const bandLabel = index => game.i18n.localize(CONFIG.SDM.rangeType?.[ZONE_BANDS[index]] ?? ZONE_BANDS[index]);

const isWeaponItem = item => item.system?.type === GearType.WEAPON || !!item.system?.features?.has?.('weapon');
const isUnarmed = item =>
  item._stats?.compendiumSource === UnarmedDamageItem || item.getFlag?.('sdm', 'fromCompendium') === UnarmedDamageItem;

/**
 * What the actor has readied and can use, and its range: weapons (no range = close), powers and the
 * selected power of a power album — not broken items, nor run-out ones unless they work run out. Traits are always readied; of them, power traits are listed (traits have no
 * features). Unarmed Damage is always listed and fits any of the four attacks: close in a melee attack,
 * short in the others (`attack` given), no range otherwise.
 */
export function attackItems(actor, attack = '') {
  const entries = [];
  const bandOf = range => {
    const band = ZONE_BANDS.indexOf(`${range ?? ''}`.trim().toLowerCase());
    return band >= 0 ? band : null;
  };
  const has = (item, feature) => !!item.system?.features?.has?.(feature);
  // What the item rolls: a weapon's damage (one-handed / two-handed when versatile), a power's roll
  const weaponRoll = item => {
    const damage = item.system?.weapon?.damage ?? {};
    const versatile = item.system?.weapon?.versatile || has(item, 'versatile');
    return [damage.base, versatile ? damage.versatile : ''].filter(Boolean).join(' / ');
  };
  for (const item of actor?.items ?? []) {
    // Unarmed Damage: always at hand; fists in melee (close), something thrown, a gesture or a device
    // at hand in the other attacks (short)
    if (isUnarmed(item)) {
      const band = attack ? (attack === 'melee' ? 0 : 1) : null;
      entries.push({ id: item.id, name: item.name, kind: 'weapon', band, unarmed: true, roll: weaponRoll(item), img: item.img });
      continue;
    }
    // Gear counts when readied; traits are always readied, and only power traits can be used
    const isTrait = item.type === ItemType.TRAIT;
    if (isTrait ? item.system.type !== GearType.POWER : !item.system?.readied) continue;
    // Like the inventory's roll buttons: a broken item can't be used, and a run-out one only when it
    // works run out (and then not its album's powers)
    const runOut = item.system.resources === 'run_out';
    if (item.system.status === 'broken' || (runOut && !item.system.works_when_run_out)) continue;
    if (item.system.type === GearType.POWER) {
      entries.push({
        id: item.id,
        name: item.name,
        kind: 'power',
        band: bandOf(item.system.power?.range),
        fantascience: true,
        roll: item.system.power?.roll_formula ?? ''
      });
      continue;
    }
    // Powers held by gear: a power album, or any gear with the album feature (its selected power).
    // Gear that is also a weapon gets a second entry for its power ("<id>:album")
    const albumPowers = item.system.type === GearType.POWER_ALBUM || has(item, 'album') ? item.system.powers ?? [] : [];
    const albumPower = albumPowers[item.system.powers_current_index] ?? albumPowers[0];
    const isAlbum = item.system.type === GearType.POWER_ALBUM;
    if (albumPower && !runOut) {
      entries.push({
        id: isAlbum ? item.id : `${item.id}:album`,
        itemId: item.id,
        name: isAlbum ? albumPower.name || item.name : `${albumPower.name || item.name} (${item.name})`,
        kind: 'album',
        band: bandOf(albumPower.range),
        fantascience: true,
        roll: albumPower.roll_formula ?? ''
      });
    }
    if (!isAlbum && isWeaponItem(item) && !isUnarmed(item)) {
      entries.push({
        id: item.id,
        name: item.name,
        kind: 'weapon',
        // A weapon without a range is a close-combat weapon
        band: bandOf(item.system.weapon?.range) ?? 0,
        roll: weaponRoll(item),
        throwing: has(item, 'throwing'),
        oldtech: has(item, 'oldtech'),
        fantascience: has(item, 'fantascience')
      });
    }
  }
  // The item behind each entry, and its image (shown next to the attack dialog's selector)
  for (const entry of entries) {
    entry.itemId ??= entry.id;
    entry.img ??= actor.items.get(entry.itemId)?.img ?? '';
  }
  return entries;
}

// What fits each attack (suggestions): fantascience and oldtech weapons are used through those
// attacks, so melee and ranged never suggest them (they can still be picked); oldtech attacks use
// oldtech items and powers too
const ATTACK_FITS = {
  melee: e => e.kind === 'weapon' && e.band === 0 && !e.fantascience && !e.oldtech,
  ranged: e => e.kind === 'weapon' && e.band >= 1 && !e.fantascience && !e.oldtech,
  fantascience: e => e.fantascience,
  oldtech: e => e.oldtech || e.kind !== 'weapon'
};

/**
 * Is this item a good one for that attack against the current target: it fits the attack (as the
 * suggestion sees it, unarmed never) and, with a target, reaches it. Switch to Ranged keeps the item
 * chosen in melee only then (a bow yes; a sword, fists or a short bow at long range no).
 */
export function itemSuitsAttack(actor, attack, itemId) {
  const entry = attackItems(actor, attack).find(e => e.id === itemId);
  if (!entry || entry.unarmed || !(ATTACK_FITS[attack] ?? (() => true))(entry)) return false;
  const target = Array.from(game.user.targets ?? [])[0];
  const source = tokenFor(actor);
  const measured = target && source && target !== source ? measureTokens(source, target) : null;
  return !measured || entry.band === null || entry.band >= measured.band;
}

/**
 * The item an attack is made with, preselected in the attack dialog: the attack's favorite (if it is
 * still readied), else a suggestion — with a target, the first fitting item that reaches it; else the
 * first that fits the attack (melee: a close weapon; ranged: a weapon of short range or more;
 * fantascience: a power or fantascience item; oldtech: an oldtech item or a power), and Unarmed Damage
 * only when nothing else fits. '' = not chosen.
 */
export function suggestAttackItem(actor, attack, entries = attackItems(actor, attack)) {
  // NPCs attack with their own damage by default (items can still be picked)
  if (actor?.type === ActorType.NPC) return '';
  const favorite = actor?.system?.[attack]?.favorite_item;
  if (favorite && entries.some(e => e.id === favorite)) return favorite;
  const fits = ATTACK_FITS[attack] ?? (() => true);
  // Unarmed is the last resort: suggested only when nothing else fits
  const unarmed = entries.find(e => e.unarmed);
  entries = entries.filter(e => !e.unarmed);
  const preferred = entries.filter(fits);
  const target = Array.from(game.user.targets ?? [])[0];
  const source = tokenFor(actor);
  const measured = target && source && target !== source ? measureTokens(source, target) : null;
  if (measured) {
    const reaches = e => e.band === null || e.band >= measured.band;
    // Fantascience and oldtech need an item that fits (its feature, or a power): no plain weapon
    const fallback = ['fantascience', 'oldtech'].includes(attack)
      ? null
      : entries.find(e => reaches(e) && !e.fantascience && !e.oldtech);
    const pick = preferred.find(reaches) ?? fallback;
    if (pick) return pick.id;
  }
  return preferred[0]?.id ?? unarmed?.id ?? '';
}

/**
 * How far a target is beyond a range (0 close … 3 long): 1 zone beyond → disadvantage suggested,
 * 2 or more → it doesn't reach; a thrown weapon beyond short (within its range) → disadvantage
 * suggested. Returns { beyond, mode, note } or null without a target or a known range.
 */
function rangeAdvice(measuredBand, rangeBand, throwing = false) {
  if (rangeBand === null || rangeBand === undefined || rangeBand < 0) return null;
  const beyond = measuredBand - rangeBand;
  const range = bandLabel(rangeBand);
  if (beyond >= 2) return { beyond, mode: null, note: game.i18n.format('SDM.Zones.OutOfRangeFar', { range }) };
  if (beyond === 1) return { beyond, mode: RollMode.DISADVANTAGE, note: game.i18n.format('SDM.Zones.OutOfRangeOne', { range }) };
  if (throwing && measuredBand > 1) return { beyond: 0, mode: RollMode.DISADVANTAGE, note: game.i18n.localize('SDM.Zones.ThrowingPenalty') };
  return null;
}

/** The roll mode suggested for attacking the current target with an item entry (attackItems), or null. */
export function attackRangeRollMode(actor, entry, attack = '') {
  if (!entry || !setting('zoneRangeCheck', true) || !zonesActive()) return null;
  const target = Array.from(game.user.targets ?? [])[0];
  const source = tokenFor(actor);
  const measured = target && source && target !== source ? measureTokens(source, target) : null;
  if (!measured) return null;
  // A melee attack reaches close, whatever the item: beyond it the attack is the wrong one, not harder
  if (attack === 'melee' && measured.band > 0) return null;
  return rangeAdvice(measured.band, entry.band, entry.throwing)?.mode ?? null;
}

/**
 * A row for the roll preview: the target's zone and, when the weapon or power has a range, whether
 * it reaches (the attack dialog's With list shows each item's range). No penalty is applied: the book
 * leaves modifiers to the Referee. `melee`: a melee attack, which reaches close whatever the item
 * (a bow swung at someone): beyond close it says to use the ranged attack, with a Switch to Ranged
 * button when `switchToRanged` (the attack dialog handles it).
 */
export function targetRangeHtml(actor, { range = '', throwing = false, melee = false, switchToRanged = false, rangedAbility = '' } = {}) {
  if (!setting('zoneRangeCheck', true) || !zonesActive()) return '';
  const target = Array.from(game.user.targets ?? [])[0];
  const source = tokenFor(actor);
  if (!target || !source || target === source) return '';
  const measured = measureTokens(source, target);
  if (!measured) return '';
  const units = canvas.scene.grid.units ?? '';
  const shown = `${bandLabel(measured.band)} · ~${Math.round(measured.units * 10) / 10}${units ? ` ${units}` : ''}`;
  const max = ZONE_BANDS.indexOf(`${range ?? ''}`.trim().toLowerCase());
  const meleeTooFar = melee && measured.band > 0;
  const note = meleeTooFar
    ? game.i18n.format(rangedAbility ? 'SDM.Zones.MeleeOnlyCloseAbility' : 'SDM.Zones.MeleeOnlyClose', {
        name: target.name,
        zone: bandLabel(measured.band),
        ability: rangedAbility
      })
    : null;
  const advice = meleeTooFar ? null : rangeAdvice(measured.band, max >= 0 ? max : null, throwing);
  const shownNote = note ?? advice?.note ?? '';
  // A penalty suggested (disadvantage, or the Bonus and Penalty row's -1 / -6 / -1d6 instead)
  const penalty = advice?.mode === RollMode.DISADVANTAGE;
  const switchButton =
    meleeTooFar && switchToRanged
      ? ` <button type="button" class="sdm-switch-ranged"><i class="fa-solid fa-bullseye"></i> ${esc(game.i18n.localize('SDM.Zones.SwitchToRanged'))}</button>`
      : '';
  return (
    `<div class="sdm-roll-preview-row sdm-range-row${shownNote ? ' warn' : ''}${penalty ? ' penalty' : ''}">` +
    `<span>${esc(game.i18n.format('SDM.Zones.Target', { name: target.name }))}</span> <code>${esc(shown)}</code>` +
    (shownNote ? `<div class="sdm-range-note"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(shownNote)}${switchButton}</div>` : '') +
    `</div>`
  );
}

/* -------------------------------------------- */
/*  Free attack when disengaging                */
/* -------------------------------------------- */

// The adversary can't take the free attack (the conditions' own rules: can't act, unplayable)
const OUT_OF_FIGHT = ['dead', 'unconscious', 'sleep', 'paralysis', 'petrified', 'stun', 'mad'];
// The adversary's attacks have disadvantage (blinded, poisoned, prone, confused; nauseated: physical rolls)
const ATTACKS_WITH_DISADVANTAGE = ['blind', 'poison', 'prone', 'confused', 'nauseated'];
// Compendium traits with a rule about it: Springer jumps away after attacking without provoking it;
// Eerie Sense isn't fooled by invisibility
const SPRINGER = { key: 'SDM.NPCTraitSpringer', uuid: 'Compendium.sdm.npc_traits.Item.zjxXwFmJSugiYpCA', names: ['springer', 'saltador'] };
const EERIE_SENSE = { uuid: 'Compendium.sdm.npc_extras.Item.Sovrg4bu8g5PO3X3', names: ['eerie sense', 'sentido estranho'] };

function hasTrait(actor, { key, uuid, names = [] }) {
  return !!actor?.items?.some(
    item =>
      (key && item.getFlag?.('sdm', 'npcTraitKey') === key) ||
      (uuid && item._stats?.compendiumSource === uuid) ||
      names.includes(`${item.name ?? ''}`.trim().toLowerCase())
  );
}

const conditionName = id => game.i18n.localize(`SDM.Condition.${id}.Name`).toLowerCase();

/* -------------------------------------------- */
/*  Reach ("longer, so it attacks first in close combat")                  */
/* -------------------------------------------- */

/** A readied weapon with the reach feature (traits have no features). */
export function hasReach(actor) {
  return !!actor?.items?.some(item => item.system?.readied && item.system?.features?.has?.('reach'));
}

/** Can this actor act (strike first)? Not dead, unconscious, asleep, stunned, paralyzed, petrified or mad. */
const canAct = actor => !OUT_OF_FIGHT.some(id => actor?.statuses?.has(id));

/**
 * Adversaries with reach whose close zone a token enters going from one position to another, in a
 * started combat: they strike first. Not when the token has reach too. Same rules as the free attack.
 */
function reachEntered(doc, from, to) {
  if (!canvas?.ready || doc.parent !== canvas.scene || !zonesActive() || hasReach(doc.actor)) return [];
  const combat = game.combat;
  if (!combat?.started || !combat.combatants.some(c => c.tokenId === doc.id)) return [];
  const limits = sceneZoneLimits();
  const perUnit = metersPerUnit();
  const start = centerOf(doc, from.x, from.y);
  const end = centerOf(doc, to.x, to.y);
  const found = [];
  for (const other of doc.parent.tokens) {
    if (other === doc || other.disposition === doc.disposition || (other.hidden && !game.user.isGM)) continue;
    if (!hasReach(other.actor) || !canAct(other.actor)) continue;
    if (combat.combatants.find(c => c.tokenId === other.id)?.isDefeated) continue;
    const before = unitsBetween(doc, start, other, centerOf(other)) * perUnit;
    const after = unitsBetween(doc, end, other, centerOf(other)) * perUnit;
    if (before > limits.close && after <= limits.close) found.push({ token: other, details: [] });
  }
  return found;
}

/**
 * Already in close combat: a melee attack (by an attacker without reach) on an adversary with reach
 * whose turn hasn't come yet this round — the reach wielder strikes first. The note, or ''.
 */
export function reachFirstNote(actor, targetActor, { attack = '', attackerHasReach = null } = {}) {
  if (!actor || !targetActor || attack !== 'melee') return '';
  if (attackerHasReach ?? hasReach(actor)) return '';
  if (!hasReach(targetActor) || !canAct(targetActor)) return '';
  const combat = game.combat;
  if (!combat?.started) return '';
  const combatant = combat.combatants.find(c => c.actor === targetActor || (c.token?.actor ?? null) === targetActor);
  if (!combatant || combatant.isDefeated) return '';
  const index = combat.turns.findIndex(c => c.id === combatant.id);
  if (index < 0 || index <= combat.turn) return '';
  return game.i18n.format('SDM.Zones.ReachFirst', { name: targetActor.name });
}

/**
 * Enemies whose close zone a token leaves going from one position (top-left x, y) to another, in a
 * started combat on the current scene, each as { token, details }. Tokens of the same disposition are
 * allies; any other disposition (friendly, neutral, hostile, secret) is an adversary. Hidden tokens
 * only count for the Referee (a player never learns of them this way); defeated ones and those that
 * can't act are left out, and a flying token gets out of reach of an adversary that doesn't fly.
 * `details` says why the attack is harder: the adversary's conditions with disadvantage, the token
 * invisible (unless the adversary has Eerie Sense), the adversary frightened (it may not attack).
 */
function enemiesLeft(doc, from, to) {
  if (!canvas?.ready || doc.parent !== canvas.scene || !zonesActive()) return [];
  const combat = game.combat;
  if (!combat?.started || !combat.combatants.some(c => c.tokenId === doc.id)) return [];
  const limits = sceneZoneLimits();
  const perUnit = metersPerUnit();
  const start = centerOf(doc, from.x, from.y);
  const end = centerOf(doc, to.x, to.y);
  const enemies = [];
  for (const other of doc.parent.tokens) {
    if (other === doc || other.disposition === doc.disposition || (other.hidden && !game.user.isGM)) continue;
    const statuses = other.actor?.statuses ?? new Set();
    if (OUT_OF_FIGHT.some(id => statuses.has(id))) continue;
    if (combat.combatants.find(c => c.tokenId === other.id)?.isDefeated) continue;
    if (doc.actor?.statuses?.has('fly') && !statuses.has('fly')) continue;
    const before = unitsBetween(doc, start, other, centerOf(other)) * perUnit;
    const after = unitsBetween(doc, end, other, centerOf(other)) * perUnit;
    if (before <= limits.close && after > limits.close) {
      const harder = ATTACKS_WITH_DISADVANTAGE.filter(id => statuses.has(id)).map(conditionName);
      if (doc.actor?.statuses?.has('invisible') && !hasTrait(other.actor, EERIE_SENSE)) harder.push(conditionName('invisible'));
      const details = [];
      // The adversary's attack has the disadvantage (its conditions, or the token moving away invisible)
      if (harder.length) details.push(game.i18n.format('SDM.Zones.FreeAttackDisadvantage', { name: other.name, reasons: harder.join(', ') }));
      // Frightened: it may not attack; an NPC tests its morale (characters have no morale)
      if (statuses.has('fear')) {
        details.push(game.i18n.localize(other.actor?.type === ActorType.NPC ? 'SDM.Zones.FreeAttackFrightenedNpc' : 'SDM.Zones.FreeAttackFrightened'));
      }
      enemies.push({ token: other, details });
    }
  }
  return enemies;
}

/** "Bob (disadvantage: blinded), Ana" and, for a Springer, that jumping away after attacking is safe. */
function describeEnemies(doc, enemies) {
  const names = enemies.map(({ token, details }) => (details.length ? `${token.name} (${details.join('; ')})` : token.name));
  let text = new Intl.ListFormat(game.i18n.lang, { type: 'conjunction' }).format(names);
  if (hasTrait(doc.actor, SPRINGER)) text += ` · ${game.i18n.localize('SDM.Zones.FreeAttackSpringer')}`;
  return text;
}

// Enemies already noted this turn, per moving token: "combat.round.turn.token" → Set of enemy ids
const noted = new Map();

/**
 * Optional (off by default): on the moving token's own turn, a note whispered to the Referee that the
 * enemies it moved away from may make a free attack if it disengaged carelessly; once per enemy per
 * turn. The ruler warns the player before the move (see the token ruler below).
 */
function onPreUpdateToken(doc, changes, options, userId) {
  if (userId !== game.user.id || !('x' in changes || 'y' in changes)) return;
  if (!setting('freeAttackReminder', false)) return;
  const combat = game.combat;
  if (!combat?.started || combat.combatant?.tokenId !== doc.id) return;
  const destination = { x: changes.x ?? doc.x, y: changes.y ?? doc.y };
  const enemies = enemiesLeft(doc, doc, destination);
  // Closing in on an adversary with reach: it strikes first (noted once per turn too)
  const reach = reachEntered(doc, doc, destination);
  const key = `${combat.id}.${combat.round}.${combat.turn}.${doc.id}`;
  if (!noted.has(key)) {
    noted.clear();
    noted.set(key, new Set());
  }
  const seen = noted.get(key);
  const freshReach = reach.filter(({ token }) => !seen.has(`reach.${token.id}`));
  freshReach.forEach(({ token }) => seen.add(`reach.${token.id}`));
  if (freshReach.length) {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ token: doc }),
      whisper: game.users.filter(user => user.isGM).map(user => user.id),
      content: `<p><i class="fa-solid fa-arrows-left-right-to-line"></i> ${esc(game.i18n.format('SDM.Zones.ReachEntered', { name: doc.name, enemies: describeEnemies(doc, freshReach) }))}</p>`
    });
  }
  const fresh = enemies.filter(({ token }) => !seen.has(token.id));
  if (!fresh.length) return;
  fresh.forEach(({ token }) => seen.add(token.id));
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ token: doc }),
    whisper: game.users.filter(user => user.isGM).map(user => user.id),
    content: `<p><i class="fa-solid fa-person-running"></i> ${esc(game.i18n.format('SDM.Zones.FreeAttack', { name: doc.name, enemies: describeEnemies(doc, fresh) }))}</p>`
  });
}

/**
 * The ruler's warning at a waypoint of the move being planned: going there from where the token
 * stands leaves an enemy's close zone. Waypoints already walked this turn (stage "passed") get none.
 */
function freeAttackWarning(token, waypoint) {
  if (!setting('freeAttackRulerWarning', true) || !token?.document || !waypoint) return '';
  if (waypoint.stage === 'passed' || !Number.isFinite(waypoint.x) || !Number.isFinite(waypoint.y)) return '';
  const doc = token.document;
  if (waypoint.x === doc.x && waypoint.y === doc.y) return '';
  const enemies = enemiesLeft(doc, doc, waypoint);
  const reach = reachEntered(doc, doc, waypoint);
  return [
    enemies.length ? game.i18n.format('SDM.Zones.RulerWarning', { enemies: describeEnemies(doc, enemies) }) : '',
    reach.length ? game.i18n.format('SDM.Zones.RulerReach', { enemies: describeEnemies(doc, reach) }) : ''
  ]
    .filter(Boolean)
    .join(' ⚠ ');
}

/* -------------------------------------------- */
/*  Token ruler                                 */
/* -------------------------------------------- */

const RULER_COLORS = [0x3fb950, 0x3fb950, 0xd29922, 0xf85149];

/** Color by the rounds the move takes at the token's speed: this round, next round, 3+ (a chase). */
function zoneStyle(token, waypoint, style) {
  if (!style || !setting('zoneRuler', true) || !token?.actor || !zonesActive(token.scene)) return style;
  const units = Number(waypoint?.measurement?.distance) || 0;
  const band = bandForMeters(units * metersPerUnit());
  const rounds = roundsToBand(band, token.actor.system?.speed);
  return { ...style, color: RULER_COLORS[Math.min(rounds, 3)] };
}

function registerZoneRuler() {
  const Base = foundry.canvas?.placeables?.tokens?.TokenRuler;
  if (!Base) return;
  class SdmTokenRuler extends Base {
    _getGridHighlightStyle(waypoint, offset) {
      return zoneStyle(this.token, waypoint, super._getGridHighlightStyle(waypoint, offset));
    }

    _getSegmentStyle(waypoint) {
      return zoneStyle(this.token, waypoint, super._getSegmentStyle(waypoint));
    }

    // The label of a waypoint whose path leaves an enemy's close zone carries a warning
    _getWaypointLabelContext(waypoint, state) {
      const context = super._getWaypointLabelContext(waypoint, state);
      if (!context) return context;
      const warning = freeAttackWarning(this.token, waypoint);
      if (warning) {
        // The label prints the cost's units when there is a cost (v14 movement), else the units
        if (context.cost) context.cost = { ...context.cost, units: `${context.cost.units ?? ''} ⚠ ${warning}` };
        else context.units = `${context.units ?? ''} ⚠ ${warning}`;
        context.cssClass = `${context.cssClass ?? ''} sdm-free-attack-warning`.trim();
      }
      return context;
    }
  }
  CONFIG.Token.rulerClass = SdmTokenRuler;
}

/* -------------------------------------------- */
/*  Zones around a token (Token HUD)            */
/* -------------------------------------------- */

/** Close, short, medium; long is left uncolored. */
const ZONE_COLORS = [0x3fb950, 0xd29922, 0xe8731c];
const ZONE_ALPHA = 0.22;
// Above this many grid cells the zones are drawn as shapes instead (huge scales, e.g. sea / air)
const MAX_CELLS = 20000;
const shown = new Map(); // token id → PIXI.Graphics | null (grid highlight layer)

const layerName = id => `sdm-zones-${id}`;

function clearZones(id) {
  if (!shown.has(id)) return;
  const graphics = shown.get(id);
  shown.delete(id);
  graphics?.destroy?.();
  try {
    canvas.interface?.grid?.destroyHighlightLayer?.(layerName(id));
  } catch {
    /* the canvas may already be torn down */
  }
}

function clearAllZones() {
  for (const id of [...shown.keys()]) clearZones(id);
}

/** Draw the zones around a token: grid cells (measured like attacks) or, if too many, shapes. */
function drawZones(token) {
  const id = token.id;
  const previous = shown.get(id);
  previous?.destroy?.();
  canvas.interface.grid.destroyHighlightLayer?.(layerName(id));
  shown.set(id, null);

  const grid = canvas.grid;
  const limits = sceneZoneLimits();
  const perUnit = metersPerUnit();
  // Measured edge to edge (like attacks): a big token reaches further
  const reach = ((tokenSize(token.document) - 1) / 2) * grid.distance;
  const maxUnits = limits.medium / perUnit + reach;
  // From the document: the final position, even while the token is still animating there
  const doc = token.document;
  const center = centerOf(doc);
  const bounds = new PIXI.Rectangle(doc.x, doc.y, (Number(doc.width) || 1) * grid.sizeX, (Number(doc.height) || 1) * grid.sizeY);
  const radius = Math.ceil(maxUnits / grid.distance) + 1;

  if (!grid.isGridless && (2 * radius + 1) ** 2 <= MAX_CELLS) {
    const name = layerName(id);
    canvas.interface.grid.addHighlightLayer(name);
    const origin = grid.getOffset(center);
    for (let i = origin.i - radius; i <= origin.i + radius; i++) {
      for (let j = origin.j - radius; j <= origin.j + radius; j++) {
        const cell = grid.getCenterPoint({ i, j });
        if (bounds.contains(cell.x, cell.y)) continue;
        const units = Math.max(0, (grid.measurePath([center, cell])?.distance ?? 0) - reach);
        const band = bandForMeters(units * perUnit, limits);
        if (band > 2) continue;
        const { x, y } = grid.getTopLeftPoint({ i, j });
        canvas.interface.grid.highlightPosition(name, { x, y, color: ZONE_COLORS[band], alpha: ZONE_ALPHA });
      }
    }
    return;
  }

  // Gridless or huge: rings (medium, short, close; each drawn over the larger one)
  const pxPerUnit = grid.size / grid.distance;
  const graphics = new PIXI.Graphics();
  for (let band = 2; band >= 0; band--) {
    const units = limits[LIMITS[band]] / perUnit + reach;
    graphics.lineStyle(3, ZONE_COLORS[band], 0.8).beginFill(ZONE_COLORS[band], ZONE_ALPHA / 2);
    graphics.drawCircle(center.x, center.y, units * pxPerUnit + grid.size / 2);
    graphics.endFill();
  }
  canvas.interface.addChild(graphics);
  shown.set(id, graphics);
}

function toggleZones(token) {
  if (shown.has(token.id)) clearZones(token.id);
  else drawZones(token);
  return shown.has(token.id);
}

function onRenderTokenHUDZones(hud, html) {
  if (!setting('zoneHighlight', true) || !zonesActive()) return;
  const token = hud?.object;
  const root = html?.querySelectorAll ? html : html?.[0];
  if (!token || !root || root.querySelector('.sdm-zones-toggle')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.classList.add('control-icon', 'sdm-zones-toggle');
  if (shown.has(token.id)) button.classList.add('active');
  const label = game.i18n.localize('SDM.Zones.HighlightButton');
  button.dataset.tooltip = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = '<i class="fa-solid fa-ruler-combined" inert></i>';
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    button.classList.toggle('active', toggleZones(token));
  });
  (root.querySelector('.col.left') ?? root).append(button);
}

/** Keep the zones on the token as it moves; drop them when it is released or removed. */
function setupZoneHighlight() {
  Hooks.on('renderTokenHUD', onRenderTokenHUDZones);
  Hooks.on('updateToken', (doc, changes) => {
    if (!shown.has(doc.id) || !['x', 'y', 'width', 'height'].some(key => key in changes)) return;
    const token = doc.object;
    if (!token || doc.parent !== canvas.scene) return clearZones(doc.id);
    drawZones(token);
  });
  Hooks.on('controlToken', (token, controlled) => {
    if (!controlled) clearZones(token.id);
  });
  Hooks.on('deleteToken', doc => clearZones(doc.id));
  Hooks.on('canvasTearDown', () => shown.clear());
  // The scene's zone scale or grid changed: redraw
  Hooks.on('updateScene', (scene, changes) => {
    if (scene !== canvas.scene || !(foundry.utils.hasProperty(changes, 'flags.sdm') || 'grid' in changes)) return;
    for (const id of [...shown.keys()]) {
      const token = canvas.tokens.get(id);
      // A travel map (scale "none") has no zones
      if (token && zonesActive(scene)) drawZones(token);
      else clearZones(id);
    }
  });
}

/* -------------------------------------------- */
/*  Scene config                                */
/* -------------------------------------------- */

/** "Zones" in the scene's Grid tab: the scale and, optionally, each limit in meters. */
function onRenderSceneConfig(app, element) {
  const root = element instanceof HTMLElement ? element : element?.[0];
  const scene = app.document;
  if (!root || !scene || root.querySelector('.sdm-scene-zones')) return;
  const tab = root.querySelector('.tab[data-tab="grid"]') ?? root.querySelector('form') ?? root;
  const flags = scene.getFlag('sdm', 'zones') ?? {};
  const worldKey = worldZoneScale();
  const l = key => game.i18n.localize(key);
  const options = [
    `<option value="">${esc(game.i18n.format('SDM.Zones.WorldDefault', { scale: l(`SDM.Zones.Scale.${worldKey}`) }))}</option>`,
    ...ZONE_SCALE_KEYS.map(
      key => `<option value="${key}"${scaleKey(flags.scale) === key ? ' selected' : ''}>${esc(l(`SDM.Zones.Scale.${key}`))}</option>`
    ),
    `<option value="${NO_ZONES}"${flags.scale === NO_ZONES ? ' selected' : ''}>${esc(l('SDM.Zones.Scale.none'))}</option>`
  ].join('');
  const limitRow = limit => `
    <div class="form-group">
      <label>${esc(game.i18n.format('SDM.Zones.LimitLabel', { zone: l(CONFIG.SDM.rangeType[limit]) }))}</label>
      <div class="form-fields">
        <input type="number" name="flags.sdm.zones.${limit}" value="${positive(flags[limit]) ?? ''}" min="0" step="any" data-limit="${limit}">
        <span class="units">${worldUnit()}</span>
      </div>
    </div>`;
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'sdm-scene-zones';
  fieldset.innerHTML = `
    <legend>${esc(l('SDM.Zones.SceneLegend'))}</legend>
    <div class="form-group">
      <label>${esc(l('SDM.Zones.SceneScale'))}</label>
      <div class="form-fields"><select name="flags.sdm.zones.scale">${options}</select></div>
    </div>
    <p class="hint sdm-zones-about"></p>
    <p class="hint sdm-zones-mismatch"></p>
    <div class="sdm-zones-limits">
      ${LIMITS.map(limitRow).join('')}
      <p class="hint">${esc(l('SDM.Zones.SceneHint'))}</p>
    </div>`;
  tab.append(fieldset);
  // Empty numbers use the selected scale: show its values as placeholders. Under the select: what the
  // scale is for, its grid, how many squares each zone is on this scene's grid, and a warning when the
  // grid doesn't suit it. Follows the grid inputs of the same form as they change.
  const select = fieldset.querySelector('select');
  const about = fieldset.querySelector('.sdm-zones-about');
  const mismatch = fieldset.querySelector('.sdm-zones-mismatch');
  const form = root.querySelector('form') ?? root;
  // A grid size in the world unit, with the other unit beside it ("5 ft (1.5 m)")
  const unit = worldUnit();
  const other = unit === 'm' ? 'ft' : 'm';
  const meters = value => {
    const n = Math.round(value * 100) / 100;
    const o = Math.round(convertDistance(n, unit, other) * 100) / 100;
    return `${n} ${unit} (${o} ${other})`;
  };
  const refresh = () => {
    const none = select.value === NO_ZONES;
    fieldset.querySelector('.sdm-zones-limits').hidden = none;
    mismatch.textContent = '';
    if (none) {
      about.textContent = l('SDM.Zones.ScaleUse.none');
      return app.setPosition?.({ height: 'auto' });
    }
    const key = select.value || worldKey;
    const scale = getZoneScale(key);
    const limits = Object.fromEntries(
      LIMITS.map(limit => {
        const typed = positive(fieldset.querySelector(`input[data-limit="${limit}"]`)?.value);
        return [limit, typed ?? scale[limit]];
      })
    );
    fieldset.querySelectorAll('input[data-limit]').forEach(input => (input.placeholder = `${scale[input.dataset.limit]}`));
    const distance = Number(form.querySelector('[name="grid.distance"]')?.value) || Number(scene.grid?.distance) || 1;
    const units = form.querySelector('[name="grid.units"]')?.value ?? scene.grid?.units;
    const perSquare = distance * metersPerUnit({ grid: { units } });
    const [min, max] = SCALE_GRID[unit][key] ?? [perSquare, perSquare];
    const squares = limit => Math.floor(limits[limit] / perSquare + 1e-9);
    about.textContent = [
      l(`SDM.Zones.ScaleUse.${key}`),
      game.i18n.format('SDM.Zones.SuggestedGrid', { grid: min === max ? meters(min) : `${meters(min)} – ${meters(max)}` }),
      game.i18n.format('SDM.Zones.HereSquares', { close: squares('close'), short: squares('short'), medium: squares('medium') })
    ].join(' ');
    if (perSquare < min * 0.66 || perSquare > max * 1.5 || squares('close') < 1) {
      mismatch.textContent = game.i18n.format('SDM.Zones.GridMismatch', {
        here: meters(perSquare),
        grid: min === max ? meters(min) : `${meters(min)} – ${meters(max)}`
      });
    }
    app.setPosition?.({ height: 'auto' });
  };
  select.addEventListener('change', refresh);
  fieldset.addEventListener('input', event => event.target.matches('input[data-limit]') && refresh());
  form.querySelectorAll('[name="grid.distance"], [name="grid.units"]').forEach(input => input.addEventListener('change', refresh));
  refresh();
  app.setPosition?.({ height: 'auto' });
}

/* -------------------------------------------- */
/*  Setup                                       */
/* -------------------------------------------- */

/* -------------------------------------------- */
/*  Reach badge on combatants                   */
/* -------------------------------------------- */

/**
 * Wherever combatants are drawn (the combat tracker, carousel / dock tracker modules…), each element
 * tagged with a combatant id gets a reach badge when its actor holds a readied reach weapon.
 */
function markReachCombatants(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0] ?? app?.element;
  const combat = game.combat;
  if (!root?.querySelectorAll || !combat) return;
  for (const element of root.querySelectorAll('[data-combatant-id]')) {
    const combatant = combat.combatants.get(element.dataset.combatantId);
    const reach = hasReach(combatant?.actor);
    const badge = element.querySelector(':scope .sdm-reach-badge');
    if (!reach) {
      badge?.remove();
      continue;
    }
    if (badge) continue;
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-arrows-left-right-to-line sdm-reach-badge';
    icon.dataset.tooltip = game.i18n.localize('SDM.Zones.ReachBadge');
    icon.setAttribute('aria-label', icon.dataset.tooltip);
    // The core tracker: next to the name; other trackers: a corner of the combatant's card
    const name = element.querySelector('.token-name .name, .token-name h4, .token-name strong, .token-name');
    if (name) name.append(' ', icon);
    else {
      icon.classList.add('sdm-reach-badge-corner');
      if (getComputedStyle(element).position === 'static') element.style.position = 'relative';
      element.append(icon);
    }
  }
}

/** Readying / dropping a reach weapon refreshes the combat tracker(s). */
function refreshReachBadges(item) {
  if (!item?.system?.features?.has?.('reach') || !game.combat) return;
  if (!game.combat.combatants.some(c => c.actor === item.parent)) return;
  ui.combat?.render();
  game.combat.render?.();
}

/** Called at init. */
export function setupZones() {
  Hooks.on('renderCombatTracker', markReachCombatants);
  Hooks.on('renderApplicationV2', markReachCombatants);
  Hooks.on('renderApplication', markReachCombatants);
  Hooks.on('updateItem', refreshReachBadges);
  Hooks.on('createItem', refreshReachBadges);
  Hooks.on('deleteItem', refreshReachBadges);
  registerZoneRuler();
  Hooks.on('preUpdateToken', onPreUpdateToken);
  Hooks.on('renderSceneConfig', onRenderSceneConfig);
  Hooks.on('preCreateScene', onPreCreateScene);
  // Numbers saved in another unit (worlds from before the unit setting): convert them once
  Hooks.once('ready', () => {
    if (setting('zoneValuesUnit', 'm') !== worldUnit()) convertWorldUnit({ scenes: false });
  });
  setupZoneHighlight();
}

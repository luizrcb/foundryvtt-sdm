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

import { GearType } from './constants.mjs';
import { UnarmedDamageItem } from './itemUtils.mjs';

/**
 * Where close, short and medium end, in meters. Long is anything beyond.
 * A zone is both a range (a short-range weapon hits the short zone) and movement (short is 1 round
 * away), so a scale shrinks for obstacles and tight places but only grows with how fast the fight
 * moves (riding, vehicles, ships, aircraft), never because the place is open: an open desert crossed
 * on foot is On foot, its long sight lines are the long zone, which has no end.
 */
export const ZONE_SCALES = {
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
};
export const ZONE_SCALE_KEYS = Object.keys(ZONE_SCALES);
export const DEFAULT_ZONE_SCALE = 'battlemap';
/** Meters per grid square each scale is meant for (min, max): shown and checked in the scene config. */
const SCALE_GRID = {
  battlemap: [1.5, 1.5],
  indoor: [1.5, 1.5],
  underground: [1.5, 1.5],
  forest: [1.5, 1.5],
  onFoot: [1.5, 3],
  mounted: [3, 5],
  vehicle: [10, 10],
  ships: [10, 10],
  air: [20, 20]
};
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
  // Edited in the Zones menu (table of scales); saved as an object
  game.settings.register('sdm', 'zoneScales', {
    name: 'SDM.Zones.Scales',
    hint: 'SDM.Zones.ScalesHint',
    scope: 'world',
    config: false,
    type: Object,
    default: foundry.utils.deepClone(ZONE_SCALES)
  });
  game.settings.register('sdm', 'zoneRangeCheck', {
    name: 'SDM.Zones.RangeCheck',
    hint: 'SDM.Zones.RangeCheckHint',
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
    default: true
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
  const base = ZONE_SCALES[key] ?? ZONE_SCALES[DEFAULT_ZONE_SCALE];
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
  return ZONE_SCALES[key] ? key : DEFAULT_ZONE_SCALE;
}

/** False on a travel map (scene scale "none"): no ruler colors, range check, free attack note or HUD zones. */
export function zonesActive(scene = canvas?.scene) {
  return scene?.getFlag?.('sdm', 'zones')?.scale !== NO_ZONES;
}

/** The scene's zone limits in meters: its scale (or the world's) and any number the scene changed. */
export function sceneZoneLimits(scene = canvas?.scene) {
  const flags = scene?.getFlag?.('sdm', 'zones') ?? {};
  const key = ZONE_SCALES[scaleKey(flags.scale)] ? scaleKey(flags.scale) : worldZoneScale();
  const scale = getZoneScale(key);
  return { scale: key, ...sorted(Object.fromEntries(LIMITS.map(limit => [limit, positive(flags[limit]) ?? scale[limit]]))) };
}

/* -------------------------------------------- */
/*  Distances                                   */
/* -------------------------------------------- */

const UNIT_METERS = [
  [/^(m|meters?|metres?|metros?)$/, 1],
  [/^(ft|feet|foot|pes|pés|pe|pé)$/, 0.3048],
  [/^(yd|yds|yards?|jardas?)$/, 0.9144],
  [/^(km|kilometers?|kilometres?|quilometros?|quilômetros?)$/, 1000],
  [/^(mi|miles?|milhas?)$/, 1609.344]
];

/** Meters in one of the scene's grid units (unknown units are taken as meters). */
export function metersPerUnit(scene = canvas?.scene) {
  const units = `${scene?.grid?.units ?? ''}`.trim().toLowerCase().replace(/\.$/, '');
  return UNIT_METERS.find(([pattern]) => pattern.test(units))?.[1] ?? 1;
}

/** Zone index (0 close … 3 long) of a distance in meters. */
export function bandForMeters(meters, limits = sceneZoneLimits()) {
  if (meters <= limits.close) return 0;
  if (meters <= limits.short) return 1;
  if (meters <= limits.medium) return 2;
  return 3;
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
 * What the actor has readied and its range: weapons (no range = close) and powers with a range
 * (power items and the selected power of a power album). Unarmed is left out: it can be used with
 * any of the four attacks, so it has no range of its own.
 */
function readiedReach(actor) {
  const entries = [];
  for (const item of actor.items ?? []) {
    if (!item.system?.readied) continue;
    if (item.system.type === GearType.POWER) {
      const range = `${item.system.power?.range ?? ''}`.trim().toLowerCase();
      if (ZONE_BANDS.includes(range)) entries.push({ name: item.name, band: ZONE_BANDS.indexOf(range) });
    } else if (item.system.type === GearType.POWER_ALBUM) {
      const powers = item.system.powers ?? [];
      const power = powers[item.system.powers_current_index] ?? powers[0];
      const range = `${power?.range ?? ''}`.trim().toLowerCase();
      if (power && ZONE_BANDS.includes(range)) entries.push({ name: power.name || item.name, band: ZONE_BANDS.indexOf(range) });
    } else if (isWeaponItem(item) && !isUnarmed(item)) {
      const range = `${item.system.weapon?.range ?? ''}`.trim().toLowerCase();
      entries.push({ name: item.name, band: Math.max(ZONE_BANDS.indexOf(range), 0) });
    }
  }
  return entries;
}

/** "Reach: Rifle (long), Bow (medium) · Don't reach: Knife (close)" for a target zone. */
function reachHtml(actor, band) {
  const entries = readiedReach(actor);
  if (!entries.length) return '';
  const list = items => items.map(e => `${e.name} (${bandLabel(e.band)})`).join(', ');
  const reach = entries.filter(e => e.band >= band).sort((a, b) => a.band - b.band);
  const short = entries.filter(e => e.band < band).sort((a, b) => b.band - a.band);
  const parts = [];
  if (reach.length) parts.push(`${game.i18n.localize('SDM.Zones.Reach')}: ${list(reach)}`);
  if (short.length) parts.push(`${game.i18n.localize('SDM.Zones.NoReach')}: ${list(short)}`);
  if (!reach.length) parts.push(game.i18n.localize('SDM.Zones.NothingReaches'));
  return `<div class="sdm-range-reach">${esc(parts.join(' · '))}</div>`;
}

/**
 * A row for the roll preview: the target's zone and, when the weapon or power has a range, whether
 * it reaches. With `reach` (attack rolls, which aren't tied to a weapon) it also lists what the
 * actor has readied that reaches the target and what doesn't. No penalty is applied: the book
 * leaves modifiers to the Referee.
 */
export function targetRangeHtml(actor, { range = '', throwing = false, reach = false } = {}) {
  if (!setting('zoneRangeCheck', true) || !zonesActive()) return '';
  const target = Array.from(game.user.targets ?? [])[0];
  const source = tokenFor(actor);
  if (!target || !source || target === source) return '';
  const measured = measureTokens(source, target);
  if (!measured) return '';
  const units = canvas.scene.grid.units ?? '';
  const shown = `${bandLabel(measured.band)} · ~${Math.round(measured.units * 10) / 10}${units ? ` ${units}` : ''}`;
  const max = ZONE_BANDS.indexOf(`${range ?? ''}`.trim().toLowerCase());
  let note = '';
  if (max >= 0 && measured.band > max) {
    note = game.i18n.format('SDM.Zones.OutOfRange', { range: bandLabel(max) });
  } else if (throwing && measured.band > 1) {
    note = game.i18n.localize('SDM.Zones.ThrowingPenalty');
  }
  return (
    `<div class="sdm-roll-preview-row sdm-range-row${note ? ' warn' : ''}">` +
    `<span>${esc(game.i18n.format('SDM.Zones.Target', { name: target.name }))}</span> <code>${esc(shown)}</code>` +
    (reach ? reachHtml(actor, measured.band) : '') +
    (note ? `<div class="sdm-range-note"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(note)}</div>` : '') +
    `</div>`
  );
}

/* -------------------------------------------- */
/*  Free attack when disengaging                */
/* -------------------------------------------- */

const OUT_OF_FIGHT = ['dead', 'unconscious', 'sleep', 'paralysis', 'petrified', 'stun'];

/** In combat, a token leaving the close zone of an enemy: note that the enemy may take a free attack. */
function onPreUpdateToken(doc, changes, options, userId) {
  if (userId !== game.user.id || !('x' in changes || 'y' in changes)) return;
  if (!setting('freeAttackReminder', true) || !canvas?.ready || doc.parent !== canvas.scene || !zonesActive()) return;
  const combat = game.combat;
  if (!combat?.started || !combat.combatants.some(c => c.tokenId === doc.id)) return;
  if (doc.disposition === CONST.TOKEN_DISPOSITIONS.NEUTRAL || doc.disposition === CONST.TOKEN_DISPOSITIONS.SECRET) return;
  const limits = sceneZoneLimits();
  const perUnit = metersPerUnit();
  const from = centerOf(doc);
  const to = centerOf(doc, changes.x ?? doc.x, changes.y ?? doc.y);
  const enemies = [];
  for (const other of doc.parent.tokens) {
    if (other === doc || other.hidden || other.disposition !== -doc.disposition) continue;
    if (OUT_OF_FIGHT.some(id => other.actor?.statuses?.has(id))) continue;
    if (combat.combatants.find(c => c.tokenId === other.id)?.isDefeated) continue;
    const before = unitsBetween(doc, from, other, centerOf(other)) * perUnit;
    const after = unitsBetween(doc, to, other, centerOf(other)) * perUnit;
    if (before <= limits.close && after > limits.close) enemies.push(other.name);
  }
  if (!enemies.length) return;
  const list = new Intl.ListFormat(game.i18n.lang, { type: 'conjunction' }).format(enemies);
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ token: doc }),
    content: `<p><i class="fa-solid fa-person-running"></i> ${esc(game.i18n.format('SDM.Zones.FreeAttack', { name: doc.name, enemies: list }))}</p>`
  });
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
        <span class="units">m</span>
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
  const meters = value => {
    const n = Math.round(value * 100) / 100;
    return n === 1.5 ? '1.5 m (5 ft)' : `${n} m`;
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
    const [min, max] = SCALE_GRID[key] ?? [perSquare, perSquare];
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

/** Called at init. */
export function setupZones() {
  registerZoneRuler();
  Hooks.on('preUpdateToken', onPreUpdateToken);
  Hooks.on('renderSceneConfig', onRenderSceneConfig);
  setupZoneHighlight();
}

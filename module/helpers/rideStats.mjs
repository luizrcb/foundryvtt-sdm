/**
 * Ride stats (mounts and vehicles; the book's "Level and Non-Sentient Rides"): the level sets life,
 * defense, bonus and damage. Non-sentient rides use the book's ride table (more life, no morale,
 * lower defense and bonus); sentient rides (the *sentient* feature) are treated like any creature,
 * from an NPC table the Referee picks. The stats live in the item's creature attributes, so ride
 * mods change them like other item effects. They are filled when the ride is created and when its
 * level, its sentience or its table changes; the Referee can still edit them ("custom" table: never
 * filled).
 */
import { ItemType } from './constants.mjs';
import { getNPCDataByLevel, NPC_CUSTOM_TABLE } from './actorUtils.mjs';
import { normalizeNpcTable } from './animatedItems.mjs';

// Lvl, Life, Def, Bon, Dmg (the book's table, levels 0–13)
const RIDE_TABLE = [
  [0, 5, 7, 0, '1d4'],
  [1, 11, 7, 1, '1d6'],
  [2, 18, 6, 2, '1d8'],
  [3, 26, 6, 3, '1d10'],
  [4, 35, 5, 4, '2d6'],
  [5, 45, 5, 5, '2d6+3'],
  [6, 60, 5, 4, '2d6+6'],
  [7, 80, 4, 4, '3d6+6'],
  [8, 110, 4, 3, '3d6+9'],
  [9, 140, 4, 3, '4d6+12'],
  [10, 180, 4, 2, '5d6+15'],
  [11, 230, 3, 2, '6d6+18'],
  [12, 300, 3, 1, '7d6+21'],
  [13, 400, 3, 1, '8d6+24']
];

export function isRide(item) {
  return item?.type === ItemType.MOUNT || item?.type === ItemType.VEHICLE;
}

const featureSet = features => new Set(features instanceof Set ? features : features ?? []);

/** Sentient rides are treated like any creature (an NPC table). */
export function isSentientRide(item, features = item?.system?.features) {
  return featureSet(features).has('sentient');
}

/** The ride's table: the book's ride table (non-sentient), else its NPC table ("custom": none). */
export function rideTable(item, { features, table } = {}) {
  if (!isSentientRide(item, features ?? item?.system?.features)) return 'ride';
  return normalizeNpcTable(table ?? item?.system?.animation?.table);
}

/** Life, defense, bonus, damage (and morale for sentient rides) at a level, or null ("custom"). */
export function rideStatsAt(item, level, options = {}) {
  const table = rideTable(item, options);
  const lvl = Math.max(Number(level) || 0, 0);
  if (table === 'ride') {
    const row = [...RIDE_TABLE].reverse().find(r => r[0] <= lvl) ?? RIDE_TABLE[0];
    return { life: row[1], defense: row[2], bonus: row[3], damage: row[4], morale: 0 };
  }
  if (table === NPC_CUSTOM_TABLE) return null;
  const entry = getNPCDataByLevel(table, lvl);
  return entry ? { life: entry.Life, defense: entry.Def, bonus: entry.Bon, damage: entry.Dmg, morale: entry.Mor } : null;
}

/** The attribute updates for those stats (life kept full if it was full, else capped). */
function statsUpdate(item, stats, level = item.system.level) {
  const attributes = item.system.attributes ?? {};
  const oldMax = Number(attributes.life?.max) || 0;
  const value = Number(attributes.life?.value) || 0;
  const life = !item.system.animation?.filled || value >= oldMax ? stats.life : Math.min(value, stats.life);
  return {
    'system.attributes.life.max': stats.life,
    'system.attributes.life.value': life,
    'system.attributes.defense': stats.defense,
    'system.attributes.bonus': stats.bonus,
    'system.attributes.damage': stats.damage,
    'system.attributes.morale': stats.morale,
    'system.attributes.level': Number(level) || 0,
    'system.animation.filled': true
  };
}

/** A new ride (from the compendium, the sidebar, a drop): its stats from its level. */
function onPreCreateRide(item, data, options, userId) {
  if (userId !== game.user.id || !isRide(item) || item.system.animation?.filled) return;
  const stats = rideStatsAt(item, item.system.level);
  if (stats) item.updateSource(statsUpdate(item, stats));
}

/** Its level, sentience or table changed: the stats follow. */
function onPreUpdateRide(item, changes, options, userId) {
  if (userId !== game.user.id || !isRide(item)) return;
  const flat = foundry.utils.flattenObject(changes);
  const level = flat['system.level'];
  const features = foundry.utils.getProperty(changes, 'system.features');
  const table = flat['system.animation.table'];
  if (level === undefined && features === undefined && table === undefined) return;
  const nextFeatures = features ?? item.system.features;
  if (level === undefined && features !== undefined && isSentientRide(item) === isSentientRide(item, nextFeatures) && table === undefined) return;
  const stats = rideStatsAt(item, level ?? item.system.level, { features: nextFeatures, table });
  if (!stats) return;
  // The sheet sends every stat field with each change: a field still at its current value is
  // replaced by the table's; one the user changed in that same edit is kept
  for (const [key, value] of Object.entries(statsUpdate(item, stats, level ?? item.system.level))) {
    const sent = flat[key];
    const current = foundry.utils.getProperty(item._source, key);
    if (sent === undefined || String(sent) === String(current)) foundry.utils.setProperty(changes, key, value);
  }
}

/** Fill the ride's stats from its table at its level now (the Ride stats card's button). */
export async function refillRideStats(item) {
  if (!isRide(item) || !item.isOwner) return;
  const stats = rideStatsAt(item, item.system.level);
  if (!stats) return ui.notifications.info(game.i18n.localize('SDM.RideStats.CustomTable'));
  await item.update(statsUpdate(item, stats));
}

export function setupRideStats() {
  Hooks.on('preCreateItem', onPreCreateRide);
  Hooks.on('preUpdateItem', onPreUpdateRide);
}

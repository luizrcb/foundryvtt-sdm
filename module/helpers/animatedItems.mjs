import TokenPlacement from '../canvas/token-placement.mjs';
import { getNPCDataByLevel, getNpcTableChoices, NPC_CUSTOM_TABLE, NPC_TABLE_KEYS } from './actorUtils.mjs';
import { refillRideStats } from './rideStats.mjs';
import { ActorType, GearType, ItemStatusType, ItemType } from './constants.mjs';
import { $fmt, $l10n } from './globalUtils.mjs';
import { featureEnabled } from './features.mjs';
import { hasPowerAlbum, lastChargeUpdate } from './itemUtils.mjs';
import { getUsesCounter, spendUsesUpdate, usesLeft, usesResources } from './itemUses.mjs';

/**
 * Animated items: an item with the "animated" feature can come to life as an NPC.
 * The NPC is created once (kept in the "Animated Items" folder) and reused; while the item
 * is animated the NPC is the source of truth, and its state goes back to the item when it
 * is deanimated. The NPC level always follows the item (the higher of the hallmark level and
 * the level set by the Referee); it never levels up on its own.
 */

export const ANIMATED_FEATURE = 'animated';
const FLAG = 'animatedItem';
const HUD_BUTTON_CLASS = 'sdm-deanimate-item';

/** Options marking updates made by this module (they must not trigger another sync). */
export const SYNC_OPTION = 'sdmAnimationSync';

/**
 * Rides (mounts and vehicles) use this same machinery to take the field — "Deploy" / "Recall":
 * no feature, no cost, their own stats (ride stats, see rideStats.mjs), level, speed and size.
 */
export function isRideItem(item) {
  return item?.type === ItemType.MOUNT || item?.type === ItemType.VEHICLE;
}

/** The text key for this item: the ride's wording (Deploy / Recall) when there is one, else the animation's. */
function textKey(item, key) {
  const ride = `SDM.Ride.${key}`;
  return isRideItem(item) && game.i18n.has(ride) ? ride : `SDM.Animation.${key}`;
}

export function isAnimatable(item) {
  if (isRideItem(item)) return true;
  const features = item?.system?.features;
  return typeof features?.has === 'function' && features.has(ANIMATED_FEATURE);
}

/** The item an NPC animates, if any. */
/** The item an NPC animates (an item in a compendium never animates: it can't be changed). */
export function getAnimatedSourceItem(actor) {
  const uuid = actor?.getFlag?.('sdm', FLAG);
  if (!uuid || uuid.startsWith('Compendium.')) return null;
  const item = fromUuidSync(uuid);
  return item && !item.pack ? item : null;
}

export function isAnimatedNpc(actor) {
  return !!actor?.getFlag?.('sdm', FLAG);
}

/** Level of the creature: the hallmark level for hallmarks, otherwise the Referee's level. */
export function getAnimationLevel(item) {
  if (isRideItem(item)) return Number(item.system.level) || 0;
  if (item.system.is_hallmark) return Number(item.system.hallmark?.level) || 0;
  return Number(item.system.attributes?.level) || 0;
}

/** Known table, "custom" (no table: levels only change the level number), or the generic one. */
export function normalizeNpcTable(table) {
  if (table === NPC_CUSTOM_TABLE) return NPC_CUSTOM_TABLE;
  return NPC_TABLE_KEYS().includes(table) ? table : 'generic-synthesized-creature';
}

/** A ride with no table picked: vehicles are Brick Bastions, mounts the generic creature. */
export function defaultRideTable(item) {
  return item?.type === ItemType.VEHICLE ? 'brick-bastions' : 'generic-synthesized-creature';
}

export function getAnimationTable(item) {
  const table = item.system.animation?.table;
  if (!table && isRideItem(item)) return defaultRideTable(item);
  return normalizeNpcTable(table);
}

export function getAnimationTableChoices() {
  return getNpcTableChoices();
}

/** Charges spent to animate the item (0: free). Only items with the charges feature can pay it. */
export function getAnimationChargeCost(item) {
  return Math.max(Number(item.system.animation?.chargeCost) || 0, 0);
}

/** Items with replenish can make each animation a use: a usage roll (running low: the last use). */
export function animationSpendsUsage(item) {
  return !!item.system.animation?.usageRoll && !!item.system.features?.has?.('replenish');
}

/** Paid to come to life (charges or a use): the payment is the price, the item itself is not worn. */
export function isAnimationPaid(item) {
  return getAnimationChargeCost(item) > 0 || animationSpendsUsage(item);
}

/**
 * Why the item cannot come to life right now, as a localization key (null: it can):
 * broken or run out (repair or recharge it), or not enough charges to pay the animation.
 */
export function getAnimationBlock(item) {
  if (item.system.status === ItemStatusType.BROKEN || item.system.resources === 'run_out') {
    return 'SDM.Animation.BlockedHint';
  }
  const cost = getAnimationChargeCost(item);
  // The item's uses counter pays it when it has one, else its charges
  const available = getUsesCounter(item) ? usesLeft(item) : Number(item.system.charges?.value) || 0;
  if (cost > 0 && available < cost) return 'SDM.Animation.NoChargesHint';
  return null;
}

export function isAnimationBlocked(item) {
  return !!getAnimationBlock(item);
}

/** Warn why the item cannot be animated. */
function warnAnimationBlock(item) {
  const block = getAnimationBlock(item);
  const key = block === 'SDM.Animation.BlockedHint' ? textKey(item, 'Blocked') : 'SDM.Animation.NoCharges';
  ui.notifications.warn($fmt(key, { name: item.name, cost: getAnimationChargeCost(item) }));
}

/** The item's creature in the world (a compendium NPC is not one until it is imported). */
export function getLinkedNpc(item) {
  const uuid = item.system.animation?.actor;
  if (!uuid || uuid.startsWith('Compendium.')) return null;
  const actor = fromUuidSync(uuid);
  return actor?.documentName === 'Actor' && !actor.pack ? actor : null;
}

/**
 * An item from the compendium can come linked to a compendium NPC (Soul Siphon Spear → Spear Snake).
 * Compendium documents can't be changed, so the first animation imports a copy into the
 * "Animated Items" folder and links the item to it. Only the link changes: the item keeps its own
 * attributes. Each item gets its own creature. Referee only.
 */
async function importCompendiumCreature(item) {
  const uuid = item.system.animation?.actor;
  if (!game.user.isGM || !uuid?.startsWith('Compendium.')) return;
  const source = await fromUuid(uuid);
  if (source?.documentName !== 'Actor') {
    // The compendium NPC is gone: animate with a creature made from the item
    await item.update({ 'system.animation.actor': '' }, { [SYNC_OPTION]: true });
    return;
  }
  const folder = await getAnimatedFolder();
  const data = source.toObject();
  delete data._id;
  data.folder = folder?.id;
  const npc = await Actor.create(data);
  if (!npc) return;
  await npc.update({
    [`flags.sdm.${FLAG}`]: item.uuid,
    [`flags.sdm.${DEFENSE_BONUS_FLAG}`]: 0,
    [`flags.sdm.${KEEP_IDENTITY_FLAG}`]: true,
    'prototypeToken.disposition': dispositionFromItem(item),
    'prototypeToken.actorLink': true
  });
  await item.update({ 'system.animation.actor': npc.uuid }, { [SYNC_OPTION]: true });
}

/* -------------------------------------------- */
/*  Attributes                                  */
/* -------------------------------------------- */

/** Fill the item's creature attributes from its table at its level. */
export async function fillAttributesFromTable(item, { raiseOnly = false } = {}) {
  if (getAnimationTable(item) === NPC_CUSTOM_TABLE) return;
  const level = getAnimationLevel(item);
  const entry = getNPCDataByLevel(getAnimationTable(item), level);
  if (!entry) return;
  const current = item.system.attributes;
  const pick = (value, fromTable) => (raiseOnly ? Math.max(Number(value) || 0, fromTable) : fromTable);
  const life = pick(current.life.max, entry.Life);
  await item.update(
    {
      'system.attributes.life.value': raiseOnly ? Math.max(current.life.value, life) : life,
      'system.attributes.life.max': life,
      'system.attributes.morale': pick(current.morale, entry.Mor),
      'system.attributes.defense': pick(current.defense, entry.Def),
      'system.attributes.bonus': pick(current.bonus, entry.Bon),
      'system.attributes.damage': raiseOnly ? current.damage : entry.Dmg,
      'system.animation.filled': true
    },
    { [SYNC_OPTION]: true }
  );
}

const VERSATILE_FLAG = 'animatedVersatile';

function hasFeature(item, key) {
  const features = item.system.features;
  return typeof features?.has === 'function' && features.has(key);
}

export function isWeaponItem(item) {
  return item.system.type === GearType.WEAPON || hasFeature(item, 'weapon');
}

/**
 * Where a weapon creature's damage comes from: the weapon, or the creature attributes in the
 * Animation tab. Automatic: the weapon, except with the custom table (the Referee's values).
 */
export function getDamageSource(item) {
  if (!isWeaponItem(item)) return 'creature';
  const source = item.system.animation?.damageSource;
  if (source === 'weapon' || source === 'creature') return source;
  return getAnimationTable(item) === NPC_CUSTOM_TABLE ? 'creature' : 'weapon';
}

/** Weapon items (weapon type or the weapon feature) fight with their own damage. */
function weaponDamage(item) {
  if (getDamageSource(item) !== 'weapon') return null;
  const weapon = item.system.weapon ?? {};
  const versatile = (weapon.versatile || hasFeature(item, 'versatile')) && weapon.damage?.versatile;
  return { base: weapon.damage?.base || null, versatile: versatile || null };
}

/**
 * Keep the creature's damage in line with the weapon: its damage is the weapon's base damage,
 * and a versatile weapon gives it a "versatile damage" weapon with the versatile damage.
 */
async function syncWeaponDamage(item, npc, { useCreatureDamage = false } = {}) {
  const damage = weaponDamage(item);
  // Weapon damage; the creature damage from the Animation tab only when switching to it
  // (otherwise the creature keeps the damage its table gave it when levelling up)
  const npcDamage = damage?.base || (useCreatureDamage ? item.system.attributes?.damage : null);
  if (npcDamage && npc.system.damage !== npcDamage) {
    await npc.update({ 'system.damage': npcDamage });
  }

  const existing = npc.items.filter(i => i.getFlag('sdm', VERSATILE_FLAG));
  if (!damage?.versatile) {
    if (existing.length) await npc.deleteEmbeddedDocuments('Item', existing.map(i => i.id));
    return;
  }
  const data = {
    name: $l10n('SDM.Animation.VersatileDamage'),
    img: item.img,
    'system.type': GearType.WEAPON,
    'system.weapon.damage.base': damage.versatile,
    'system.readied': true,
    // Made for the creature: it takes no slots
    'system.slots_override': 0
  };
  if (existing.length) {
    await existing[0].update(data);
    if (existing.length > 1) await npc.deleteEmbeddedDocuments('Item', existing.slice(1).map(i => i.id));
  } else {
    await npc.createEmbeddedDocuments('Item', [
      {
        name: data.name,
        img: data.img,
        type: ItemType.GEAR,
        system: { type: GearType.WEAPON, readied: true, slots_override: 0, weapon: { damage: { base: damage.versatile } } },
        flags: { sdm: { [VERSATILE_FLAG]: true } }
      }
    ], { sdmKeepReadied: true });
  }
}

const POWER_COPY_FLAG = 'animatedPowerCopy';

/** Powers, power albums and gear with the album feature: the creature carries a copy, so it can use its own powers. */
export function isPowerItem(item) {
  return item.system.type === GearType.POWER || hasPowerAlbum(item);
}

/** Replace the creature's copy of the power (or album) with the item as it is now. */
async function syncPowerCopy(item, npc) {
  const existing = npc.items.filter(i => i.getFlag('sdm', POWER_COPY_FLAG));
  if (existing.length) await npc.deleteEmbeddedDocuments('Item', existing.map(i => i.id));
  if (!isPowerItem(item)) return;

  const data = item.toObject();
  delete data._id;
  // The copy is not animated itself and is ready to use
  const features = (data.system.features ?? []).filter(f => f !== ANIMATED_FEATURE);
  data.system.features = features;
  data.system.readied = true;
  data.system.container = '';
  // The creature's own copy: it takes no slots
  data.system.slots_override = 0;
  if (data.system.animation) {
    data.system.animation.active = false;
    data.system.animation.actor = '';
  }
  data.flags = foundry.utils.mergeObject(data.flags ?? {}, { sdm: { [POWER_COPY_FLAG]: item.uuid } });
  await npc.createEmbeddedDocuments('Item', [data], { sdmKeepReadied: true });
}

const FEATURE_TRAIT_FLAG = 'animatedFeature';
const KEEP_IDENTITY_FLAG = 'animatedKeepIdentity';
const EFFECT_COPY_FLAG = 'animatedEffect';

/** The item's features become traits of the creature (name and rules text), so they show on its sheet. */
async function syncFeatureTraits(item, npc) {
  const existing = npc.items.filter(i => i.getFlag('sdm', FEATURE_TRAIT_FLAG));
  if (existing.length) await npc.deleteEmbeddedDocuments('Item', existing.map(i => i.id));
  const features = [...(item.system.features ?? [])].filter(f => f !== ANIMATED_FEATURE);
  if (!features.length) return;
  const label = key => {
    const text = game.i18n.localize(`SDM.ItemFeature.${key}`);
    return text.startsWith('SDM.') ? key : text;
  };
  const description = key => {
    const text = game.i18n.localize(`SDM.ItemFeature.${key}Description`);
    return text.startsWith('SDM.') ? '' : `<p>${text}</p>`;
  };
  await npc.createEmbeddedDocuments(
    'Item',
    features.map(key => ({
      name: label(key),
      type: ItemType.TRAIT,
      img: item.img,
      system: { description: description(key), readied: true },
      flags: { sdm: { [FEATURE_TRAIT_FLAG]: key } }
    })),
    { sdmKeepReadied: true }
  );
}

/** A glowing item lights up like a torch (bright 20 ft, dim 40 ft, in the scene's grid units). */
function lightFromItem(item, scene) {
  if (!featureEnabled('lights') || !hasFeature(item, 'glowing')) return { bright: 0, dim: 0 };
  const perGrid = Number(scene?.grid?.distance) || 5;
  return { bright: 4 * perGrid, dim: 8 * perGrid };
}

/**
 * Effects the item gives its bearer (transfer effects) also work on the creature.
 * Item mods and the hallmark upgrades change the item itself, so they are not copied.
 */
async function syncEffectCopies(item, npc) {
  const existing = npc.effects.filter(e => e.getFlag('sdm', EFFECT_COPY_FLAG));
  if (existing.length) await npc.deleteEmbeddedDocuments('ActiveEffect', existing.map(e => e.id));
  const copies = item.effects
    .filter(e => e.transfer && !e.system?.isItemMod && !e.getFlag('sdm', HALLMARK_UPGRADES_FLAG))
    .map(e => {
      const data = e.toObject();
      delete data._id;
      data.transfer = false;
      data.origin = item.uuid;
      data.flags = foundry.utils.mergeObject(data.flags ?? {}, { sdm: { [EFFECT_COPY_FLAG]: item.uuid } });
      return data;
    });
  if (copies.length) await npc.createEmbeddedDocuments('ActiveEffect', copies);
}

const HALLMARK_UPGRADES_FLAG = 'hallmarkUpgrades';
const DEFENSE_BONUS_FLAG = 'animatedDefenseBonus';

/** Armor and ward items add their bonus to the creature's defense. */
export function getDefenseBonus(item) {
  let bonus = 0;
  if (item.system.type === GearType.ARMOR || hasFeature(item, 'armor')) {
    bonus += Number(item.system.armor?.value) || 0;
  }
  if (item.system.type === GearType.WARD || hasFeature(item, 'ward')) {
    bonus += Number(item.system.ward?.value) || 0;
  }
  return bonus;
}

/** The creature's defense without the armor/ward bonus (the table or Animation tab value). */
function baseDefense(npc) {
  // The typed defense (without the effects' bonuses)
  return (Number(npc._source.system.defense) || 0) - (Number(npc.getFlag('sdm', DEFENSE_BONUS_FLAG)) || 0);
}

/** Put the item's current armor/ward bonus on top of the creature's base defense. */
async function applyDefenseBonus(item, npc) {
  const bonus = getDefenseBonus(item);
  await npc.update({
    'system.defense': baseDefense(npc) + bonus,
    [`flags.sdm.${DEFENSE_BONUS_FLAG}`]: bonus
  });
}

/** Take the bonus off (before the table raises the base defense on a level-up). */
async function removeDefenseBonus(npc) {
  if (!npc.getFlag('sdm', DEFENSE_BONUS_FLAG)) return;
  await npc.update({ 'system.defense': baseDefense(npc), [`flags.sdm.${DEFENSE_BONUS_FLAG}`]: 0 });
}

function npcSystemFromItem(item) {
  const a = item.system.attributes;
  return {
    level: getAnimationLevel(item),
    life: { value: a.life.value, max: a.life.max },
    morale: a.morale,
    defense: a.defense,
    bonus: a.bonus,
    damage: weaponDamage(item)?.base || a.damage,
    initiative: a.initiative,
    capacity: a.capacity,
    // A ride: its own size and speed; its table (non-sentient rides have none to level up from)
    size: isRideItem(item)
      ? { value: item.system.size?.value ?? 1, unit: item.system.size?.unit || 'sacks' }
      : { value: item.system.animation?.size?.value ?? 1, unit: item.system.animation?.size?.unit || 'sacks' },
    speed: isRideItem(item) ? Number(item.system.speed) || 0 : item.system.animation?.speed ?? 0,
    createdFromTable: isRideItem(item) && !item.system.features?.has?.('sentient') ? NPC_CUSTOM_TABLE : getAnimationTable(item),
    // A ride's creature is the ride: its capacity, cost and supply are the item's (mods included)
    ...(isRideItem(item)
      ? {
          capacity: Number(item.system.capacity) || 0,
          cost: String(item.system.cost ?? ''),
          supply: String(item.system.supply ?? '')
        }
      : {})
  };
}

/** A deployed ride's creature keeps the ride's stats, speed, size, capacity, cost and supply. */
async function syncDeployedRide(item) {
  if (!isRideItem(item) || !item.system.animation?.active) return;
  if (game.users.activeGM?.id !== game.user.id) return;
  const npc = getLinkedNpc(item);
  if (!npc) return;
  const { life, ...rest } = npcSystemFromItem(item);
  await npc.update({ system: { ...rest, 'life.max': life.max } });
  await applyDefenseBonus(item, npc);
}

/** The ride or one of its mods changed: its deployed creature follows. */
function onRideChanged(document, changes, options) {
  if (options?.[SYNC_OPTION]) return;
  const item = document.documentName === 'ActiveEffect' ? document.parent : document;
  if (item?.documentName !== 'Item' || !isRideItem(item)) return;
  // A change to the deployment itself (deploy / recall) is not a change of the ride
  if (document === item && changes?.system?.animation?.active !== undefined) return;
  syncDeployedRide(item);
}

/**
 * The creature takes its owner's side: the disposition of the owner's token in the current scene,
 * or of the owner's prototype token. A character's item is friendly; an item with no owner, neutral.
 */
function dispositionFromItem(item, scene = canvas?.scene) {
  const owner = item.parent;
  if (!owner) return CONST.TOKEN_DISPOSITIONS.NEUTRAL;
  const token = scene?.tokens.find(t => t.actorId === owner.id);
  if (token) return token.disposition;
  if (owner.type === ActorType.CHARACTER) return CONST.TOKEN_DISPOSITIONS.FRIENDLY;
  return owner.prototypeToken?.disposition ?? CONST.TOKEN_DISPOSITIONS.NEUTRAL;
}

/** Players who own the item's character own the creature too. */
function ownershipFromItem(item) {
  const owner = item.parent ?? item;
  const ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE };
  for (const user of game.users) {
    if (!user.isGM && owner.testUserPermission(user, 'OWNER')) {
      ownership[user.id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    }
  }
  return ownership;
}

async function getAnimatedFolder() {
  const name = $l10n('SDM.Animation.Folder');
  return (
    game.folders.find(f => f.type === 'Actor' && f.name === name) ??
    Folder.create({ name, type: 'Actor' })
  );
}

/* -------------------------------------------- */
/*  Dropping an NPC                             */
/* -------------------------------------------- */

/**
 * Referee: an NPC dropped on the Animation tab becomes the item's creature. Its table and stats
 * fill the tab. The creature is a copy in the "Animated Items" folder (compendium and world NPCs alike).
 */
export async function linkNpcToItem(item, actor) {
  if (!item?.isOwner || !isAnimatable(item) || actor?.type !== ActorType.NPC) return;
  if (item.system.animation?.active) {
    ui.notifications.warn($l10n('SDM.Animation.LinkWhileActive'));
    return;
  }

  // A compendium item (delivered ready to use) points at a compendium NPC: nothing is imported now,
  // each copy of the item imports its own creature on first animation
  const inCompendium = !!item.pack;
  if (inCompendium && !actor.pack) {
    ui.notifications.warn($l10n('SDM.Animation.CompendiumNeedsCompendiumNpc'));
    return;
  }

  let npc = actor;
  // A compendium NPC or a world NPC that isn't this item's creature yet: the item gets its own copy
  // in "Animated Items" (the dropped NPC is never changed)
  const ownCreature = !actor.pack && actor.getFlag('sdm', FLAG) === item.uuid;
  if (!inCompendium && !ownCreature) {
    try {
      const folder = await getAnimatedFolder();
      const data = actor.toObject();
      delete data._id;
      data.folder = folder?.id;
      npc = await Actor.create(data);
    } catch (error) {
      // A player without the right to create actors: the Referee links it
      ui.notifications.warn(error?.message ?? String(error));
      return;
    }
    if (!npc) return;
  }

  const s = npc.system;
  const table =
    s.createdFromTable && NPC_TABLE_KEYS().includes(s.createdFromTable) ? s.createdFromTable : NPC_CUSTOM_TABLE;
  // The world creature belongs to this item (a compendium NPC stays as it is)
  if (!inCompendium) {
    await npc.update({
      [`flags.sdm.${FLAG}`]: item.uuid,
      [`flags.sdm.${DEFENSE_BONUS_FLAG}`]: 0,
      [`flags.sdm.${KEEP_IDENTITY_FLAG}`]: true,
      'prototypeToken.disposition': dispositionFromItem(item),
      'prototypeToken.actorLink': true
    });
  }
  await item.update(
    {
      'system.animation.actor': npc.uuid,
      'system.animation.table': table,
      'system.animation.filled': true,
      'system.animation.size.value': s.size?.value ?? 1,
      'system.animation.size.unit': s.size?.unit ?? 'sacks',
      'system.animation.speed': s.speed ?? 0,
      'system.attributes.level': s.level ?? 0,
      'system.attributes.life.value': s.life?.value ?? 1,
      'system.attributes.life.max': s.life?.max ?? 1,
      'system.attributes.morale': s.morale ?? 0,
      'system.attributes.defense': s.defense ?? 7,
      'system.attributes.bonus': s.bonus ?? 0,
      'system.attributes.damage': s.damage || '1d4',
      'system.attributes.initiative': s.initiative ?? '',
      'system.attributes.capacity': s.capacity ?? 1
    },
    { [SYNC_OPTION]: true }
  );
  ui.notifications.info($fmt('SDM.Animation.Linked', { npc: npc.name, name: item.name }));
}

/* -------------------------------------------- */
/*  Animate / deanimate                         */
/* -------------------------------------------- */

/** Create (or reuse) the creature and place its token in the current scene. Referee only. */
export async function animateItem(item, { app, placement = null } = {}) {
  if (!game.user.isGM || !isAnimatable(item) || item.pack) return;
  if (!canvas.scene) {
    ui.notifications.warn($l10n(textKey(item, 'NoScene')));
    return;
  }

  if (isAnimationBlocked(item)) {
    warnAnimationBlock(item);
    return;
  }

  // Linked to a compendium NPC: import a copy for this item first
  await importCompendiumCreature(item);

  // A ride fills its stats from its own table (ride or NPC); other items from their NPC table
  if (!item.system.animation.filled) {
    if (isRideItem(item)) await refillRideStats(item);
    else await fillAttributesFromTable(item);
  }

  // Repaired or recharged after the creature fell: it comes back with full life
  if ((Number(item.system.attributes.life.value) || 0) <= 0) {
    await item.update(
      { 'system.attributes.life.value': item.system.attributes.life.max },
      { [SYNC_OPTION]: true }
    );
  }

  let npc = getLinkedNpc(item);
  const system = npcSystemFromItem(item);
  if (isAnimationPaid(item)) {
    // Every charge (or use) spent brings the creature back with full life
    system.life.value = system.life.max;
  } else {
    // Worn by its mode (walks: notched; energy: running low): it comes to life with at most half its life
    const worn =
      wearField(item) === 'status'
        ? item.system.status === ItemStatusType.NOTCHED
        : item.system.resources === 'running_low';
    if (worn) system.life.value = Math.min(system.life.value, Math.ceil(system.life.max / 2));
  }
  if (npc) {
    // An NPC dropped on the tab keeps its own name and image; one made from the item follows it
    const keepIdentity = !!npc.getFlag('sdm', KEEP_IDENTITY_FLAG);
    await npc.update({
      ...(keepIdentity ? {} : { name: item.name }),
      system,
      ownership: ownershipFromItem(item)
    });
  } else {
    const folder = await getAnimatedFolder();
    npc = await Actor.create({
      name: item.name,
      img: item.img,
      type: ActorType.NPC,
      folder: folder?.id,
      ownership: ownershipFromItem(item),
      system,
      flags: { sdm: { [FLAG]: item.uuid } }
    });
    // The actor's own creation hook resets the prototype token; set it afterwards
    await npc.update({
      'prototypeToken.actorLink': true,
      'prototypeToken.disposition': dispositionFromItem(item),
      'prototypeToken.texture.src': item.img
    });
  }

  // Glowing items shed light
  const light = lightFromItem(item, canvas.scene);
  // Every animated creature is on its owner's side (also NPCs dropped on the tab); its token is
  // linked unless the Animation tab says otherwise
  await npc.update({
    'prototypeToken.light.bright': light.bright,
    'prototypeToken.light.dim': light.dim,
    'prototypeToken.disposition': dispositionFromItem(item),
    'prototypeToken.actorLink': item.system.animation.linked !== false
  });
  await syncFeatureTraits(item, npc);
  await syncEffectCopies(item, npc);

  await syncWeaponDamage(item, npc);
  await syncPowerCopy(item, npc);
  // The NPC now has the base defense from the item: reset the bonus and add the current one
  await npc.update({ [`flags.sdm.${DEFENSE_BONUS_FLAG}`]: 0 });
  await applyDefenseBonus(item, npc);

  // Place its token first: right-click or Esc cancels the animation (nothing spent, nothing changed)
  const tokensData = [];
  if (placement && !canvas.scene.tokens.some(token => token.actorId === npc.id)) {
    // Placed already by the player who animated it
    const tokenDocument = await npc.getTokenDocument(placement);
    tokensData.push(tokenDocument.toObject());
  } else if (!canvas.scene.tokens.some(token => token.actorId === npc.id)) {
    const restore = app && !app.minimized;
    if (restore) await app.minimize();
    try {
      const placements = await TokenPlacement.place({ tokens: [npc.prototypeToken] });
      for (const placement of placements) {
        delete placement.prototypeToken;
        const tokenDocument = await npc.getTokenDocument(placement);
        tokensData.push(tokenDocument.toObject());
      }
    } catch (error) {
      console.error('SDM | Placing the animated item token failed', error);
    } finally {
      if (restore) await app.maximize();
    }
    if (!tokensData.length) {
      ui.notifications.info($fmt(textKey(item, 'Cancelled'), { name: item.name }));
      return null;
    }
  }

  const update = {
    'system.animation.actor': npc.uuid,
    'system.animation.active': true,
    // Remember whether it was equipped, to equip it again when it turns back into the item
    'flags.sdm.animationWasReadied': !!item.system.readied
  };
  // Animating spends the configured charges (souls, energy…)
  const chargeCost = getAnimationChargeCost(item);
  const usesCounter = getUsesCounter(item);
  if (chargeCost > 0 && usesCounter) {
    const spent = spendUsesUpdate(item, chargeCost) ?? {};
    Object.assign(update, spent);
    // Running low / run out from what is left (none left: run out)
    const next = spent[`system.counters.${usesCounter.key}.value`];
    if (next !== undefined && !item.system.features?.has?.('replenish')) update['system.resources'] = usesResources(usesCounter, next);
  } else if (chargeCost > 0) {
    const charges = Math.max((Number(item.system.charges?.value) || 0) - chargeCost, 0);
    update['system.charges.value'] = charges;
    // Spending the last charges runs it out (like Use and lighting)
    Object.assign(update, charges === 0 ? { 'system.resources': 'run_out' } : lastChargeUpdate(item, charges));
  }
  if (item.system.animation.mode === 'walks') update['system.readied'] = false;
  await item.update(update, { [SYNC_OPTION]: true });
  // A use of an item with replenish: usage roll, or its last use when running low
  if (animationSpendsUsage(item)) await item.spendUsage({ [SYNC_OPTION]: true });

  // The token placed above (none when the creature was already in this scene)
  if (tokensData.length) {
    try {
      await canvas.scene.createEmbeddedDocuments('Token', tokensData, { sdmNoVariation: true });
    } catch (error) {
      console.error('SDM | Failed to place the animated item token', error);
    }
  }

  ui.notifications.info($fmt(textKey(item, 'Animated'), { name: item.name }));
  return npc;
}

/** Remove the creature's tokens and bring its state back to the item. Referee only. */
export async function deanimateItem(item, { reason, from = null } = {}) {
  if (!game.user.isGM || item?.pack) return;
  const npc = getLinkedNpc(item);

  if (npc) {
    // An unlinked token keeps its own state: the item takes it back from that token
    let state = from?.isToken ? from : npc;
    for (const scene of game.scenes) {
      const tokens = scene.tokens.filter(token => token.actorId === npc.id);
      const unlinked = tokens.find(token => !token.actorLink && token.actor);
      if (unlinked && state === npc) state = unlinked.actor;
      const ids = tokens.map(token => token.id);
      if (ids.length) await scene.deleteEmbeddedDocuments('Token', ids, { [SYNC_OPTION]: true });
    }
    const s = state.system;
    await item.update(
      {
        'system.attributes.life.value': s.life.value,
        'system.attributes.life.max': s.life.max,
        'system.attributes.morale': s.morale,
        'system.attributes.defense': baseDefense(state),
        'system.attributes.bonus': s.bonus,
        'system.attributes.damage': s.damage,
        'system.attributes.initiative': s.initiative ?? '',
        // A ride keeps its own capacity, size and speed (the creature only copies them)
        ...(isRideItem(item) ? {} : { 'system.attributes.capacity': s.capacity ?? item.system.attributes.capacity }),
        ...(isRideItem(item)
          ? {}
          : {
              'system.animation.size.value': s.size?.value ?? 1,
              'system.animation.size.unit': s.size?.unit ?? 'sacks',
              'system.animation.speed': s.speed ?? 0
            }),
        'system.animation.active': false
      },
      { [SYNC_OPTION]: true }
    );
  } else {
    await item.update({ 'system.animation.active': false }, { [SYNC_OPTION]: true });
  }

  // Back in its owner's hands: equipped again if it was equipped before, unless it broke
  if (item.getFlag('sdm', 'animationWasReadied')) {
    const update = { 'flags.sdm.animationWasReadied': false };
    if (item.parent && item.system.status !== ItemStatusType.BROKEN) update['system.readied'] = true;
    await item.update(update, { [SYNC_OPTION]: true });
  }

  const reasonKey = reason?.startsWith('SDM.Animation.') ? textKey(item, reason.slice('SDM.Animation.'.length)) : reason;
  ui.notifications.info($fmt(reasonKey ?? textKey(item, 'Deanimated'), { name: item.name }));
}

const WEAR_SEVERITY = {
  status: { '': 0, [ItemStatusType.NOTCHED]: 1, [ItemStatusType.BROKEN]: 2 },
  resources: { '': 0, running_low: 1, run_out: 2 }
};

/**
 * The field the creature wears down, by mode: walks (and rides) wear the integrity
 * (notched / broken), energy the resources (running low / run out). Never both.
 */
export function wearField(item) {
  return isRideItem(item) || item.system.animation?.mode === 'walks' ? 'status' : 'resources';
}

/** True when an update repairs (walks) or recharges (energy) the item: the field its mode wears gets better. */
export function isWearImproved(item, changes) {
  for (const field of [wearField(item)]) {
    const next = changes.system?.[field];
    if (next === undefined) continue;
    const before = WEAR_SEVERITY[field][item.system[field] ?? ''] ?? 0;
    const after = WEAR_SEVERITY[field][next ?? ''] ?? 0;
    if (after < before) return true;
  }
  return false;
}

/** The item was repaired or recharged: its creature is back to full life. */
export async function healAnimatedCreature(item) {
  if (!isAnimatable(item)) return;
  const max = Number(item.system.attributes?.life?.max) || 0;
  if ((Number(item.system.attributes?.life?.value) || 0) < max) {
    await item.update({ 'system.attributes.life.value': max }, { [SYNC_OPTION]: true });
  }
  const npc = getLinkedNpc(item);
  if (npc?.isOwner && (npc.system.life?.value ?? 0) < (npc.system.life?.max ?? 0)) {
    await npc.update({ 'system.life.value': npc.system.life.max });
  }
}

/** The creature fell (0 life): the active Referee turns it back into the item. */
export async function deanimateFallenCreature(npc) {
  if (game.users.activeGM?.id !== game.user.id) return;
  const item = getAnimatedSourceItem(npc);
  if (!item?.system.animation?.active) return;
  if ((Number(npc.system.life?.value) || 0) > 0) return;
  await deanimateItem(item, { reason: 'SDM.Animation.Fell', from: npc });
}

/**
 * The item's level changed (hallmark XP or the Referee): raise the creature.
 * Animated: the NPC levels up; otherwise the item's attributes are raised from the table.
 */
export async function syncAnimationLevel(item, { damageSourceChanged = false } = {}) {
  if (!isAnimatable(item)) return;
  // A ride: its stats follow its level (rideStats.mjs); deployed, its creature takes them
  // (rides: syncDeployedRide follows every change of the ride)
  if (isRideItem(item)) return;
  const level = getAnimationLevel(item);
  const npc = getLinkedNpc(item);
  if (item.system.animation.active && npc) {
    if (level > (npc.system.level ?? 0)) {
      await removeDefenseBonus(npc);
      await npc.levelUpNpcTo(level);
    }
    await applyDefenseBonus(item, npc);
    await syncWeaponDamage(item, npc, { useCreatureDamage: damageSourceChanged });
  } else if (item.system.animation.filled) {
    await fillAttributesFromTable(item, { raiseOnly: true });
  }
}

/**
 * The creature's life wears the item down. It never gets better on its own (repair or
 * recharge as usual).
 * - Walks away: at half life or less the item is notched, at 0 life it is broken.
 * - Energy: at half life or less the item is running low, at 0 life it has run out.
 */
export async function applyAnimatedWear(npc) {
  const item = getAnimatedSourceItem(npc);
  if (!item) return;
  // Paid with charges or a use: that was the price, the item itself is not worn
  if (isAnimationPaid(item)) return;

  const value = Number(npc.system.life?.value) || 0;
  const max = Number(npc.system.life?.max) || 0;
  // A ride is only wrecked at 0 life (broken: repair it before deploying it again)
  if (isRideItem(item)) {
    if (value <= 0 && item.system.status !== ItemStatusType.BROKEN) {
      await item.update({ 'system.status': ItemStatusType.BROKEN }, { [SYNC_OPTION]: true });
    }
    return;
  }
  const stage = value <= 0 ? 2 : max > 0 && value <= max / 2 ? 1 : 0;
  if (!stage) return;

  const field = wearField(item);
  const walks = field === 'status';
  const steps = walks ? ['', ItemStatusType.NOTCHED, ItemStatusType.BROKEN] : ['', 'running_low', 'run_out'];
  const current = Math.max(steps.indexOf(item.system[field] ?? ''), 0);
  if (stage <= current) return;

  const update = { [`system.${field}`]: steps[stage] };
  if (walks && stage === 2) update['system.readied'] = false;
  await item.update(update, { [SYNC_OPTION]: true });
}

/* -------------------------------------------- */
/*  Token HUD                                   */
/* -------------------------------------------- */

export function setupAnimatedItems() {
  Hooks.on('renderTokenHUD', onRenderTokenHUD);
  Hooks.on('deleteCombat', onCombatEnded);
  Hooks.on('deleteItem', onAnimatedItemDeleted);
  Hooks.on('updateItem', onRideChanged);
  Hooks.on('deleteToken', onCreatureTokenDeleted);
  Hooks.on('createActiveEffect', (effect, options) => onRideChanged(effect, null, options));
  Hooks.on('updateActiveEffect', onRideChanged);
  Hooks.on('deleteActiveEffect', (effect, options) => onRideChanged(effect, null, options));
  game.socket.on(CHANNEL, onSocketMessage);
}

/** Any item (world, actors, unlinked tokens) still pointing at this creature. */
function isNpcStillLinked(npcUuid, deletedId) {
  const points = item => item.id !== deletedId && item.system?.animation?.actor === npcUuid;
  if (game.items.some(points)) return true;
  if (game.actors.some(actor => actor.items.some(points))) return true;
  return game.scenes.some(scene =>
    scene.tokens.some(token => !token.actorLink && token.actor?.items?.some(points))
  );
}

/**
 * The item of an animated creature was deleted: its creature goes too (its tokens on every scene
 * and its actor). Skipped when another item still uses the creature (e.g. the item was moved to
 * another actor, which copies it first).
 */
async function onAnimatedItemDeleted(item) {
  if (game.users.activeGM?.id !== game.user.id) return;
  const npcUuid = item.system?.animation?.actor;
  if (!npcUuid) return;
  const npc = fromUuidSync(npcUuid);
  if (npc?.documentName !== 'Actor' || npc.getFlag('sdm', FLAG) !== item.uuid) return;
  if (isNpcStillLinked(npcUuid, item.id)) return;
  for (const scene of game.scenes) {
    const ids = scene.tokens.filter(token => token.actorId === npc.id).map(token => token.id);
    if (ids.length) await scene.deleteEmbeddedDocuments('Token', ids);
  }
  await npc.delete();
  ui.notifications.info($fmt('SDM.Animation.CreatureRemoved', { name: npc.name, item: item.name }));
}

/**
 * The last token of an animated creature or deployed ride deleted by hand: it turns back into its
 * item (back to its sheet; a ride, back to the caravan). Done by the active Referee.
 */
async function onCreatureTokenDeleted(token, options) {
  if (options?.[SYNC_OPTION] || game.users.activeGM?.id !== game.user.id) return;
  const npc = game.actors.get(token.actorId);
  if (!isAnimatedNpc(npc)) return;
  const item = getAnimatedSourceItem(npc);
  if (!item?.system.animation?.active) return;
  // Another token of it still on a scene: it stays
  if (game.scenes.some(scene => scene.tokens.some(t => t.actorId === npc.id))) return;
  await deanimateItem(item);
}

/** Creatures set to "end with combat" turn back into their items when the combat ends. */
async function onCombatEnded(combat) {
  if (game.users.activeGM?.id !== game.user.id) return;
  for (const combatant of combat.combatants) {
    const item = getAnimatedSourceItem(combatant.actor);
    if (item?.system.animation?.active && item.system.animation.endWithCombat) {
      await deanimateItem(item, { reason: 'SDM.Animation.CombatEnded' });
    }
  }
}

/* -------------------------------------------- */
/*  Player requests                             */
/* -------------------------------------------- */

const CHANNEL = 'system.sdm';
const REQUEST_ACTION = 'animateItemRequest';
const RESULT_ACTION = 'animateItemResult';
const DEANIMATE_REQUEST_ACTION = 'deanimateItemRequest';

/** A player asks the Referee to animate one of their items. */
export function requestAnimation(item) {
  if (!item?.isOwner || !isAnimatable(item)) return;
  if (isAnimationBlocked(item)) {
    warnAnimationBlock(item);
    return;
  }
  if (!game.users.activeGM) {
    ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
    return;
  }
  // Players allowed to create and delete tokens animate it themselves: they place its token, the
  // Referee's game makes the creature (no approval asked)
  if (canAnimateWithoutApproval(game.user)) return animateAsPlayer(item);
  game.socket.emit(CHANNEL, { action: REQUEST_ACTION, userId: game.user.id, itemUuid: item.uuid });
  ui.notifications.info($fmt(textKey(item, 'RequestSent'), { name: item.name }));
}

/** Foundry's permissions to create and delete tokens: such players animate without the Referee's approval. */
export function canAnimateWithoutApproval(user = game.user) {
  return !!user && !user.isGM && user.can('TOKEN_CREATE') && user.can('TOKEN_DELETE');
}

/** The player places the token (a preview with the item's image), then the Referee's game animates it there. */
async function animateAsPlayer(item) {
  if (!canvas.scene) {
    ui.notifications.warn($l10n(textKey(item, 'NoScene')));
    return;
  }
  const npc = getLinkedNpc(item);
  const preview = npc ?? new Actor.implementation({ name: item.name, type: ActorType.NPC, img: item.img });
  if (!npc) preview.prototypeToken.updateSource({ texture: { src: item.img } });
  let placements = [];
  try {
    placements = await TokenPlacement.place({ tokens: [preview.prototypeToken] });
  } catch (error) {
    console.error('SDM | Placing the animated item token failed', error);
  }
  const placed = placements[0];
  if (!placed) {
    ui.notifications.info($fmt(textKey(item, 'Cancelled'), { name: item.name }));
    return;
  }
  const { prototypeToken, index, ...placement } = placed;
  game.socket.emit(CHANNEL, {
    action: REQUEST_ACTION,
    userId: game.user.id,
    itemUuid: item.uuid,
    sceneId: canvas.scene.id,
    placement
  });
}

/**
 * A player asks the Referee to turn an animated item back (or recall a ride) — for when they can't
 * delete its token themselves. The Referee approves or declines.
 */
export function requestDeanimation(item) {
  if (!item?.isOwner || !item.system?.animation?.active) return;
  if (!game.users.activeGM) {
    ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
    return;
  }
  game.socket.emit(CHANNEL, { action: DEANIMATE_REQUEST_ACTION, userId: game.user.id, itemUuid: item.uuid });
  ui.notifications.info($fmt(textKey(item, 'DeanimateRequestSent'), { name: item.name }));
}

async function onDeanimateRequest(message) {
  if (game.users.activeGM?.id !== game.user.id) return;
  const user = game.users.get(message.userId);
  const item = fromUuidSync(message.itemUuid);
  const respond = approved =>
    game.socket.emit(CHANNEL, {
      action: RESULT_ACTION,
      userId: message.userId,
      approved,
      itemName: item?.name,
      ride: isRideItem(item),
      deanimate: true
    });
  if (!user || !item?.system?.animation?.active || !item.testUserPermission(user, 'OWNER')) return respond(false);
  const approved = await foundry.applications.api.DialogV2.confirm({
    window: { title: $l10n(textKey(item, 'DeanimateRequestTitle')), icon: isRideItem(item) ? 'fa-solid fa-house-flag' : 'fa-solid fa-box' },
    content: `<p>${$fmt(textKey(item, 'DeanimateRequestPrompt'), { user: user.name, name: item.name, actor: item.parent?.name ?? '' })}</p>`,
    rejectClose: false
  });
  if (approved) await deanimateItem(item);
  respond(!!approved);
}

async function onSocketMessage(message) {
  if (message?.action === RESULT_ACTION && message.userId === game.user.id) {
    const kind = message.ride ? 'SDM.Ride' : 'SDM.Animation';
    const prefix = message.deanimate ? 'DeanimateRequest' : 'Request';
    const key = `${kind}.${prefix}${message.approved ? 'Approved' : 'Denied'}`;
    ui.notifications.info($fmt(key, { name: message.itemName ?? '' }));
    return;
  }
  if (message?.action === DEANIMATE_REQUEST_ACTION) return onDeanimateRequest(message);
  if (message?.action !== REQUEST_ACTION) return;
  if (game.users.activeGM?.id !== game.user.id) return;

  const user = game.users.get(message.userId);
  const item = fromUuidSync(message.itemUuid);
  const respond = approved =>
    game.socket.emit(CHANNEL, {
      action: RESULT_ACTION,
      userId: message.userId,
      approved,
      itemName: item?.name,
      ride: isRideItem(item)
    });
  if (!user || !item || !item.testUserPermission(user, 'OWNER')) return respond(false);

  // Placed by a player allowed to create and delete tokens: animated at once, on the player's scene
  if (message.placement && canAnimateWithoutApproval(user)) {
    if (message.sceneId && canvas.scene?.id !== message.sceneId) {
      ui.notifications.warn($fmt('SDM.Animation.OtherScene', { user: user.name, name: item.name }));
      return respond(false);
    }
    const npc = await animateItem(item, { placement: message.placement });
    return respond(!!npc);
  }

  const approved = await foundry.applications.api.DialogV2.confirm({
    window: { title: $l10n(textKey(item, 'RequestTitle')), icon: isRideItem(item) ? 'fa-solid fa-flag' : 'fa-solid fa-ghost' },
    content: `<p>${$fmt(textKey(item, 'RequestPrompt'), {
      user: user.name,
      name: item.name,
      actor: item.parent?.name ?? ''
    })}</p>`,
    rejectClose: false
  });
  if (approved) await animateItem(item);
  respond(!!approved);
}

function onRenderTokenHUD(hud, html) {
  const token = hud?.document ?? hud?.object?.document;
  const actor = token?.actor;
  const item = getAnimatedSourceItem(actor);
  if (!item) return;
  // Players who own the item ask the Referee (they may not be allowed to delete the token)
  if (!game.user.isGM && !(item.isOwner && item.system.animation?.active)) return;

  const root = html?.querySelectorAll ? html : html?.[0];
  if (!root || root.querySelector(`.${HUD_BUTTON_CLASS}`)) return;

  const label = $l10n(textKey(item, game.user.isGM ? 'Deanimate' : 'DeanimateRequest'));
  const button = document.createElement('button');
  button.type = 'button';
  button.classList.add('control-icon', HUD_BUTTON_CLASS);
  button.dataset.tooltip = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = '<i class="fa-solid fa-box" inert></i>';
  button.addEventListener('click', async event => {
    event.preventDefault();
    event.stopPropagation();
    if (game.user.isGM) await deanimateItem(item);
    else requestDeanimation(item);
  });
  (root.querySelector('.col.right') ?? root).append(button);
}

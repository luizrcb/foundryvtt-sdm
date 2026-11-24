export const UnarmedDamageItem = 'Compendium.sdm.weapons.Item.uKcbcZUs1jQZskQ4';
import { ActorType, DEFAULT_POWER_ICON, GearType, ItemType, SizeUnit } from './constants.mjs';

/** Gear that holds a list of powers: a power album, or gear with the album feature (e.g. the Projector mod). */
export function hasPowerAlbum(item) {
  if (item?.type !== ItemType.GEAR) return false;
  return item.system?.type === GearType.POWER_ALBUM || !!item.system?.features?.has?.('album');
}

/** Power slots of gear that gains the album feature (a power album keeps its own limit). */
export const ALBUM_FEATURE_MAX_POWERS = 3;
/**
 * Convert any size unit to sacks.
 * @param {number} size - The size value.
 * @param {string} unit - The unit of the size ("soaps", "stones", "sacks", or "cash").
 * @returns {number} - The size converted to sacks.
 */
export function convertToSacks(size = 0, unit) {
  let convertionFactor = 1;

  switch (unit) {
    case SizeUnit.SOAPS:
      convertionFactor = 100; // 100 soaps = 1 sack
      break;
    case SizeUnit.STONES:
      convertionFactor = 10; // 10 stones = 1 sack
      break;
    case SizeUnit.SACKS:
      convertionFactor = 1; // Already in sacks
      break;
    case SizeUnit.CASH:
      convertionFactor = 2500; // 2500 cash = 1 sack
      break;
    default:
      convertionFactor = 1;
  }

  return preciseRound(size / convertionFactor, 6);
}

export function convertSizeUnit(value = 0, fromUnit, toUnit) {
  const toCash = {
    [SizeUnit.SOAPS]: 25, // 1 soap = 25 cash
    [SizeUnit.STONES]: 250, // 1 stone = 250 cash
    [SizeUnit.SACKS]: 2500, // 1 sack = 2500 cash
    [SizeUnit.CASH]: 1 // 1 cash = 1 cash
  };

  if (!toCash.hasOwnProperty(fromUnit) || !toCash.hasOwnProperty(toUnit)) {
    throw new Error(`Invalid unit: ${fromUnit} or ${toUnit}`);
  }

  // Convert: value [fromUnit] -> cash -> [toUnit]
  const result = value * (toCash[fromUnit] / toCash[toUnit]);
  return preciseRound(result);
}

export function convertToCash(size = 0, unit) {
  let convertionFactor = 1;

  switch (unit) {
    case SizeUnit.SOAPS:
      convertionFactor = 25;
      break;
    case SizeUnit.STONES:
      convertionFactor = 250; // 10 stones = 1 sack
      break;
    case SizeUnit.SACKS:
      convertionFactor = 2500; // Already in sacks
      break;
    case SizeUnit.CASH:
      convertionFactor = 1; // 2500 cash = 1 sack
      break;
    default:
      convertionFactor = 1;
  }

  return convertionFactor * size;
}

// Add a rounding helper function
export function preciseRound(value, decimals = 4) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export const GEAR_ITEM_TYPES = ['gear'];
export const TRAIT_ITEM_TYPES = ['trait'];
export const BURDEN_ITEM_TYPES = ['burden'];
export const ITEMS_NOT_ALLOWED_IN_CHARACTERS = [];
export const ITEMS_NOT_ALLOWED_IN_CARAVANS = ['trait', 'burden'];
export const SUBTYPES_NOT_ALLOWED_IN_CARAVANS = ['corruption', 'affliction'];
export const ITEMS_ALLOWED_IN_CONTAINERS = [
  GearType.ARMOR,
  GearType.POWER,
  GearType.POWER_ALBUM,
  GearType.WARD,
  GearType.WEAPON,
  GearType.PET,
  ''
];

// Add this method to handle item updates
export async function onItemUpdate(item, updateData) {
  if (item.type === ItemType.GEAR) {
    if (updateData?.system?.readied !== undefined) {
      for (const effect of item.effects) {
        await toggleEffectTransfer(effect, updateData?.system?.readied);
      }
      return;
    }
    if (updateData?.system?.status === 'broken') {
      for (const effect of item.effects) {
        await toggleEffectTransfer(effect, false);
      }
      return;
    }

    if (updateData?.system?.status !== 'broken') {
      if (['corruption', 'affliction', 'augment', 'pet'].includes(item.system.type)) {
        for (const effect of item.effects) {
          await toggleEffectTransfer(effect, true);
        }
      }
      return;
    }
  }
}

/** An Item Piles pile (an item lying on the map, a chest…), when the module is active. */
export function isItemPileActor(actor) {
  if (!actor || !game.modules.get('item-piles')?.active) return false;
  try {
    if (game.itempiles?.API?.isValidItemPile) return !!game.itempiles.API.isValidItemPile(actor);
  } catch {
    /* fall back to the flag */
  }
  return !!actor.getFlag?.('item-piles', 'data')?.enabled;
}

export async function onItemCreateActiveEffects(item) {
  if (item.type === ItemType.GEAR) {
    if (item.getFlag?.('sdm', 'fromCompendium') === UnarmedDamageItem) {
      return;
    }

    if (['corruption', 'affliction', 'augment', 'pet'].includes(item.system.type)) return;

    // Picked up from an Item Piles pile: its effects stay as they were on the ground (an aura keeps
    // radiating, now from its new bearer)
    const inPile = isItemPileActor(item.parent);
    if (!inPile && item.getFlag?.('sdm', PILE_FLAG)) {
      if (item.isOwner) await item.unsetFlag('sdm', PILE_FLAG);
      return;
    }

    for (const effect of item.effects) {
      let enabledEffect = false;
      if (item.parent && item.parent.type === ActorType.CARAVAN) {
        enabledEffect = true;
      }
      // An item lying on the map (an Item Piles pile): its effects are on, so its aura radiates from there
      if (inPile) enabledEffect = true;
      await toggleEffectTransfer(effect, enabledEffect);
    }
    // Marked as lying in a pile: whoever picks it up gets it with its effects as they are
    if (inPile && item.isOwner && !item.getFlag?.('sdm', PILE_FLAG)) await item.setFlag('sdm', PILE_FLAG, true);
  }
}

/** On an item lying in an Item Piles pile (its data goes with it when picked up). */
const PILE_FLAG = 'fromPile';

async function toggleEffectTransfer(effect, shouldBeActive) {
  const effectUpdates = {};
  if (!effect.transfer) return;
  if (shouldBeActive) {
    // Enable transfer and activate effect
    effectUpdates.disabled = false;
    effectUpdates['flags.core.statusId'] = null; // Clear disabled status
    //effectUpdates.transfer = true;
  } else {
    // Disable transfer and deactivate effect
    effectUpdates.disabled = true;
    // effectUpdates.transfer = false;
  }

  await effect.update(effectUpdates);
}

export function getSlotsTaken(itemSystem) {
  // An animated item that walked away does not weigh on its owner, nor a light left on the map
  if (itemSystem?.animation?.active && itemSystem.animation.mode === 'walks') return 0;
  if (itemSystem?.parent?.getFlag?.('sdm', 'lightLeft')) return 0;

  if (itemSystem?.slots_override !== undefined && itemSystem?.slots_override >= 0) {
    return itemSystem?.slots_override;
  }

  let slotsTaken = Math.ceil(
    convertToCash(itemSystem.quantity * itemSystem.size?.value, itemSystem.size?.unit) / 250
  );

  if (slotsTaken === 0 && itemSystem.size?.unit === SizeUnit.CASH) return slotsTaken;

  if (itemSystem.size?.unit === SizeUnit.CASH) {
    if (slotsTaken === 0) return slotsTaken;
    const weightRules = game.settings.get('sdm', 'currencyWeight');
    if (weightRules === 'weightless') return 0;
    if (weightRules === 'single_stone') return 1;
  }

  slotsTaken = Math.max(slotsTaken || 1, 1);

  if (itemSystem.size?.unit === SizeUnit.SOAPS && itemSystem.quantity > 1 && itemSystem.readied) {
    slotsTaken = itemSystem.quantity;
  }

  return slotsTaken;
}

export async function makePowerItem({
  name,
  img = DEFAULT_POWER_ICON,
  description,
  level,
  range,
  target,
  duration,
  overcharge,
  roll_formula,
  overcharge_roll_formula
}) {
  const itemData = {
    name,
    img,
    type: 'gear',
    system: {
      description,
      type: 'power',
      power: {
        level,
        range,
        target,
        duration,
        overcharge,
        roll_formula,
        overcharge_roll_formula
      }
    }
  };

  await Item.create(itemData);
}

export function getWealthFromItems(itemsArray = []) {
  return itemsArray.items.reduce((acc, item) => {
    const qty = item?.system?.quantity || 1;

    if (item.type === ItemType.GEAR && item.system.size.unit !== SizeUnit.CASH) {
      acc += (item?.system?.cost || 0) * qty;
    } else if (item.system.size.unit === SizeUnit.CASH) {
      acc += (item?.system?.size?.value || 1) * qty;
    }

    return acc;
  }, 0);
}

export function checkIfItemIsAlsoAnArmor(item) {
  if (!item || typeof item !== 'object') return false;

  const sys = item.system ?? (item.data && item.data.system) ?? {};
  const type = String(sys.type ?? '').toLowerCase();
  if (!(type === GearType.WEAPON || type === GearType.WARD)) return false;

  const effects = Array.from(item.effects);
  if (!effects.length) return false;

  const isArmor = effects.some(effect => {
    if (!effect || !Array.isArray(effect.system.changes)) return false;
    return effect.system.changes.some(change => String(change?.key ?? '') === 'system.armor_bonus');
  });

  return !!isArmor;
}

export function registerActiveEffectLimit() {
  // ---- Creation ---------------------------------------------------------
  Hooks.on('preCreateActiveEffect', (effect, data, options, userId) => {
    const parent = effect.parent;
    if (parent?.documentName !== 'Item') return;

    const isItemMod = data.system?.isItemMod ?? effect.system?.isItemMod ?? false;
    const modType = data.system?.modType ?? effect.system?.modType ?? '';

    if (!isItemMod) return;

    // Rides (mounts and vehicles) take ride mods only, up to their level + 1; gear never takes them
    if (isRide(parent)) {
      if (modType !== 'ride') {
        warnInvalidItemMod(parent);
        return false;
      }
      if (isAtItemModCap(parent)) {
        warnItemModCap(parent);
        return false;
      }
      return;
    }
    if (modType === 'ride') {
      warnInvalidItemMod(parent);
      return false;
    }

    if (parent.type !== ItemType.GEAR) {
      // warn and return false
      warnInvalidItemMod(parent);
      return false;
    }

    const itemType = parent.system.type;

    if (!modType) {
      warnInvalidItemMod(parent);
      return false;
    }

    if (modType !== 'gear' && !modType.includes(itemType)) {
      if (
        (modType === 'weapon' && parent.system.features.has('weapon')) ||
        (modType === 'armor_ward' &&
          (parent.system.features.has('armor') || parent.system.features.has('ward')))
      ) {
        return true;
      }
      warnInvalidItemMod(parent);
      return false;
    }

    // A mod gained as a hallmark upgrade does not use a mod slot
    if (data.system?.isHallmarkUpgrade ?? effect.system?.isHallmarkUpgrade) return;

    if (isAtItemModCap(parent)) {
      warnItemModCap(parent);
      return false;
    }
  });

  // ---- Update -----------------------------------------------------------
  Hooks.on('preUpdateActiveEffect', (effect, changes, options, userId) => {
    const parent = effect.parent;
    if (parent?.documentName !== 'Item') return;

    // A hallmark upgrade becoming a regular mod now needs a free mod slot
    if (
      changes.system?.isHallmarkUpgrade === false &&
      effect.system?.isHallmarkUpgrade &&
      (changes.system?.isItemMod ?? effect.system?.isItemMod) &&
      isAtItemModCap(parent, effect.id)
    ) {
      warnItemModCap(parent);
      return false;
    }

    // Only care about turning the flag ON.
    const becomingItemMod = changes.system?.isItemMod === true;
    const alreadyItemMod = effect.system?.isItemMod === true;

    const changingModType = changes.system?.modType !== undefined;

    if (!becomingItemMod || (alreadyItemMod && !changingModType)) return;

    // Exclude this effect from the count so we don't count it twice.
    if (isAtItemModCap(parent, effect.id)) {
      warnItemModCap(parent);
      return false; // cancels the update
    }

    if (changingModType) {
      const newModType = changes.system?.modType;
      const invalid = isRide(parent)
        ? newModType !== 'ride'
        : !newModType || newModType === 'ride' || (newModType !== 'gear' && !newModType.includes(parent.system.type));

      if (
        (newModType === 'weapon' && parent.system.features.has('weapon')) ||
        (newModType === 'armor_ward' &&
          (parent.system.features.has('armor') || parent.system.features.has('ward')))
      ) {
        return;
      }

      if (invalid) {
        warnInvalidItemMod(parent);
        changes.disabled = true;
      }
    }
  });
}

// ---------------------------------------------------------------------------
/** A mount or a vehicle (a "ride" in the book). */
function isRide(item) {
  return item?.type === ItemType.MOUNT || item?.type === ItemType.VEHICLE;
}

/** How many mods an item takes: a ride its level + 1 (the book), other items their hallmark level + 1. */
export function itemModLimit(item) {
  const level = isRide(item) ? Number(item.system?.level) || 0 : item.system?.hallmark?.level ?? 0;
  return level + 1;
}

function isAtItemModCap(item, excludeId = null) {
  const max = itemModLimit(item);
  const current = item.effects.filter(
    e => e.id !== excludeId && e.system?.isItemMod === true && !e.system?.isHallmarkUpgrade
  ).length;
  return current >= max;
}

function warnItemModCap(item) {
  const max = itemModLimit(item);
  ui.notifications.warn(game.i18n.format('SDM.Warn.ItemModLimit', { max }));
}

function warnInvalidItemMod(item) {
  ui.notifications.warn(game.i18n.localize('SDM.InvalidItemMod'));
}

const DESCRIPTION_EXCERPT_LENGTH = 220;

/**
 * A short plain-text excerpt of an item description for tooltips: GM secrets removed,
 * enricher links reduced to their labels, inline rolls to their formula, first paragraph only,
 * cut at about 220 characters. Returned HTML-escaped (tooltips are rendered as HTML).
 */
export function getDescriptionExcerpt(html = '', maxLength = DESCRIPTION_EXCERPT_LENGTH) {
  if (!html || typeof html !== 'string') return '';
  const cleaned = html
    .replace(/@\w+\[[^\]]*\]\{([^}]*)\}/g, '$1') // @UUID[...]{Label} → Label
    .replace(/@\w+\[[^\]]*\]/g, '') // @UUID[...] without a label
    .replace(/\[\[\/\w+\s+([^\]]*?)(?:#[^\]]*)?\]\](?:\{([^}]*)\})?/g, (m, formula, label) => label || formula) // [[/r 1d6]]{Label}
    .replace(/\[\[([^\]]*)\]\]/g, '$1'); // [[1d6]]
  const div = document.createElement('div');
  div.innerHTML = cleaned;
  div.querySelectorAll('section.secret, .secret').forEach(el => el.remove());
  const blocks = [...div.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, td')];
  const first = blocks.map(el => el.textContent.trim()).find(text => text);
  let text = (first ?? div.textContent).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length > maxLength) {
    const cut = text.slice(0, maxLength);
    const space = cut.lastIndexOf(' ');
    text = `${(space > maxLength * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, '')}…`;
  }
  return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/**
 * Spending charges down to the last one of an item with more than one: running low
 * (not on replenish items, whose resources come from the usage roll; never over run out).
 * Returns an update fragment ({} when nothing changes).
 */
export function lastChargeUpdate(item, newValue) {
  const system = item.system;
  if (system.features?.has?.('replenish')) return {};
  const max = Number(system.charges?.max) || 0;
  const current = Number(system.charges?.value) || 0;
  if (max > 1 && newValue === 1 && current > 1 && system.resources === '') {
    return { 'system.resources': 'running_low' };
  }
  return {};
}

/**
 * Rolls of an inventory row: the item's subtype owns the image (weapon damage, power, power
 * album); features add small icons (weapon feature: damage, album feature: its powers). Gear with
 * no subtype roll uses its first feature roll as the image.
 * Returns { image: 'damage'|'power'|'power_album'|null, icons: [...] } (nothing when it can't roll).
 */
export function getRowRolls(item, actorType, editable = true) {
  const none = { image: null, icons: [] };
  const system = item?.system;
  if (!system || !editable || actorType === 'caravan') return none;
  if (system.status === 'broken' || system.size?.unit === 'cash') return none;
  // Run out: only items marked "works when run out" keep their damage roll (nothing else)
  const runOut = system.resources === 'run_out';
  if (runOut && !system.works_when_run_out) return none;
  if (!system.readied) return none;
  const has = feature => !!system.features?.has?.(feature);
  const canDamage = (system.type === 'weapon' || has('weapon')) && !!system.weapon?.damage?.base;
  const canAlbum = !runOut && hasPowerAlbum(item) && (system.powers?.length ?? 0) > 0;

  let image = null;
  if (system.type === 'weapon') image = canDamage ? 'damage' : null;
  else if (system.type === 'power') image = 'power';
  else if (system.type === 'power_album') image = canAlbum ? 'power_album' : null;
  else if (canDamage) image = 'damage';
  else if (canAlbum) image = 'power_album';

  const icons = [];
  if (canDamage && image !== 'damage') icons.push('damage');
  if (canAlbum && image !== 'power_album') icons.push('power_album');
  return { image, icons };
}

/* -------------------------------------------- */
/*  Item mods: what they are, at a glance       */
/* -------------------------------------------- */

/** Hover text of an item mod: a mod (or a hallmark upgrade), off when switched off, and the start of its description. */
export function modTooltip(effect) {
  if (!effect?.system?.isItemMod) return '';
  const kind = game.i18n.localize(effect.system.isHallmarkUpgrade ? 'SDM.Mod.MarkUpgrade' : 'SDM.Mod.Mark');
  const off = effect.disabled ? game.i18n.localize('SDM.Mod.Off') : '';
  return [[kind, off].filter(Boolean).join(' — '), getDescriptionExcerpt(effect.description)].filter(Boolean).join('<br>');
}

/** The mods on an item, installed ones first (those using a mod slot), then hallmark upgrades. */
export function itemMods(item) {
  const mods = (item?.effects?.contents ?? []).filter(effect => effect.system?.isItemMod);
  return mods
    .sort((a, b) => Number(!!a.system.isHallmarkUpgrade) - Number(!!b.system.isHallmarkUpgrade))
    .map(effect => ({
      id: effect.id,
      parentId: item.id,
      name: effect.name,
      upgrade: !!effect.system.isHallmarkUpgrade,
      disabled: !!effect.disabled,
      tooltip: `<b>${foundry.utils.escapeHTML(effect.name)}</b><br>${modTooltip(effect)}`
    }));
}

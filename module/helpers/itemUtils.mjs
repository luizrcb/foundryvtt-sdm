import { ItemType, SizeUnit } from './constants.mjs';
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
export const ITEMS_NOT_ALLOWED_IN_CHARACTERS = ['mount', 'vehicle'];

// Add this method to handle item updates
export async function onItemUpdate(item, updateData) {
  if (item.type === ItemType.GEAR) {
    if (updateData?.system?.readied !== undefined) {
      for (const effect of item.effects) {
        await toggleEffectTransfer(effect, updateData?.system?.readied);
      }
    }
  }
}

export async function onItemCreateActiveEffects(item) {
  if (item.type === ItemType.GEAR) {
    for (const effect of item.effects) {
      await toggleEffectTransfer(effect, false);
    }
  }
}

async function toggleEffectTransfer(effect, shouldBeActive) {
  const effectUpdates = {};

  if (shouldBeActive) {
    // Enable transfer and activate effect
    effectUpdates.disabled = false;
    effectUpdates['flags.core.statusId'] = null; // Clear disabled status
    effectUpdates.transfer = true;
  } else {
    // Disable transfer and deactivate effect
    effectUpdates.disabled = true;
    effectUpdates.transfer = false;
  }

  await effect.update(effectUpdates);
}

export function getSlotsTaken(itemSystem) {
  let slotsTaken = Math.ceil(
    convertToCash(itemSystem.quantity * itemSystem.size?.value, itemSystem.size?.unit) / 250
  );
  slotsTaken = Math.max(slotsTaken || 1, 1);

  if (itemSystem.size?.unit !== SizeUnit.CASH && itemSystem.quantity > 1 && itemSystem.readied) {
    slotsTaken *= itemSystem.quantity;
  }

  return slotsTaken;
}

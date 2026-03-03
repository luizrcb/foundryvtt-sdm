// helpers/stackUtils.mjs

import { ActorType, SizeUnit } from './constants.mjs';
import { getSlotsTaken } from './itemUtils.mjs';

const FLAG_SCOPE = 'sdm';
const FLAG_SACK = 'sackIndex';

function findMaxThatFits(actor, containerId, baseSystem, totalQty, ignoreIds = []) {
  const container = fromUuidSync(containerId);
  if (!container) return { inside: 0, outside: totalQty };

  const maxSlots = container.system.capacity?.max ?? 0;

  // Exclude any item whose id is in the ignore list
  const otherInside = actor.items.filter(
    i => i.system.container === containerId && !ignoreIds.includes(i.id)
  );

  const usedSlots = otherInside.reduce((sum, i) => sum + getSlotsTaken(i.system), 0);

  const availableSlots = maxSlots - usedSlots;
  if (availableSlots <= 0) return { inside: 0, outside: totalQty };

  let insideQty = totalQty;

  while (insideQty > 0) {
    const test = { ...baseSystem, quantity: insideQty };
    if (getSlotsTaken(test) <= availableSlots) break;
    insideQty--;
  }

  return {
    inside: insideQty,
    outside: totalQty - insideQty
  };
}

/**
 * Split a stack item into N single-quantity items.
 * By default keeps the original as quantity=1 and creates (N-1) new items.
 *
 * @param {Item} item                     The embedded Item (must have a parent actor).
 * @param {object} [opts]
 * @param {number} [opts.count]           How many singles to end up with (default = current quantity).
 * @param {boolean} [opts.keepOnOriginal] Keep one on the original doc (default true).
 * @returns {Promise<{created: Item[], updated: Item|null}>}
 */
export async function splitStackIntoSingles(item, opts = {}) {
  if (!item?.parent) throw new Error('splitStackIntoSingles: item has no parent actor.');
  const actor = item.parent;
  const isCaravan = actor.type === ActorType.CARAVAN; // import ActorType

  const currentQty = Number(item.system?.quantity ?? 1) || 1;
  const count = Math.max(1, Number(opts.count ?? currentQty));
  const keepOnOriginal = opts.keepOnOriginal !== false;

  if (currentQty <= 1 && count <= 1) {
    return { created: [], updated: null };
  }

  const containerId = item.system?.container;
  const totalQty = count;
  const sackIdx = isCaravan ? (item.getFlag(FLAG_SCOPE, FLAG_SACK) ?? 0) : null; // only relevant for caravans

  // Helper to get max sort in a sack (caravan only) or globally
  const getMaxSortInSack = (excludeIds = []) => {
    if (!isCaravan) return 0;
    const itemsInSack = actor.items.filter(
      i => (i.getFlag(FLAG_SCOPE, FLAG_SACK) ?? 0) === sackIdx && !excludeIds.includes(i.id)
    );
    return itemsInSack.reduce((max, i) => Math.max(max, i.sort || 0), 0);
  };

  if (containerId) {
    const { inside, outside } = findMaxThatFits(actor, containerId, item.system, totalQty, [
      item.id
    ]);

    let updated = null;
    let created = [];

    if (keepOnOriginal) {
      [updated] = await actor.updateEmbeddedDocuments('Item', [
        { _id: item.id, system: { quantity: inside } }
      ]);
    } else {
      await actor.deleteEmbeddedDocuments('Item', [item.id]);
    }

    if (outside > 0) {
      const overflow = item.toObject();
      delete overflow._id;
      overflow.system.quantity = outside;
      overflow.system.container = '';
      overflow.system.readied = false;

      if (isCaravan) {
        foundry.utils.setProperty(overflow, `flags.${FLAG_SCOPE}.${FLAG_SACK}`, sackIdx);
        const maxSort = getMaxSortInSack([item.id]);
        overflow.sort = maxSort + 100;
      } else {
        // Non‑caravan: place after the container block
        const container = fromUuidSync(containerId);
        const children = actor.items.filter(i => i.system.container === containerId);
        const blockMaxSort = Math.max(container?.sort || 0, ...children.map(c => c.sort || 0));
        overflow.sort = blockMaxSort + 1;
      }

      created = await actor.createEmbeddedDocuments('Item', [overflow]);
    }

    return { created, updated };
  }

  // Non‑container branch
  const base = item.toObject();
  delete base._id;
  base.system = { ...(base.system ?? {}), quantity: 1, readied: false };
  if (isCaravan) {
    foundry.utils.setProperty(base, `flags.${FLAG_SCOPE}.${FLAG_SACK}`, sackIdx);
  }

  const toCreate = keepOnOriginal ? count - 1 : count;
  const createdData = [];

  if (isCaravan) {
    // Compute base sort: after all other items in the same sack
    const excludeIds = keepOnOriginal ? [item.id] : [];
    let nextSort = getMaxSortInSack(excludeIds) + 100;
    for (let i = 0; i < toCreate; i++) {
      const copy = foundry.utils.duplicate(base);
      copy.sort = nextSort + i; // sequential to preserve order
      createdData.push(copy);
    }
  } else {
    // Non‑caravan: no sort assignment (leave to default)
    for (let i = 0; i < toCreate; i++) {
      createdData.push(foundry.utils.duplicate(base));
    }
  }

  let updated = null;
  if (keepOnOriginal) {
    if (item.system?.quantity !== 1) {
      [updated] = await actor.updateEmbeddedDocuments('Item', [
        { _id: item.id, system: { quantity: 1 } }
      ]);
    }
  } else {
    await actor.deleteEmbeddedDocuments('Item', [item.id]);
  }

  const created = createdData.length
    ? await actor.createEmbeddedDocuments('Item', createdData)
    : [];

  return { created, updated };
}

/**
 * Split a stack item into two stacks whose quantities sum to the original.
 * Updates the original to `firstQty` and creates one new item with `remainder`.
 *
 * @param {Item} item              The embedded Item (must have a parent actor).
 * @param {number} firstQty        Quantity to leave on the original (1..currentQty-1).
 * @returns {Promise<{created: Item|null, updated: Item|null}>}
 */
export async function splitStackIntoTwo(item, firstQty) {
  if (!item?.parent) throw new Error('splitStackIntoTwo: item has no parent actor.');
  const actor = item.parent;
  const isCaravan = actor.type === ActorType.CARAVAN;

  const currentQty = Number(item.system?.quantity ?? 1) || 1;
  const q1 = Math.max(1, Math.min(currentQty - 1, Number(firstQty)));
  const q2 = currentQty - q1;

  if (!(q1 >= 1 && q2 >= 1)) {
    throw new Error('splitStackIntoTwo: firstQty must be between 1 and currentQty-1.');
  }

  const containerId = item.system?.container;
  const sackIdx = isCaravan ? (item.getFlag(FLAG_SCOPE, FLAG_SACK) ?? 0) : null;

  if (containerId) {
    const container = fromUuidSync(containerId);
    if (!container) throw new Error('splitStackIntoTwo: container not found.');

    const maxSlots = container.system.capacity?.max ?? 0;
    const otherInside = actor.items.filter(
      i => i.system.container === containerId && i.id !== item.id
    );
    const usedSlots = otherInside.reduce((sum, i) => sum + getSlotsTaken(i.system), 0);
    const availableSlots = maxSlots - usedSlots;

    const testKeep = { ...item.system, quantity: q1 };
    const testNew = { ...item.system, quantity: q2 };
    const slotsNeeded = getSlotsTaken(testKeep) + getSlotsTaken(testNew);

    // Helper to get max sort among loose items in the same sack (caravan only)
    const getMaxLooseSortInSack = (excludeIds = []) => {
      if (!isCaravan) return 0;
      const looseInSack = actor.items.filter(
        i =>
          !i.system.container &&
          (i.getFlag(FLAG_SCOPE, FLAG_SACK) ?? 0) === sackIdx &&
          !excludeIds.includes(i.id)
      );
      return looseInSack.reduce((max, i) => Math.max(max, i.sort || 0), 0);
    };

    // Case 1: both stacks fit inside container
    if (slotsNeeded <= availableSlots) {
      const [updated] = await actor.updateEmbeddedDocuments('Item', [
        { _id: item.id, system: { quantity: q1 } }
      ]);

      const containerItem = fromUuidSync(containerId);
      const children = actor.items
        .filter(i => i.system.container === containerId)
        .sort((a, b) => a.sort - b.sort);

      let insertSort;
      if (children.length) {
        insertSort = children[children.length - 1].sort + 0.001;
      } else {
        insertSort = (containerItem?.sort ?? 0) + 0.001;
      }

      const copy = item.toObject();
      delete copy._id;
      copy.system.quantity = q2;
      copy.system.container = containerId;
      copy.sort = insertSort;
      if (isCaravan) {
        // Ensure sack flag matches container
        foundry.utils.setProperty(copy, `flags.${FLAG_SACK}.${FLAG_SACK}`, sackIdx);
      }

      const [created] = await actor.createEmbeddedDocuments('Item', [copy]);
      return { created, updated };
    }

    // Case 2: new stack must go outside container
    const [updated] = await actor.updateEmbeddedDocuments('Item', [
      { _id: item.id, system: { quantity: q1 } }
    ]);

    const copy = item.toObject();
    delete copy._id;
    copy.system.quantity = q2;
    copy.system.container = '';
    copy.system.readied = false;

    if (isCaravan) {
      foundry.utils.setProperty(copy, `flags.${FLAG_SCOPE}.${FLAG_SACK}`, sackIdx);
      const maxLoose = getMaxLooseSortInSack([item.id]);
      copy.sort = maxLoose + 100;
    } else {
      // Non‑caravan: place after the container block
      const container = fromUuidSync(containerId);
      const children = actor.items.filter(i => i.system.container === containerId);
      const blockMaxSort = Math.max(container?.sort || 0, ...children.map(c => c.sort || 0));
      copy.sort = blockMaxSort + 0.001;
    }

    const [created] = await actor.createEmbeddedDocuments('Item', [copy]);
    return { created, updated };
  }

  // Non‑container branch (unchanged, but add caravan handling if needed)
  const copy = item.toObject();
  delete copy._id;
  copy.system = { ...(copy.system ?? {}), quantity: q2, readied: false };
  if (isCaravan) {
    foundry.utils.setProperty(copy, `flags.${FLAG_SCOPE}.${FLAG_SACK}`, sackIdx);
    // Place at end of sack
    const excludeIds = [item.id];
    const itemsInSack = actor.items.filter(
      i => (i.getFlag(FLAG_SCOPE, FLAG_SACK) ?? 0) === sackIdx && !excludeIds.includes(i.id)
    );
    const maxSort = itemsInSack.reduce((max, i) => Math.max(max, i.sort || 0), 0);
    copy.sort = maxSort + 100;
  }

  const [created] = await actor.createEmbeddedDocuments('Item', [copy]);

  const [updated] = await actor.updateEmbeddedDocuments('Item', [
    { _id: item.id, system: { quantity: q1 } }
  ]);

  return { created, updated };
}

/**
 * Merge all similar stackable items on the parent actor into the given item.
 * Similar means: same name, same .type, same .system.type ('' allowed).
 * Sums system.quantity across all similar items (including the target),
 * writes the total into the target, and deletes the others.
 *
 * @param {Item} item
 * @param {object} [opts]
 * @param {boolean} [opts.caseSensitive=true]  Match name with case sensitivity.
 * @returns {Promise<{ kept: Item, deletedIds: string[], totalQuantity: number }>}
 */
export async function mergeSimilarItems(item, opts = {}) {
  if (!item?.parent) throw new Error('mergeSimilarItems: item has no parent actor.');
  const actor = item.parent;
  const isCaravan = actor.type === ActorType.CARAVAN;

  const caseSensitive = opts.caseSensitive ?? true;
  const qtyOf = i => Number(i?.system?.quantity);
  const isStackable = i => Number.isFinite(qtyOf(i));

  // Skip merging for caravan supplies (sacks themselves)
  if (
    actor.type === ActorType.CARAVAN &&
    !!item.system.is_supply &&
    item.system.size.unit === SizeUnit.SACKS
  ) {
    return { kept: item, deletedIds: [], totalQuantity: qtyOf(item) || 0 };
  }

  const nameKey = caseSensitive ? item.name : (item.name ?? '').toLowerCase();
  const typeKey = item.type;
  const sysTypeKey = item.system?.type ?? '';

  const similars = actor.items.filter(i => {
    const sameName = caseSensitive ? i.name === nameKey : (i.name ?? '').toLowerCase() === nameKey;
    const sameType = i.type === typeKey;
    const sameSysType = (i.system?.type ?? '') === sysTypeKey;
    return sameName && sameType && sameSysType && isStackable(i);
  });

  if (similars.length <= 1) {
    return { kept: item, deletedIds: [], totalQuantity: qtyOf(item) || 0 };
  }

  const totalQty = similars.reduce((acc, i) => acc + (qtyOf(i) || 0), 0);
  const containerId = item.system?.container;
  const sackIdx = isCaravan ? (item.getFlag(FLAG_SCOPE, FLAG_SACK) ?? 0) : null;

  if (containerId) {
    // Ignore all items that are part of the merge when calculating available space
    const ignoreIds = similars.map(i => i.id);
    const { inside, outside } = findMaxThatFits(
      actor,
      containerId,
      item.system,
      totalQty,
      ignoreIds
    );

    // Determine which item will be kept (the merge target)
    const keptItem = item;
    const toDelete = similars.filter(i => i.id !== keptItem.id).map(i => i.id);

    // --- Step 1: Delete all other merging items (free up their slots) ---
    if (toDelete.length) {
      await actor.deleteEmbeddedDocuments('Item', toDelete);
    }

    // --- Step 2: Handle the kept item based on 'inside' ---
    if (inside > 0) {
      // Update kept item to the new quantity (it will now fit)
      if (keptItem.system.quantity !== inside) {
        await keptItem.update({ system: { quantity: inside } });
      }
    } else {
      // No room inside the container at all → move the entire merged stack outside
      // Delete the kept item as well (it will be replaced by an outside item)
      await actor.deleteEmbeddedDocuments('Item', [keptItem.id]);
    }

    // --- Step 3: Create overflow outside item if needed ---
    if (outside > 0) {
      const overflow = keptItem.toObject(); // use keptItem's template (even if it was deleted, toObject() still works)
      delete overflow._id;
      overflow.system.quantity = outside;
      overflow.system.container = '';
      overflow.system.readied = false;

      if (isCaravan) {
        foundry.utils.setProperty(overflow, `flags.${FLAG_SCOPE}.${FLAG_SACK}`, sackIdx);
        // Place at end of sack's loose items
        const looseInSack = actor.items.filter(
          i => !i.system.container && (i.getFlag(FLAG_SCOPE, FLAG_SACK) ?? 0) === sackIdx
        );
        const maxLoose = looseInSack.reduce((max, i) => Math.max(max, i.sort || 0), 0);
        overflow.sort = maxLoose + 100;
      } else {
        // Non‑caravan: place after the container block
        const container = fromUuidSync(containerId);
        const children = actor.items.filter(i => i.system.container === containerId);
        const blockMax = Math.max(container.sort, ...children.map(c => c.sort || 0));
        overflow.sort = blockMax + 100;
      }

      await actor.createEmbeddedDocuments('Item', [overflow]);
    }

    // Determine the final kept item (it might have been deleted if inside === 0)
    const finalKept = inside > 0 ? actor.items.get(keptItem.id) : null;

    return {
      kept: finalKept,
      deletedIds: [...toDelete, ...(inside === 0 ? [keptItem.id] : [])],
      totalQuantity: totalQty
    };
  }

  // --- Non‑container branch (unchanged, but add caravan handling if needed) ---
  const keepId = item.id;
  const toDelete = similars.filter(i => i.id !== keepId).map(i => i.id);

  await actor.updateEmbeddedDocuments('Item', [{ _id: keepId, system: { quantity: totalQty } }]);

  if (toDelete.length) {
    await actor.deleteEmbeddedDocuments('Item', toDelete);
  }

  return {
    kept: actor.items.get(keepId),
    deletedIds: toDelete,
    totalQuantity: totalQty
  };
}

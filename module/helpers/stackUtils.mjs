// helpers/stackUtils.mjs

import { ActorType, SizeUnit } from './constants.mjs';

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

  const currentQty = Number(item.system?.quantity ?? 1) || 1;
  const count = Math.max(1, Number(opts.count ?? currentQty));
  const keepOnOriginal = opts.keepOnOriginal !== false; // default true

  // Nothing to do if already singles or count <= 1
  if (currentQty <= 1 && count <= 1) {
    return { created: [], updated: null };
  }

  // We will end with exactly `count` items of qty=1.
  // Strategy: set original to 1 (or delete it) and create the rest as copies.
  const base = item.toObject();
  delete base._id;
  // Preserve flags/placement; ensure single quantity and not readied
  base.system = { ...(base.system ?? {}), quantity: 1, readied: false };

  const createdData = [];
  // Number of new docs to create:
  // - If keeping one on original: count-1 new docs
  // - If not keeping: count new docs, original will be deleted
  const toCreate = keepOnOriginal ? count - 1 : count;
  for (let i = 0; i < toCreate; i++) createdData.push(foundry.utils.duplicate(base));

  // Batch ops
  let created = [];
  let updated = null;

  if (keepOnOriginal) {
    if (item.system?.quantity !== 1) {
      [updated] = await actor.updateEmbeddedDocuments('Item', [
        { _id: item._id, system: { quantity: 1 } }
      ]);
    }
  } else {
    // Remove the original entirely
    await actor.deleteEmbeddedDocuments('Item', [item.id]);
  }

  if (createdData.length) {
    created = await actor.createEmbeddedDocuments('Item', createdData);
  }

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

  const currentQty = Number(item.system?.quantity ?? 1) || 1;
  const q1 = Math.max(1, Math.min(currentQty - 1, Number(firstQty)));
  const q2 = currentQty - q1;
  if (!(q1 >= 1 && q2 >= 1)) {
    throw new Error('splitStackIntoTwo: firstQty must be between 1 and currentQty-1.');
  }

  // Update original to q1
  const [updated] = await actor.updateEmbeddedDocuments('Item', [
    { _id: item.id, system: { quantity: q1 } }
  ]);

  // Create a second copy with q2
  const copy = item.toObject();
  delete copy._id;
  copy.system = { ...(copy.system ?? {}), quantity: q2, readied: false };
  const [created] = await actor.createEmbeddedDocuments('Item', [copy]);

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
  const caseSensitive = opts.caseSensitive ?? true;
  // Current quantity on target; only proceed if numeric
  const qtyOf = i => Number(i?.system?.quantity);
  const isStackable = i => Number.isFinite(qtyOf(i));

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

  // Collect similar, stackable siblings (including self)
  const similars = actor.items.filter(i => {
    const sameName = caseSensitive ? i.name === nameKey : (i.name ?? '').toLowerCase() === nameKey;
    const sameType = i.type === typeKey;
    const sameSysType = (i.system?.type ?? '') === sysTypeKey;
    return sameName && sameType && sameSysType && isStackable(i);
  });

  // If nothing or only itself, nothing to do
  if (similars.length <= 1) {
    return { kept: item, deletedIds: [], totalQuantity: qtyOf(item) || 0 };
  }

  // Sum all quantities
  const totalQty = similars.reduce((acc, i) => acc + (qtyOf(i) || 0), 0);

  // Determine which to keep: the passed item
  const keepId = item.id;
  const toDelete = similars.filter(i => i.id !== keepId).map(i => i.id);

  // Batch update: set target's quantity to total
  await actor.updateEmbeddedDocuments('Item', [{ _id: keepId, system: { quantity: totalQty } }]);

  // Delete the others
  if (toDelete.length) {
    await actor.deleteEmbeddedDocuments('Item', toDelete);
  }

  // Return the up-to-date kept doc if needed by caller
  const kept = actor.items.get(keepId);
  return { kept, deletedIds: toDelete, totalQuantity: totalQty };
}

/**
 * Merge *all* items on an actor that have duplicates (same name/type/system.type).
 * Useful maintenance utility; runs mergeSimilarItems across groups.
 *
 * @param {Actor} actor
 * @param {object} [opts]
 * @param {boolean} [opts.caseSensitive=true]
 * @returns {Promise<Array<{ keptId: string, deletedIds: string[], totalQuantity: number }>>}
 */
export async function mergeAllDuplicateStacks(actor, opts = {}) {
  if (!actor) throw new Error('mergeAllDuplicateStacks: missing actor');
  const caseSensitive = opts.caseSensitive ?? true;

  // Build groups: key by (name,type,system.type)
  const keyFor = i => {
    const name = caseSensitive ? i.name : (i.name ?? '').toLowerCase();
    const t = i.type;
    const st = i.system?.type ?? '';
    return `${name}::${t}::${st}`;
  };

  const byKey = new Map();
  for (const i of actor.items) {
    const q = Number(i.system?.quantity);
    if (!Number.isFinite(q)) continue; // only stackable
    const k = keyFor(i);
    const arr = byKey.get(k) ?? [];
    arr.push(i);
    byKey.set(k, arr);
  }

  const results = [];
  for (const arr of byKey.values()) {
    if (arr.length <= 1) continue;
    // Keep the first as canonical; merge others into it
    const keep = arr[0];
    let total = 0;
    const delIds = [];
    for (const it of arr) {
      const q = Number(it.system?.quantity) || 0;
      total += q;
      if (it.id !== keep.id) delIds.push(it.id);
    }
    await actor.updateEmbeddedDocuments('Item', [{ _id: keep.id, system: { quantity: total } }]);
    if (delIds.length) await actor.deleteEmbeddedDocuments('Item', delIds);
    results.push({ keptId: keep.id, deletedIds: delIds, totalQuantity: total });
  }

  return results;
}

/**
 * Delete effects of an actor or item, only those still there. Several clients (and the aura sync,
 * rest, Use, areas…) can delete the same effect at nearly the same time: deleting one already gone
 * throws "ActiveEffect … does not exist!" and stops the whole batch. This keeps the ones still there,
 * and retries once without those deleted in the meantime.
 * @param {Actor|Item} parent
 * @param {string[]} ids
 * @param {object} [options]  Passed to deleteEmbeddedDocuments
 * @returns {Promise<ActiveEffect[]>} The effects deleted
 */
export async function deleteEffects(parent, ids, options = {}) {
  const present = () => [...new Set(ids ?? [])].filter(id => id && parent?.effects?.has(id));
  let list = present();
  if (!list.length) return [];
  try {
    return await parent.deleteEmbeddedDocuments('ActiveEffect', list, options);
  } catch (error) {
    // Some were deleted meanwhile: once more with those still there
    const still = present();
    if (still.length && still.length < list.length) {
      try {
        return await parent.deleteEmbeddedDocuments('ActiveEffect', still, options);
      } catch (retryError) {
        console.warn('SDM | Deleting effects failed', retryError);
        return [];
      }
    }
    if (still.length) console.warn('SDM | Deleting effects failed', error);
    return [];
  }
}

import { SizeUnit } from './constants.mjs';
import { syncItemPilesCurrency } from '../integrations/itemPiles.mjs';

/**
 * Money is gear whose size is in cash. When the Referee renames the currency or changes its image
 * (world settings), the money already in inventories follows: items still named / pictured like the
 * old currency take the new name / image. Money items given their own name or image (a gem pouch…)
 * are left alone. Item Piles recognises money by its name too, so it keeps finding it.
 */

let previous = null;

/** Remember the current name and image (on ready), to know what the old ones were on a change. */
export function rememberCurrency() {
  previous = { name: game.settings.get('sdm', 'currencyName'), img: game.settings.get('sdm', 'currencyImage') };
}

const isCash = item => item.type === 'gear' && item.system?.size?.unit === SizeUnit.CASH;

/** Every place money can be: world actors, unlinked tokens on scenes, and the Items sidebar. */
function moneyHolders() {
  const holders = [...game.actors];
  for (const scene of game.scenes) {
    for (const token of scene.tokens) if (!token.actorLink && token.actor) holders.push(token.actor);
  }
  return holders;
}

export async function onCurrencyChanged() {
  const name = game.settings.get('sdm', 'currencyName');
  const img = game.settings.get('sdm', 'currencyImage');
  const old = previous;
  previous = { name, img };
  if (game.users.activeGM?.id !== game.user.id) return;

  if (old && (old.name !== name || old.img !== img)) {
    const changes = item => ({
      ...(old.name !== name && item.name === old.name && { name }),
      ...(old.img !== img && item.img === old.img && { img })
    });
    let count = 0;
    for (const holder of moneyHolders()) {
      const updates = holder.items
        .filter(isCash)
        .map(item => ({ _id: item.id, ...changes(item) }))
        .filter(update => Object.keys(update).length > 1);
      if (!updates.length) continue;
      await holder.updateEmbeddedDocuments('Item', updates);
      count += updates.length;
    }
    const sidebar = game.items.filter(isCash).map(item => ({ _id: item.id, ...changes(item) }));
    const sidebarUpdates = sidebar.filter(update => Object.keys(update).length > 1);
    if (sidebarUpdates.length) await Item.updateDocuments(sidebarUpdates);
    count += sidebarUpdates.length;
    if (count) console.log(`SDM | Currency changed: ${count} money item(s) updated`);
  }
  await syncItemPilesCurrency();
}

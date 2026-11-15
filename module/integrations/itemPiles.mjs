import { $l10n } from '../helpers/globalUtils.mjs';

/**
 * Item Piles support, built in (it used to need the "Item Piles: SDM" companion module).
 * Registered when Item Piles is ready; nothing happens without it. If the old companion module is
 * still active it registers the same configuration, so the system leaves it to it and tells the
 * Referee it can be disabled.
 */
const COMPANION_ID = 'item-piles-sdm';
const CURRENCY_ID = 'Ag3Y82vRzeqEEAel';
/**
 * Item Piles saves the integration as world settings and overwrites them (Referee edits included)
 * only when this version is newer than the saved one, so bump it only when the configuration below
 * changes. The old companion module was 0.4.0.
 */
const INTEGRATION_VERSION = '1.0.0';

function itemPilesConfig() {
  const name = game.settings.get('sdm', 'currencyName');
  const img = game.settings.get('sdm', 'currencyImage');
  return {
    VERSION: INTEGRATION_VERSION,
    // Money is gear whose size is in cash: one item, its quantity is the amount
    CURRENCIES: [
      {
        id: CURRENCY_ID,
        type: 'item',
        name,
        img,
        abbreviation: '€{#}',
        data: {
          item: {
            name,
            type: 'gear',
            img,
            system: { size: { unit: 'cash', value: 1 }, quantity: 1 }
          }
        },
        primary: true,
        exchangeRate: 1,
        secondary: false
      }
    ],
    SECONDARY_CURRENCIES: [],
    CURRENCY_DECIMAL_DIGITS: 0,
    // Traits and burdens are not loot
    ITEM_FILTERS: [
      { path: 'type', filters: 'trait' },
      { path: 'type', filters: 'burden' }
    ],
    ITEM_SIMILARITIES: ['name', 'type', 'system.type', 'system.size.unit'],
    UNSTACKABLE_ITEM_TYPES: [],
    ACTOR_CLASS_TYPE: 'npc',
    ITEM_CLASS_LOOT_TYPE: 'gear',
    ITEM_CLASS_WEAPON_TYPE: 'gear',
    ITEM_CLASS_EQUIPMENT_TYPE: 'gear',
    ITEM_QUANTITY_ATTRIBUTE: 'system.quantity',
    ITEM_PRICE_ATTRIBUTE: 'system.cost',
    QUANTITY_FOR_PRICE_ATTRIBUTE: 'flags.item-piles.system.quantityForPrice',
    // Players looking at a merchant's item see its description (Limited shows only name and image)
    ITEM_PREVIEW_PERMISSION_LEVEL: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
    // Runs after Item Piles has applied its saved settings
    SYSTEM_HOOKS: () => syncItemPilesCurrency()
  };
}

/**
 * Item Piles keeps its own copy of the currency (name, image and the item it creates). Keep it equal
 * to the world's Currency name and image settings: after Item Piles loads and whenever they change.
 * Only the active Referee writes it; everything else the Referee set in Item Piles stays.
 */
export async function syncItemPilesCurrency() {
  const api = game.itempiles?.API;
  if (!api || game.users.activeGM?.id !== game.user.id) return;
  if (game.modules.get(COMPANION_ID)?.active) return;
  const name = game.settings.get('sdm', 'currencyName');
  const img = game.settings.get('sdm', 'currencyImage');
  const currencies = foundry.utils.deepClone(api.CURRENCIES ?? []);
  const currency = currencies.find(
    c => c.id === CURRENCY_ID || (c.type === 'item' && c.data?.item?.system?.size?.unit === 'cash')
  );
  if (!currency) return;
  const item = currency.data?.item ?? {};
  if (currency.name === name && currency.img === img && item.name === name && item.img === img) return;
  currency.name = name;
  currency.img = img;
  currency.data = { ...currency.data, item: { ...item, name, img } };
  try {
    await api.setCurrencies(currencies);
  } catch (error) {
    console.warn('SDM | Could not update the Item Piles currency', error);
  }
}

export function setupItemPiles() {
  Hooks.once('item-piles-ready', () => {
    if (game.modules.get(COMPANION_ID)?.active) {
      if (game.user.isGM) ui.notifications.info($l10n('SDM.ItemPiles.CompanionNotNeeded'), { permanent: true });
      return;
    }
    game.itempiles?.API?.addSystemIntegration(itemPilesConfig(), 'latest');
  });
}

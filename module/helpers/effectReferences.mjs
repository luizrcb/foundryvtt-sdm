import { ItemType } from './constants.mjs';

/**
 * References in active effect change values, for item effects and actor effects alike:
 * - @actor.<path>   the actor (path from the document or from its system: `level` or `system.level`)
 * - @item.<path>    the effect's own item (`skill.rank` or `system.skill.rank`)
 * - @items.[<type>:]<key>.<path>  the actor's items: <key> is an item ID (that exact item) or an
 *   item identifier (the highest value among the items with it, 0 when there is none); the
 *   optional <type> (gear, trait, burden, mount, vehicle) limits it to that item type.
 * All the actor's items count (readied or not, in containers, broken or run out).
 * An item identifier is the slug of its original (untranslated) name, see getItemIdentifier.
 */

const KEY = "((?:[a-z]+:)?[\\w-]+)";
const PATH = "([\\w.\\[\\]'\"]+)";
const SINGLE = new RegExp(`^\\s*@(actor|item)\\.${PATH}\\s*$|^\\s*@items\\.${KEY}\\.${PATH}\\s*$`);
const ANY = new RegExp(`@items\\.${KEY}\\.${PATH}|@(actor|item)\\.${PATH}`, 'g');
const ITEM_TYPES = Object.values(ItemType);
const ID_PATTERN = /^[a-zA-Z0-9]{16}$/;
const warned = new Set();

/** "1 - Damage Boost" → "damage-boost", "Esquiva Ágil" → "esquiva-agil". */
export function slugifyName(name) {
  return String(name ?? '')
    .replace(/^\s*\d+\s*[-.):]\s*/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The item's identifier: the slug of its original name (Babele translation) or of its name. */
export function getItemIdentifier(item) {
  return slugifyName(item?.flags?.babele?.originalName || item?.name);
}

/** A path on a document, also accepted without the leading "system." */
function getPath(doc, path) {
  if (!doc) return undefined;
  const clean = path.replace(/\.{2,}/g, '.').replace(/^\.|\.$/g, '');
  const value = foundry.utils.getProperty(doc, clean);
  if (value !== undefined || clean.startsWith('system.')) return value;
  return foundry.utils.getProperty(doc.system ?? {}, clean);
}

/** @items.[<type>:]<key>.<path>: an exact item by ID, or the highest value among items with that identifier. */
function getItemsValue(actor, typedKey, path) {
  if (!actor?.items) return undefined;
  const [type, key] = typedKey.includes(':') ? typedKey.split(':') : [null, typedKey];
  if (type && !ITEM_TYPES.includes(type)) return undefined;
  const ofType = item => !type || item.type === type;
  if (ID_PATTERN.test(key) && actor.items.has(key)) {
    const item = actor.items.get(key);
    return ofType(item) ? getPath(item, path) : 0;
  }
  const values = actor.items
    .filter(item => ofType(item) && getItemIdentifier(item) === key)
    .map(item => getPath(item, path))
    .filter(value => value !== undefined && value !== null && value !== '');
  if (!values.length) return 0;
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length === values.length ? Math.max(...numbers) : values[0];
}

function resolveOne({ actor, item }, scope, path, itemsKey) {
  if (itemsKey !== undefined) return getItemsValue(actor, itemsKey, path);
  return getPath(scope === 'actor' ? actor : item, path);
}

/**
 * Replace the references in a change value.
 * @param {string} value
 * @param {object} context  { actor, item, effect }
 * @returns {*} The value with its references replaced (a single reference keeps its type).
 */
export function resolveEffectReferences(value, context) {
  if (typeof value !== 'string' || !value.includes('@')) return value;
  const single = value.match(SINGLE);
  if (single) {
    const resolved = single[3] !== undefined
      ? resolveOne(context, null, single[4], single[3])
      : resolveOne(context, single[1], single[2]);
    if (resolved !== undefined) return resolved;
    warnUnresolved(context, value.trim());
    return value;
  }
  return value.replace(ANY, (full, itemsKey, itemsPath, scope, path) => {
    const resolved = itemsKey !== undefined
      ? resolveOne(context, null, itemsPath, itemsKey)
      : resolveOne(context, scope, path);
    if (resolved === undefined || resolved === null || typeof resolved === 'object') {
      warnUnresolved(context, full);
      return full;
    }
    return String(resolved);
  });
}

/**
 * Replace the references in a formula (trigger, boost and consumable amounts) with their numbers, so
 * they work in dice expressions: "(@item.counters.hits.value)d6", "1d@actor.level", "1d6 + @actor.level". A reference that does not resolve to a number counts as 0 (with a warning).
 * @param {string} formula
 * @param {object} context  { actor, item }
 */
export function resolveFormulaReferences(formula, context) {
  const text = `${formula ?? ''}`;
  if (!text.includes('@')) return text;
  return text.replace(ANY, (full, itemsKey, itemsPath, scope, path) => {
    const resolved =
      itemsKey !== undefined ? resolveOne(context, null, itemsPath, itemsKey) : resolveOne(context, scope, path);
    const number = Number(resolved);
    if (resolved === undefined || resolved === null || resolved === '' || typeof resolved === 'object' || !Number.isFinite(number)) {
      warnUnresolved(context, full);
      return '0';
    }
    // Negative numbers in parentheses so "1d6 - @x" stays valid
    return number < 0 ? `(${number})` : String(number);
  });
}

/** Explain once per effect and reference which reference failed and how to write it. */
function warnUnresolved({ effect, item, actor }, reference) {
  const key = `${effect?.uuid ?? item?.uuid}|${reference}`;
  if (warned.has(key)) return;
  warned.add(key);
  let hint = ' Check the path (e.g. @item.system.skill.rank or @items.trait:dodge.skill.rank).';
  if (reference.startsWith('@item.') && !item) hint = ' The effect is not on an item: use @items.<type>:<identifier>.<path>.';
  else if (reference.startsWith('@items.') && !actor) {
    hint = ' The item has no actor yet: @items resolves once it is on an actor.';
  } else if (/^@items\.[a-z]+:/.test(reference) && !ITEM_TYPES.includes(reference.slice(7).split(':')[0])) {
    hint = ` Unknown item type: use one of ${ITEM_TYPES.join(', ')}.`;
  }
  const source = effect ? `Active Effect (${effect.uuid})` : `Item (${item?.uuid ?? '?'})`;
  console.warn(`SDM | ${source} could not resolve "${reference}".${hint}`);
  if (!effect) ui.notifications?.warn(`${item?.name ?? 'SDM'}: "${reference}" is not a number (counted as 0).`);
}

/** The reference other effects use for this item, and an example with one of its fields. */
export function getItemReference(item) {
  const identifier = getItemIdentifier(item);
  if (!identifier) return null;
  const reference = `@items.${item.type}:${identifier}`;
  const subtype = item.system?.type;
  const candidates = [
    subtype === 'armor' && 'armor.value',
    subtype === 'ward' && 'ward.value',
    subtype === 'weapon' && 'weapon.damage.base',
    subtype === 'skill' && 'skill.rank',
    'cost',
    'level'
  ].filter(Boolean);
  const field = candidates.find(path => getPath(item, path) !== undefined) ?? candidates[0];
  return { reference, example: `${reference}.${field}`, selfExample: `@item.${field}` };
}

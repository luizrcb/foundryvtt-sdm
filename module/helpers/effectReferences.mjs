/**
 * References in active effect change values, for item effects and actor effects alike:
 * - @actor.<path>   the actor (path from the document or from its system: `level` or `system.level`)
 * - @item.<path>    the effect's item (`skill.rank` or `system.skill.rank`)
 * - @items.<key>.<path>  the actor's items: <key> is an item ID (that exact item) or an item
 *   identifier (the highest value among the items with it, 0 when there is none)
 * An item identifier is the slug of its original (untranslated) name, see getItemIdentifier.
 */

const SINGLE = /^\s*@(actor|item)\.([\w.\[\]'"]+)\s*$|^\s*@items\.([\w-]+)\.([\w.\[\]'"]+)\s*$/;
const ANY = /@items\.([\w-]+)\.([\w.\[\]'"]+)|@(actor|item)\.([\w.\[\]'"]+)/g;
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

/** @items.<key>.<path>: an exact item by ID, or the highest value among items with that identifier. */
function getItemsValue(actor, key, path) {
  if (!actor?.items) return undefined;
  if (ID_PATTERN.test(key) && actor.items.has(key)) return getPath(actor.items.get(key), path);
  const values = actor.items
    .filter(item => getItemIdentifier(item) === key)
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

/** Explain once per effect and reference which reference failed and how to write it. */
function warnUnresolved({ effect, item }, reference) {
  const key = `${effect?.uuid}|${reference}`;
  if (warned.has(key)) return;
  warned.add(key);
  let hint = '';
  if (reference.startsWith('@item.') && !item) hint = ' The effect is not on an item: use @items.<identifier>.<path>.';
  else hint = ' Check the path (e.g. @item.system.skill.rank or @items.dodge.skill.rank).';
  console.warn(`SDM | Active Effect (${effect?.uuid ?? '?'}) could not resolve "${reference}".${hint}`);
}

/**
 * NPC extras: the NPC generator can add a few rolled extras to a new NPC: special attacks (natural
 * weapons with roll triggers), oddities (traits, some with light or effects) and powers. They are
 * drawn from three roll tables (NPC Extras Tables compendium by default; the Referee can point the
 * world settings at their own tables). Powers above the NPC's reach (level higher than half its
 * level, at least 1) are drawn again.
 */

export const EXTRA_KINDS = ['attack', 'oddity', 'power'];
export const DEFAULT_EXTRA_TABLES = {
  attack: 'Compendium.sdm.npc_extras_tables.RollTable.5tECVbEsoZd84EFK',
  oddity: 'Compendium.sdm.npc_extras_tables.RollTable.lR2R1gKLCFguH9lX',
  power: 'Compendium.sdm.npc_extras_tables.RollTable.eMQTVlxjB8nCMyFl'
};
const SETTING = { attack: 'npcExtraAttacksTable', oddity: 'npcExtraOdditiesTable', power: 'npcExtraPowersTable' };

/** How many extras "by level" gives: levels 0–2 a coin flip for one, 3–6 one, 7+ two. */
export function extrasForLevel(level) {
  if (level >= 7) return 2;
  if (level >= 3) return 1;
  return CONFIG.Dice.randomUniform() < 0.5 ? 1 : 0;
}

async function getTable(kind) {
  const uuid = game.settings.get('sdm', SETTING[kind])?.trim() || DEFAULT_EXTRA_TABLES[kind];
  const table = await fromUuid(uuid).catch(() => null);
  return table?.documentName === 'RollTable' ? table : null;
}

/** One item drawn from a table (document results only); powers within the NPC's reach. */
async function drawItem(kind, level, taken) {
  const table = await getTable(kind);
  if (!table) return null;
  const maxPower = Math.max(1, Math.floor(level / 2));
  for (let tries = 0; tries < 8; tries++) {
    const { results } = await table.draw({ displayChat: false });
    const result = results?.[0];
    const uuid = result?.documentUuid;
    if (!uuid) continue;
    const item = await fromUuid(uuid).catch(() => null);
    if (item?.documentName !== 'Item' || taken.has(item.name)) continue;
    if (kind === 'power' && (Number(item.system?.power?.level) || 1) > maxPower) continue;
    const data = item.toObject();
    delete data._id;
    data._stats = { ...(data._stats ?? {}), compendiumSource: item.uuid };
    if (data.type === 'gear') foundry.utils.setProperty(data, 'system.readied', true);
    foundry.utils.setProperty(data, 'flags.sdm.npcExtra', kind);
    taken.add(item.name);
    return data;
  }
  return null;
}

/**
 * Add extras to an NPC. count: a number, or 'level' (by level). Kinds are picked at random
 * (attacks and oddities twice as often as powers). Returns the names added.
 */
export async function addNpcExtras(actor, { count = 'level' } = {}) {
  if (!actor) return [];
  const level = Number(actor.system?.level) || 0;
  const total = count === 'level' ? extrasForLevel(level) : Math.max(0, Number(count) || 0);
  const taken = new Set(actor.items.map(item => item.name));
  const created = [];
  for (let i = 0; i < total; i++) {
    const roll = CONFIG.Dice.randomUniform();
    const kind = roll < 0.4 ? 'attack' : roll < 0.8 ? 'oddity' : 'power';
    const data = (await drawItem(kind, level, taken)) ?? (await drawItem(kind === 'power' ? 'attack' : 'oddity', level, taken));
    if (data) created.push(data);
  }
  if (created.length) await actor.createEmbeddedDocuments('Item', created);
  return created.map(data => data.name);
}

export function registerNpcExtraSettings() {
  for (const kind of EXTRA_KINDS) {
    const key = SETTING[kind];
    const label = `SDM.Settings${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    game.settings.register('sdm', key, {
      name: label,
      hint: 'SDM.SettingsNpcExtraTableHint',
      scope: 'world',
      restricted: true,
      type: String,
      default: DEFAULT_EXTRA_TABLES[kind]
    });
  }
}

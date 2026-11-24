import TokenPlacement from '../canvas/token-placement.mjs';
import { ActorType } from './constants.mjs';
import { rollAmount } from './formulas.mjs';
import { $fmt, $l10n } from './globalUtils.mjs';

/**
 * Summoning: the Summon trigger action (on a roll, a power's cast, a consumable's Use) brings creatures
 * onto the scene next to whoever used the item. The creature is an NPC, or a roll table whose results
 * are NPCs (one draw per creature). The Referee's game makes them: each NPC is copied once (per level)
 * into the "Summons" folder, and its tokens are unlinked, on the summoner's side and owned by the
 * summoner's players. In a running fight they join the combat and roll initiative; with rounds they
 * leave when those rounds are over (or when the fight ends); else they stay until dismissed.
 */

const SUMMON_QUERY = 'sdm.summon';
const DISMISS_QUERY = 'sdm.dismissSummons';
const FLAG = 'summon';
const SOURCE_FLAG = 'summonSource';
const CARD_FLAG = 'summonCard';
const HUD_CLASS = 'sdm-dismiss-summon';
// The effect a summoned creature carries (its token icon, Effects tab and effects panel)
const EFFECT_FLAG = 'summoned';
const EFFECT_ICON = 'icons/svg/portal.svg';
// Rings of squares searched around the summoner for free places
const MAX_RINGS = 12;

const esc = text => foundry.utils.escapeHTML(String(text ?? ''));

/** The summon data of a token (null when it was not summoned). */
export function summonOf(token) {
  return token?.getFlag?.('sdm', FLAG) ?? null;
}

/** "Summoned by Bob (Raise Dead)" for a summoned token's actor (its sheet, effects panel); '' otherwise. */
export function summonedLabel(actor, { short = false } = {}) {
  const data = summonOf(actor?.token);
  if (!data) return '';
  return $fmt(short ? 'SDM.Summon.ByShort' : 'SDM.Summon.By', { actor: data.summonerName || '?', item: data.itemName || '?' });
}

/** The marker effect of a summoned creature. */
export function isSummonedEffect(effect) {
  return !!effect?.getFlag?.('sdm', EFFECT_FLAG);
}

/** Summoned tokens of a scene, optionally only those of an item and summoner. */
function sceneSummons(scene, { item = null, summoner = null } = {}) {
  return (scene?.tokens ?? []).filter(token => {
    const data = summonOf(token);
    if (!data) return false;
    if (item && data.item !== item) return false;
    if (summoner && data.summoner !== summoner) return false;
    return true;
  });
}

/* -------------------------------------------- */
/*  Summoning (the user's game)                 */
/* -------------------------------------------- */

/** The Summon trigger action: creatures by `holder` (the item), for `actor`. */
export async function summonAction(holder, actor, trigger) {
  const scene = canvas?.scene;
  if (!scene) return ui.notifications.warn($l10n('SDM.Summon.NoScene'));
  if (!game.users.activeGM) return ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
  const summonerToken = actor?.getActiveTokens?.(false, true).find(token => token.parent === scene) ?? null;
  if (!summonerToken) return ui.notifications.warn($fmt('SDM.Summon.NoToken', { actor: actor?.name ?? '' }));
  const source = trigger.summon ? await fromUuid(trigger.summon) : null;
  if (!['Actor', 'RollTable'].includes(source?.documentName)) {
    return ui.notifications.warn($fmt('SDM.Summon.Missing', { item: holder.name }));
  }

  let count = Math.max((await rollAmount(trigger.summon_count, { item: holder, actor, fallback: 1 })).total, 0);
  // Up to a number at once (of this item and summoner, on this scene)
  if (`${trigger.summon_limit ?? ''}`.trim()) {
    const max = Math.max((await rollAmount(trigger.summon_limit, { item: holder, actor })).total, 0);
    const room = Math.max(max - sceneSummons(scene, { item: holder.uuid, summoner: actor.uuid }).length, 0);
    if (count > room) {
      ui.notifications.warn($fmt('SDM.Summon.Limit', { item: holder.name, max }));
      count = room;
    }
  }
  if (!count) return;

  const creatures = [];
  for (let i = 0; i < count; i++) {
    const creature = source.documentName === 'RollTable' ? await drawCreature(source) : source;
    if (creature?.documentName === 'Actor') creatures.push(creature);
  }
  if (!creatures.length) return ui.notifications.warn($fmt('SDM.Summon.Missing', { item: holder.name }));

  const levelFormula = `${trigger.summon_level ?? ''}`.trim();
  const level = levelFormula ? Math.max((await rollAmount(levelFormula, { item: holder, actor })).total, 0) : null;

  const placed = trigger.summon_place === 'manual' ? await placeByHand(creatures) : placeNearby(summonerToken, creatures);
  if (!placed.length) return ui.notifications.info($fmt('SDM.Summon.NoPlace', { item: holder.name }));
  if (placed.length < creatures.length) ui.notifications.warn($fmt('SDM.Summon.SomeLeft', { count: creatures.length - placed.length }));

  const request = {
    sceneId: scene.id,
    summonerUuid: actor.uuid,
    summonerTokenId: summonerToken.id,
    itemUuid: holder.uuid,
    itemName: holder.name,
    creatures: placed,
    level,
    rounds: Math.max(Number(trigger.summon_rounds) || 0, 0),
    endsAtZero: !!trigger.summon_ends_at_zero,
    userId: game.user.id
  };
  let result = null;
  try {
    result = game.user.isGM ? await createSummons(request) : await game.users.activeGM.query(SUMMON_QUERY, request, { timeout: 60000 });
  } catch (error) {
    console.error('SDM | Summoning failed', error);
  }
  if (!result?.tokens?.length) return ui.notifications.warn($fmt('SDM.Summon.Failed', { item: holder.name }));
  await summonCard(actor, holder, result);
}

/** One creature from a roll table: the NPC of a drawn result (none: null). */
async function drawCreature(table) {
  try {
    const { results } = await table.roll();
    for (const result of results ?? []) {
      const uuid = result.documentUuid;
      const document = uuid ? await fromUuid(uuid) : null;
      if (document?.documentName === 'Actor') return document;
    }
  } catch (error) {
    console.error('SDM | Summon table draw failed', error);
  }
  return null;
}

/** Placed by hand, one by one (right-click or Esc skips one). */
async function placeByHand(creatures) {
  let placements = [];
  try {
    placements = await TokenPlacement.place({ tokens: creatures.map(creature => creature.prototypeToken) });
  } catch (error) {
    console.error('SDM | Placing summoned creatures failed', error);
  }
  return placements.map(({ prototypeToken, x, y, elevation, rotation }) => ({
    uuid: prototypeToken.parent.uuid,
    x,
    y,
    elevation: elevation ?? 0,
    rotation: rotation ?? 0
  }));
}

/** Square spiral offsets of one ring around the center. */
function ringOffsets(ring) {
  const offsets = [];
  for (let x = -ring; x <= ring; x++) offsets.push([x, -ring]);
  for (let y = -ring + 1; y <= ring; y++) offsets.push([ring, y]);
  for (let x = ring - 1; x >= -ring; x--) offsets.push([x, ring]);
  for (let y = ring - 1; y >= -ring + 1; y--) offsets.push([-ring, y]);
  return offsets;
}

function overlaps(a, b) {
  return a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;
}

/** A wall blocks the way from the summoner to the square. */
function wallBetween(origin, destination) {
  try {
    return !!CONFIG.Canvas.polygonBackends.move.testCollision(origin, destination, { type: 'move', mode: 'any' });
  } catch {
    return false;
  }
}

/** The nearest free squares around the summoner, in a square spiral (no walls between, no tokens). */
function placeNearby(summonerToken, creatures) {
  const grid = canvas.grid;
  const sizeX = grid.sizeX ?? grid.size;
  const sizeY = grid.sizeY ?? grid.size;
  const origin = summonerToken.object?.center ?? {
    x: summonerToken.x + (summonerToken.width * sizeX) / 2,
    y: summonerToken.y + (summonerToken.height * sizeY) / 2
  };
  const sceneRect = canvas.dimensions.sceneRect;
  const taken = canvas.tokens.placeables.map(token => token.bounds);
  const placed = [];
  for (const creature of creatures) {
    const token = creature.prototypeToken;
    const width = (token.width || 1) * sizeX;
    const height = (token.height || 1) * sizeY;
    let spot = null;
    for (let ring = 1; ring <= MAX_RINGS && !spot; ring++) {
      for (const [dx, dy] of ringOffsets(ring)) {
        const center = { x: origin.x + dx * sizeX, y: origin.y + dy * sizeY };
        let corner = { x: center.x - width / 2, y: center.y - height / 2 };
        if (!grid.isGridless) corner = grid.getSnappedPoint(corner, { mode: CONST.GRID_SNAPPING_MODES.TOP_LEFT_CORNER });
        const box = { x: corner.x, y: corner.y, width, height };
        if (box.x < sceneRect.x || box.y < sceneRect.y || box.x + width > sceneRect.right || box.y + height > sceneRect.bottom) continue;
        if (taken.some(other => overlaps(other, box))) continue;
        if (wallBetween(origin, { x: box.x + width / 2, y: box.y + height / 2 })) continue;
        spot = box;
        break;
      }
    }
    if (!spot) break;
    taken.push(spot);
    placed.push({ uuid: creature.uuid, x: spot.x, y: spot.y, elevation: summonerToken.elevation ?? 0, rotation: 0 });
  }
  return placed;
}

/** The chat card: who came, how long, and Target / Dismiss all. */
async function summonCard(actor, holder, result) {
  const names = result.names.map(esc).join(', ');
  const lasts = result.rounds
    ? $fmt(result.until ? 'SDM.Summon.LastsRounds' : 'SDM.Summon.LastsRoundsNoCombat', { rounds: result.rounds })
    : $l10n('SDM.Summon.LastsUntilDismissed');
  const content =
    `<div class="sdm-summon-card">` +
    `<p><i class="fa-solid fa-hand-sparkles"></i> ${$fmt('SDM.Summon.Chat', { actor: esc(actor.name), item: esc(holder.name), names })}</p>` +
    `<p class="sdm-summon-lasts">${esc(lasts)}${result.endsAtZero ? ` ${esc($l10n('SDM.Summon.EndsAtZeroNote'))}` : ''}</p>` +
    `<div class="sdm-summon-buttons">` +
    `<button type="button" data-action="sdmSummonTarget"><i class="fa-solid fa-crosshairs" inert></i> ${esc($l10n('SDM.Summon.Target'))}</button>` +
    `<button type="button" data-action="sdmSummonDismiss"><i class="fa-solid fa-person-walking-arrow-right" inert></i> ${esc($l10n('SDM.Summon.DismissAll'))}</button>` +
    `</div></div>`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flags: { sdm: { [CARD_FLAG]: { tokens: result.tokens } } }
  });
}

/* -------------------------------------------- */
/*  Making them (the Referee's game)            */
/* -------------------------------------------- */

async function summonsFolder() {
  const name = $l10n('SDM.Summon.Folder');
  return game.folders.find(f => f.type === 'Actor' && f.name === name) ?? Folder.create({ name, type: 'Actor' });
}

/** The world copy of a creature at a level (made once, in the Summons folder). */
async function summonActor(uuid, level) {
  const source = await fromUuid(uuid);
  if (source?.documentName !== 'Actor') return null;
  // A copy already in the Summons folder is used as it is
  if (!source.pack && source.getFlag('sdm', SOURCE_FLAG) && level === null) return source;
  const key = `${uuid}|${level ?? ''}`;
  const existing = game.actors.find(actor => actor.getFlag('sdm', SOURCE_FLAG) === key);
  if (existing) return existing;
  const folder = await summonsFolder();
  const data = source.pack ? game.actors.fromCompendium(source) : source.toObject();
  delete data._id;
  data.folder = folder?.id ?? null;
  foundry.utils.setProperty(data, `flags.sdm.${SOURCE_FLAG}`, key);
  foundry.utils.setProperty(data, 'prototypeToken.actorLink', false);
  const actor = await Actor.implementation.create(data);
  if (actor && level !== null && actor.type === ActorType.NPC && level !== actor.system.level) await actor.levelUpNpcTo(level);
  return actor;
}

/** Players who own the summoner own the creature too. */
async function shareOwnership(actor, summoner) {
  const update = {};
  for (const user of game.users) {
    if (user.isGM || !summoner?.testUserPermission(user, 'OWNER')) continue;
    if (!actor.testUserPermission(user, 'OWNER')) update[`ownership.${user.id}`] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  }
  if (Object.keys(update).length) await actor.update(update);
}

async function createSummons({ sceneId, summonerUuid, summonerTokenId, itemUuid, itemName, creatures = [], level = null, rounds = 0, endsAtZero = false, userId }) {
  const scene = game.scenes.get(sceneId);
  const user = game.users.get(userId);
  const summoner = summonerUuid ? await fromUuid(summonerUuid) : null;
  if (!scene || !user || !summoner) return null;
  // Only someone who owns the summoner summons for it
  if (!user.isGM && !summoner.testUserPermission(user, 'OWNER')) return null;
  const summonerToken = scene.tokens.get(summonerTokenId);
  const disposition = summonerToken?.disposition ?? summoner.prototypeToken?.disposition ?? CONST.TOKEN_DISPOSITIONS.NEUTRAL;
  const combat = game.combats.find(c => c.started && c.scene?.id === scene.id && c.combatants.some(cb => cb.tokenId === summonerTokenId)) ?? null;
  const until = rounds > 0 && combat ? { combat: combat.id, round: combat.round + rounds } : null;
  const id = foundry.utils.randomID();

  const actors = new Map();
  const tokensData = [];
  for (const { uuid, x, y, elevation = 0, rotation = 0 } of creatures) {
    if (!actors.has(uuid)) {
      const actor = await summonActor(uuid, level);
      if (actor) await shareOwnership(actor, summoner);
      actors.set(uuid, actor);
    }
    const actor = actors.get(uuid);
    if (!actor) continue;
    const document = await actor.getTokenDocument(
      {
        x,
        y,
        elevation,
        rotation,
        actorLink: false,
        disposition,
        flags: { sdm: { [FLAG]: { id, item: itemUuid, itemName, summoner: summonerUuid, summonerName: summoner.name, until, endsAtZero: !!endsAtZero } } }
      },
      { parent: scene }
    );
    tokensData.push(document.toObject());
  }
  if (!tokensData.length) return null;
  const created = await scene.createEmbeddedDocuments('Token', tokensData);

  // Marked as summoned: an effect with its own icon on the token, in the Effects tab and the effects panel
  const lasts = until ? $fmt('SDM.Summon.LastsRounds', { rounds }) : $l10n('SDM.Summon.LastsUntilDismissed');
  for (const token of created) {
    try {
      await token.actor?.createEmbeddedDocuments('ActiveEffect', [
        {
          name: $l10n('SDM.Summon.EffectName'),
          img: EFFECT_ICON,
          showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON?.ALWAYS ?? 2,
          // How long first (the effects panel shows the first line), then who
          description: `<p>${esc(lasts)}</p><p>${$fmt('SDM.Summon.By', { actor: esc(summoner.name), item: esc(itemName) })}</p>`,
          flags: { sdm: { [EFFECT_FLAG]: true } }
        }
      ]);
    } catch (error) {
      console.error('SDM | Could not mark a summoned creature', error);
    }
  }

  // A running fight: they join it and roll initiative
  if (combat && created.length) {
    try {
      const combatants = await combat.createEmbeddedDocuments(
        'Combatant',
        created.map(token => ({ tokenId: token.id, sceneId: scene.id, actorId: token.actorId, hidden: token.hidden }))
      );
      await combat.rollInitiative(combatants.map(combatant => combatant.id));
    } catch (error) {
      console.error('SDM | Summoned creatures could not join the combat', error);
    }
  }
  return { id, tokens: created.map(token => token.uuid), names: created.map(token => token.name), rounds, until, endsAtZero: !!endsAtZero };
}

/* -------------------------------------------- */
/*  Dismissing                                  */
/* -------------------------------------------- */

/** Send summoned creatures away (their tokens are removed). The Referee's game does it. */
export async function dismissSummons(tokenUuids = []) {
  const uuids = tokenUuids.filter(Boolean);
  if (!uuids.length) return;
  if (game.user.isGM) return removeSummons({ tokenUuids: uuids, userId: game.user.id });
  const gm = game.users.activeGM;
  if (!gm) return ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
  try {
    await gm.query(DISMISS_QUERY, { tokenUuids: uuids, userId: game.user.id }, { timeout: 30000 });
  } catch (error) {
    console.error('SDM | Dismissing summoned creatures failed', error);
  }
}

function canDismiss(user, token) {
  if (user.isGM || token.testUserPermission(user, 'OWNER')) return true;
  const summoner = fromUuidSync(summonOf(token)?.summoner ?? '');
  return !!summoner?.testUserPermission?.(user, 'OWNER');
}

async function removeSummons({ tokenUuids = [], userId }, { silent = false } = {}) {
  const user = game.users.get(userId) ?? game.user;
  const tokens = tokenUuids
    .map(uuid => fromUuidSync(uuid))
    .filter(token => token?.documentName === 'Token' && summonOf(token) && canDismiss(user, token));
  if (!tokens.length) return false;
  const byScene = new Map();
  for (const token of tokens) {
    if (!byScene.has(token.parent)) byScene.set(token.parent, []);
    byScene.get(token.parent).push(token);
  }
  for (const [scene, sceneTokens] of byScene) {
    const ids = sceneTokens.map(token => token.id);
    // Out of any fight first
    for (const combat of game.combats) {
      const combatants = combat.combatants.filter(c => c.sceneId === scene.id && ids.includes(c.tokenId)).map(c => c.id);
      if (combatants.length) await combat.deleteEmbeddedDocuments('Combatant', combatants);
    }
    await scene.deleteEmbeddedDocuments('Token', ids);
  }
  if (!silent) {
    await ChatMessage.create({
      content: `<p><i class="fa-solid fa-person-walking-arrow-right"></i> ${$fmt('SDM.Summon.Gone', { names: tokens.map(token => esc(token.name)).join(', ') })}</p>`
    });
  }
  return true;
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

const isActiveGM = () => game.user.isGM && game.users.activeGM?.isSelf;

function summonsWhere(test) {
  return game.scenes.contents.flatMap(scene => sceneSummons(scene).filter(token => test(summonOf(token), token)));
}

/** Rounds over: they leave at the start of the round after their last one. */
async function onUpdateCombat(combat, changes) {
  if (!isActiveGM() || !('round' in changes)) return;
  const over = summonsWhere(data => data.until?.combat === combat.id && combat.round >= data.until.round);
  if (over.length) await removeSummons({ tokenUuids: over.map(token => token.uuid), userId: game.user.id });
}

/** The fight is over: summons that lasted rounds of it leave. */
async function onDeleteCombat(combat) {
  if (!isActiveGM()) return;
  const over = summonsWhere(data => data.until?.combat === combat.id);
  if (over.length) await removeSummons({ tokenUuids: over.map(token => token.uuid), userId: game.user.id });
}

/** The summoner drops to 0 life: summons that end then leave. */
async function onUpdateActor(actor, changes) {
  if (!isActiveGM()) return;
  if (foundry.utils.getProperty(changes, 'system.life.value') === undefined) return;
  if ((Number(actor.system?.life?.value) || 0) > 0) return;
  const over = summonsWhere(data => data.endsAtZero && data.summoner === actor.uuid);
  if (over.length) await removeSummons({ tokenUuids: over.map(token => token.uuid), userId: game.user.id });
}

/** Token HUD: Dismiss, for the Referee and those who own the creature or its summoner. */
function onRenderTokenHUD(hud, html) {
  const token = hud?.document ?? hud?.object?.document;
  if (!summonOf(token) || !canDismiss(game.user, token)) return;
  const root = html?.querySelectorAll ? html : html?.[0];
  if (!root || root.querySelector(`.${HUD_CLASS}`)) return;
  const label = $l10n('SDM.Summon.Dismiss');
  const button = document.createElement('button');
  button.type = 'button';
  button.classList.add('control-icon', HUD_CLASS);
  button.dataset.tooltip = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = '<i class="fa-solid fa-person-walking-arrow-right" inert></i>';
  button.addEventListener('click', async event => {
    event.preventDefault();
    event.stopPropagation();
    await dismissSummons([token.uuid]);
  });
  (root.querySelector('.col.right') ?? root).append(button);
}

/** The summon card: Target the creatures still there, or Dismiss all of them. */
function onRenderChatMessage(message, html) {
  const data = message.getFlag?.('sdm', CARD_FLAG);
  if (!data) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const buttons = root?.querySelector('.sdm-summon-buttons');
  if (!buttons) return;
  const present = () => (data.tokens ?? []).map(uuid => fromUuidSync(uuid)).filter(token => token?.documentName === 'Token');
  if (!present().length || !(game.user.isGM || message.isOwner)) {
    buttons.remove();
    return;
  }
  buttons.querySelector('[data-action="sdmSummonTarget"]')?.addEventListener('click', event => {
    event.preventDefault();
    const ids = present().filter(token => token.parent === canvas.scene).map(token => token.id);
    if (!ids.length) return;
    if (canvas.tokens.setTargets) canvas.tokens.setTargets(ids, { mode: 'replace' });
    else {
      for (const target of [...game.user.targets]) target.setTarget(false, { releaseOthers: false });
      for (const id of ids) canvas.tokens.get(id)?.setTarget(true, { releaseOthers: false });
    }
  });
  buttons.querySelector('[data-action="sdmSummonDismiss"]')?.addEventListener('click', async event => {
    event.preventDefault();
    await dismissSummons(present().map(token => token.uuid));
  });
}

export function setupSummons() {
  CONFIG.queries[SUMMON_QUERY] = createSummons;
  CONFIG.queries[DISMISS_QUERY] = data => removeSummons(data);
  Hooks.on('updateCombat', onUpdateCombat);
  Hooks.on('deleteCombat', onDeleteCombat);
  Hooks.on('updateActor', onUpdateActor);
  Hooks.on('renderTokenHUD', onRenderTokenHUD);
  Hooks.on('renderChatMessageHTML', onRenderChatMessage);
}

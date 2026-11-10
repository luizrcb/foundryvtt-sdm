import TokenPlacement from '../canvas/token-placement.mjs';
import { getNPCDataByLevel, getNpcTableChoices, NPC_CUSTOM_TABLE, NPC_TABLE_KEYS } from './actorUtils.mjs';
import { ActorType, ItemStatusType } from './constants.mjs';
import { $fmt, $l10n } from './globalUtils.mjs';

/**
 * Animated items: an item with the "animated" feature can come to life as an NPC.
 * The NPC is created once (kept in the "Animated Items" folder) and reused; while the item
 * is animated the NPC is the source of truth, and its state goes back to the item when it
 * is deanimated. The NPC level always follows the item (the higher of the hallmark level and
 * the level set by the Referee); it never levels up on its own.
 */

export const ANIMATED_FEATURE = 'animated';
const FLAG = 'animatedItem';
const HUD_BUTTON_CLASS = 'sdm-deanimate-item';

/** Options marking updates made by this module (they must not trigger another sync). */
export const SYNC_OPTION = 'sdmAnimationSync';

export function isAnimatable(item) {
  const features = item?.system?.features;
  return typeof features?.has === 'function' && features.has(ANIMATED_FEATURE);
}

/** The item an NPC animates, if any. */
export function getAnimatedSourceItem(actor) {
  const uuid = actor?.getFlag?.('sdm', FLAG);
  return uuid ? fromUuidSync(uuid) : null;
}

export function isAnimatedNpc(actor) {
  return !!actor?.getFlag?.('sdm', FLAG);
}

/** Level of the creature: the hallmark level for hallmarks, otherwise the Referee's level. */
export function getAnimationLevel(item) {
  if (item.system.is_hallmark) return Number(item.system.hallmark?.level) || 0;
  return Number(item.system.attributes?.level) || 0;
}

/** Known table, "custom" (no table: levels only change the level number), or the generic one. */
export function normalizeNpcTable(table) {
  if (table === NPC_CUSTOM_TABLE) return NPC_CUSTOM_TABLE;
  return NPC_TABLE_KEYS().includes(table) ? table : 'generic-synthesized-creature';
}

export function getAnimationTable(item) {
  return normalizeNpcTable(item.system.animation?.table);
}

export function getAnimationTableChoices() {
  return getNpcTableChoices();
}

/** A broken or run-out item cannot come to life until it is repaired or recharged. */
export function isAnimationBlocked(item) {
  return item.system.status === ItemStatusType.BROKEN || item.system.resources === 'run_out';
}

export function getLinkedNpc(item) {
  const uuid = item.system.animation?.actor;
  const actor = uuid ? fromUuidSync(uuid) : null;
  return actor?.documentName === 'Actor' ? actor : null;
}

/* -------------------------------------------- */
/*  Attributes                                  */
/* -------------------------------------------- */

/** Fill the item's creature attributes from its table at its level. */
export async function fillAttributesFromTable(item, { raiseOnly = false } = {}) {
  if (getAnimationTable(item) === NPC_CUSTOM_TABLE) return;
  const level = getAnimationLevel(item);
  const entry = getNPCDataByLevel(getAnimationTable(item), level);
  if (!entry) return;
  const current = item.system.attributes;
  const pick = (value, fromTable) => (raiseOnly ? Math.max(Number(value) || 0, fromTable) : fromTable);
  const life = pick(current.life.max, entry.Life);
  await item.update(
    {
      'system.attributes.life.value': raiseOnly ? Math.max(current.life.value, life) : life,
      'system.attributes.life.max': life,
      'system.attributes.morale': pick(current.morale, entry.Mor),
      'system.attributes.defense': pick(current.defense, entry.Def),
      'system.attributes.bonus': pick(current.bonus, entry.Bon),
      'system.attributes.damage': raiseOnly ? current.damage : entry.Dmg,
      'system.animation.filled': true
    },
    { [SYNC_OPTION]: true }
  );
}

function npcSystemFromItem(item) {
  const a = item.system.attributes;
  return {
    level: getAnimationLevel(item),
    life: { value: a.life.value, max: a.life.max },
    morale: a.morale,
    defense: a.defense,
    bonus: a.bonus,
    damage: a.damage,
    initiative: a.initiative,
    capacity: a.capacity,
    createdFromTable: getAnimationTable(item)
  };
}

/** Players who own the item's character own the creature too. */
function ownershipFromItem(item) {
  const owner = item.parent ?? item;
  const ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE };
  for (const user of game.users) {
    if (!user.isGM && owner.testUserPermission(user, 'OWNER')) {
      ownership[user.id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    }
  }
  return ownership;
}

async function getAnimatedFolder() {
  const name = $l10n('SDM.Animation.Folder');
  return (
    game.folders.find(f => f.type === 'Actor' && f.name === name) ??
    Folder.create({ name, type: 'Actor' })
  );
}

/* -------------------------------------------- */
/*  Animate / deanimate                         */
/* -------------------------------------------- */

/** Create (or reuse) the creature and place its token in the current scene. Referee only. */
export async function animateItem(item, { app } = {}) {
  if (!game.user.isGM || !isAnimatable(item)) return;
  if (!canvas.scene) {
    ui.notifications.warn($l10n('SDM.Animation.NoScene'));
    return;
  }

  if (isAnimationBlocked(item)) {
    ui.notifications.warn($fmt('SDM.Animation.Blocked', { name: item.name }));
    return;
  }

  if (!item.system.animation.filled) await fillAttributesFromTable(item);

  // Repaired or recharged after the creature fell: it comes back with full life
  if ((Number(item.system.attributes.life.value) || 0) <= 0) {
    await item.update(
      { 'system.attributes.life.value': item.system.attributes.life.max },
      { [SYNC_OPTION]: true }
    );
  }

  let npc = getLinkedNpc(item);
  const system = npcSystemFromItem(item);
  if (npc) {
    await npc.update({ name: item.name, system, ownership: ownershipFromItem(item) });
  } else {
    const folder = await getAnimatedFolder();
    npc = await Actor.create({
      name: item.name,
      img: item.img,
      type: ActorType.NPC,
      folder: folder?.id,
      ownership: ownershipFromItem(item),
      system,
      flags: { sdm: { [FLAG]: item.uuid } }
    });
    // The actor's own creation hook resets the prototype token; set it afterwards
    await npc.update({
      'prototypeToken.actorLink': true,
      'prototypeToken.disposition': CONST.TOKEN_DISPOSITIONS.FRIENDLY,
      'prototypeToken.texture.src': item.img
    });
  }

  const update = { 'system.animation.actor': npc.uuid, 'system.animation.active': true };
  if (item.system.animation.mode === 'walks') update['system.readied'] = false;
  await item.update(update, { [SYNC_OPTION]: true });

  // Place the token, unless the creature is already in this scene
  if (canvas.scene.tokens.some(token => token.actorId === npc.id)) return npc;
  const restore = app && !app.minimized;
  if (restore) await app.minimize();
  try {
    const placements = await TokenPlacement.place({ tokens: [npc.prototypeToken] });
    const tokensData = [];
    for (const placement of placements) {
      delete placement.prototypeToken;
      const tokenDocument = await npc.getTokenDocument(placement);
      tokensData.push(tokenDocument.toObject());
    }
    if (tokensData.length) await canvas.scene.createEmbeddedDocuments('Token', tokensData);
  } catch (error) {
    console.error('SDM | Failed to place the animated item token', error);
  } finally {
    if (restore) await app.maximize();
  }

  ui.notifications.info($fmt('SDM.Animation.Animated', { name: item.name }));
  return npc;
}

/** Remove the creature's tokens and bring its state back to the item. Referee only. */
export async function deanimateItem(item, { reason } = {}) {
  if (!game.user.isGM) return;
  const npc = getLinkedNpc(item);

  if (npc) {
    for (const scene of game.scenes) {
      const ids = scene.tokens.filter(token => token.actorId === npc.id).map(token => token.id);
      if (ids.length) await scene.deleteEmbeddedDocuments('Token', ids);
    }
    const s = npc.system;
    await item.update(
      {
        'system.attributes.life.value': s.life.value,
        'system.attributes.life.max': s.life.max,
        'system.attributes.morale': s.morale,
        'system.attributes.defense': s.defense,
        'system.attributes.bonus': s.bonus,
        'system.attributes.damage': s.damage,
        'system.attributes.initiative': s.initiative ?? '',
        'system.animation.active': false
      },
      { [SYNC_OPTION]: true }
    );
  } else {
    await item.update({ 'system.animation.active': false }, { [SYNC_OPTION]: true });
  }

  ui.notifications.info($fmt(reason ?? 'SDM.Animation.Deanimated', { name: item.name }));
}

/** The creature fell (0 life): the active Referee turns it back into the item. */
export async function deanimateFallenCreature(npc) {
  if (game.users.activeGM?.id !== game.user.id) return;
  const item = getAnimatedSourceItem(npc);
  if (!item?.system.animation?.active) return;
  if ((Number(npc.system.life?.value) || 0) > 0) return;
  await deanimateItem(item, { reason: 'SDM.Animation.Fell' });
}

/**
 * The item's level changed (hallmark XP or the Referee): raise the creature.
 * Animated: the NPC levels up; otherwise the item's attributes are raised from the table.
 */
export async function syncAnimationLevel(item) {
  if (!isAnimatable(item)) return;
  const level = getAnimationLevel(item);
  const npc = getLinkedNpc(item);
  if (item.system.animation.active && npc) {
    if (level > (npc.system.level ?? 0)) await npc.levelUpNpcTo(level);
  } else if (item.system.animation.filled) {
    await fillAttributesFromTable(item, { raiseOnly: true });
  }
}

/**
 * The creature's life wears the item down. It never gets better on its own (repair or
 * recharge as usual).
 * - Walks away: at half life or less the item is notched, at 0 life it is broken.
 * - Energy: at half life or less the item is running low, at 0 life it has run out.
 */
export async function applyAnimatedWear(npc) {
  const item = getAnimatedSourceItem(npc);
  if (!item) return;

  const value = Number(npc.system.life?.value) || 0;
  const max = Number(npc.system.life?.max) || 0;
  const stage = value <= 0 ? 2 : max > 0 && value <= max / 2 ? 1 : 0;
  if (!stage) return;

  const walks = item.system.animation?.mode === 'walks';
  const field = walks ? 'status' : 'resources';
  const steps = walks ? ['', ItemStatusType.NOTCHED, ItemStatusType.BROKEN] : ['', 'running_low', 'run_out'];
  const current = Math.max(steps.indexOf(item.system[field] ?? ''), 0);
  if (stage <= current) return;

  const update = { [`system.${field}`]: steps[stage] };
  if (walks && stage === 2) update['system.readied'] = false;
  await item.update(update, { [SYNC_OPTION]: true });
}

/* -------------------------------------------- */
/*  Token HUD                                   */
/* -------------------------------------------- */

export function setupAnimatedItems() {
  Hooks.on('renderTokenHUD', onRenderTokenHUD);
}

function onRenderTokenHUD(hud, html) {
  if (!game.user.isGM) return;
  const token = hud?.document ?? hud?.object?.document;
  const actor = token?.actor;
  const item = getAnimatedSourceItem(actor);
  if (!item) return;

  const root = html?.querySelectorAll ? html : html?.[0];
  if (!root || root.querySelector(`.${HUD_BUTTON_CLASS}`)) return;

  const label = $l10n('SDM.Animation.Deanimate');
  const button = document.createElement('button');
  button.type = 'button';
  button.classList.add('control-icon', HUD_BUTTON_CLASS);
  button.dataset.tooltip = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = '<i class="fa-solid fa-box" inert></i>';
  button.addEventListener('click', async event => {
    event.preventDefault();
    event.stopPropagation();
    await deanimateItem(item);
  });
  (root.querySelector('.col.right') ?? root).append(button);
}

import { ActorType } from './constants.mjs';
import { $fmt, $l10n } from './globalUtils.mjs';
import { cardHeader, cardWrap, marginText, resultStrip } from '../rolls/ui/cardParts.mjs';
import { createChatMessage } from './chatUtils.mjs';
import { attackFollowupHtml } from '../rolls/attackFollowup.mjs';
import { getItemIdentifier } from './effectReferences.mjs';
import { sceneUnitsForMeters, worldUnit, worldUnitsForMeters } from './zones.mjs';

/**
 * Areas (H7): an item with an area (small, medium, large) is placed on the map as a region, and the
 * tokens inside become targets. Sizes follow the item, not the scene (the book's Movement and Range
 * table): on foot a small area is ~3 m across, medium ~10 m, large ~30 m; vehicle weapons use the
 * autogolem column (~10 / 50 / 150 m). Circles and squares are centered where you click; cones and
 * lines start at the user's token and point where you click (Foundry's region placement).
 * - Attack card: "Place area" compares the attack with every target's defense on a card of its own
 *   (hit / miss per target) and targets those hit, so damage and condition buttons act on them.
 * - Use (consumables with an area): the tokens inside are the Use's targets (saves included).
 * The area stays on the map until removed (the card's button, or the Regions layer).
 */

const CHANNEL = 'system.sdm';
const CREATE_ACTION = 'areaCreate';
const REMOVE_ACTION = 'areaRemove';
const AREA_FLAG = 'area';

export const AREA_METERS = {
  foot: { small: 3, medium: 10, large: 30 },
  vehicle: { small: 10, medium: 50, large: 150 }
};
const CONE_ANGLE = 60; // degrees
const LINE_WIDTH_METERS = 1.5;

const esc = text => foundry.utils.escapeHTML(String(text ?? ''));

/** The item's area, or null (no area, or a single target). */
export function itemArea(item) {
  const size = item?.system?.area?.value;
  if (!size || !AREA_METERS.foot[size]) return null;
  if (!item.system?.features?.has?.('area')) return null;
  const shape = item.system.area.shape || 'circle';
  const meters = AREA_METERS[item.system.area.vehicle ? 'vehicle' : 'foot'][size];
  return { size, shape, meters };
}

/** "Area: medium (~10 m)" in the world unit. */
export function areaLabel(item) {
  const area = itemArea(item);
  if (!area) return '';
  return $fmt('SDM.AreaLabel', {
    size: $l10n(CONFIG.SDM.areaValues[area.size]).toLowerCase(),
    shape: $l10n(CONFIG.SDM.areaShapes[area.shape]).toLowerCase(),
    distance: worldUnitsForMeters(area.meters),
    unit: worldUnit()
  });
}

/* -------------------------------------------- */
/*  Placing                                     */
/* -------------------------------------------- */

const pixelsPerMeter = scene => scene.dimensions.distancePixels * sceneUnitsForMeters(1, scene);

function tokenCenter(token) {
  if (token.object?.center) return token.object.center;
  const size = token.parent.grid.size;
  return { x: token.x + (token.width * size) / 2, y: token.y + (token.height * size) / 2 };
}

/** The region shape of the area (Foundry v14 shapes: circle, cone, line, rectangle), placed at the cursor. */
function areaShape(area, scene, origin) {
  const across = area.meters * pixelsPerMeter(scene);
  switch (area.shape) {
    case 'cone':
      return { type: 'cone', x: origin.x, y: origin.y, radius: across, angle: CONE_ANGLE, rotation: 0, curvature: 'round', gridBased: true };
    case 'line':
      return { type: 'line', x: origin.x, y: origin.y, length: across, width: LINE_WIDTH_METERS * pixelsPerMeter(scene), rotation: 0, gridBased: true };
    case 'square':
      return { type: 'rectangle', x: 0, y: 0, width: across, height: across, anchorX: 0.5, anchorY: 0.5, rotation: 0, gridBased: true };
    default:
      return { type: 'circle', x: 0, y: 0, radius: across / 2, gridBased: true };
  }
}

/**
 * Place the item's area on the current scene (Foundry's region placement: it follows the cursor,
 * the wheel rotates it, click places it, right-click or Esc cancels) and target the tokens inside.
 * Cones and lines start at the user's token and point at the cursor.
 * @returns {Promise<{areaId, tokens: TokenDocument[]}|null>} null when cancelled or impossible.
 */
export async function placeArea({ actor, item }) {
  const area = itemArea(item);
  const scene = canvas?.scene;
  if (!area || !scene || !canvas.ready) {
    if (area) ui.notifications.warn($l10n('SDM.AreaNoScene'));
    return null;
  }
  const fromToken = area.shape === 'cone' || area.shape === 'line';
  const sourceToken = actor?.getActiveTokens?.(false, true)?.find(t => t.parent === scene) ?? null;
  if (fromToken && !sourceToken) {
    ui.notifications.warn($fmt('SDM.AreaNeedsToken', { name: actor?.name ?? '' }));
    return null;
  }
  const origin = sourceToken ? tokenCenter(sourceToken) : { x: 0, y: 0 };
  const areaId = foundry.utils.randomID();
  const data = {
    name: item.name,
    color: game.user.color?.css,
    shapes: [areaShape(area, scene, origin)],
    restriction: { enabled: false },
    visibility: CONST.REGION_VISIBILITY.ALWAYS,
    highlightMode: 'coverage',
    displayMeasurements: true,
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE, [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
    flags: { sdm: { [AREA_FLAG]: { id: areaId, item: item.uuid, actor: actor?.uuid ?? '', user: game.user.id } } }
  };
  if (canvas.level?.id) data.levels = [canvas.level.id];

  ui.notifications.info($l10n('SDM.AreaPlaceHint'));
  // Cones and lines: the origin stays on the token, the cursor sets the direction
  const onMove = fromToken
    ? ({ shape, position }) => {
        const rotation = Math.toDegrees(Math.atan2(position.y - origin.y, position.x - origin.x));
        shape.updateSource({ x: origin.x, y: origin.y, rotation });
        return false;
      }
    : undefined;
  let placed;
  try {
    placed = await canvas.regions.placeRegion(data, { create: false, onMove, allowRotation: !fromToken });
  } catch (error) {
    console.error('SDM | Placing the area failed', error);
    return null;
  }
  if (!placed) return null;

  // Who is inside (the attacker too, unless the area starts at them: cones and lines)
  const tokens = scene.tokens.filter(token => {
    if (token.hidden && !game.user.isGM) return false;
    if (fromToken && token === sourceToken) return false;
    const center = tokenCenter(token);
    return placed.testPoint({ x: center.x, y: center.y, elevation: token.elevation ?? 0 });
  });

  await createArea(scene, placed.toObject());
  setTargets(tokens);
  return { areaId, tokens };
}

async function createArea(scene, data) {
  delete data._id;
  if (game.user.isGM || CONFIG.Region.documentClass.canUserCreate(game.user)) return scene.createEmbeddedDocuments('Region', [data]);
  if (!game.users.activeGM) return ui.notifications.warn($l10n('SDM.AreaNoGM'));
  game.socket.emit(CHANNEL, { action: CREATE_ACTION, sceneId: scene.id, data });
}

/** Remove an area placed from a card (its owner or the Referee). */
export async function removeArea(sceneId, areaId) {
  const scene = game.scenes.get(sceneId);
  const region = scene?.regions.find(r => r.getFlag('sdm', AREA_FLAG)?.id === areaId);
  if (!region) return;
  if (region.isOwner) return region.delete();
  game.socket.emit(CHANNEL, { action: REMOVE_ACTION, sceneId, areaId });
}

/** Less damage from areas (Bystander: its level). */
export function areaDamageReduction(actor) {
  if (!actor?.items?.some(i => getItemIdentifier(i) === 'bystander')) return 0;
  return Math.max(Number(actor.system?.level) || 0, 0);
}

/** Target exactly these tokens (the user's own targets). */
export function setTargets(tokens) {
  const ids = tokens.map(t => t.id);
  if (typeof canvas.tokens?.setTargets === 'function') {
    canvas.tokens.setTargets(ids, { mode: 'replace' });
    return;
  }
  for (const token of [...game.user.targets]) token.setTarget(false, { releaseOthers: false, groupSelection: true });
  for (const doc of tokens) doc.object?.setTarget(true, { releaseOthers: false, groupSelection: true });
}

/* -------------------------------------------- */
/*  Attack card                                 */
/* -------------------------------------------- */

const DEFENSE_FIELD = { physical: 'defense', mental: 'mental_defense', social: 'social_defense' };

/** The attack card's "Place area" button, when the attack was made with an item that has an area. */
export function areaAttackButton({ actor, item, total, isNat1, isNat20, attackTarget, kind = 'weapon', multiplier = '' }) {
  if (!itemArea(item)) return '';
  return (
    `<button type="button" data-action="sdmPlaceArea" data-actor-uuid="${esc(actor.uuid)}" data-item-id="${esc(item.id)}"` +
    ` data-kind="${esc(kind ?? 'weapon')}" data-multiplier="${esc(multiplier ?? '')}"` +
    ` data-total="${Number(total) || 0}" data-nat1="${isNat1 ? 1 : 0}" data-nat20="${isNat20 ? 1 : 0}" data-attack-target="${esc(attackTarget ?? 'physical')}">` +
    `<i class="fa-solid fa-bullseye"></i> ${esc($l10n('SDM.AreaPlace'))} <span class="sdm-followup-formula">${esc(areaLabel(item))}</span></button>`
  );
}

function outcomeFor(total, defense, isNat1, isNat20) {
  if (isNat1) return { hit: false, tone: 'bad', word: $l10n('SDM.CriticalFailure') };
  if (isNat20) return { hit: true, tone: 'crit', word: $l10n('SDM.CriticalSuccess') };
  if (total === defense) return { hit: false, tone: 'mid', word: $l10n('SDM.ForceOrFail') };
  return total > defense ? { hit: true, tone: 'good', word: $l10n('SDM.Card.Hit') } : { hit: false, tone: 'bad', word: $l10n('SDM.Card.Miss') };
}

/** Place the area from the attack card, then post who it hit (one attack against each defense). */
async function onPlaceAreaFromAttack(button) {
  const actor = fromUuidSync(button.dataset.actorUuid);
  const item = actor?.items?.get(button.dataset.itemId);
  if (!actor?.isOwner || !item) return;
  const placed = await placeArea({ actor, item });
  if (!placed) return;
  const total = Number(button.dataset.total) || 0;
  const isNat1 = button.dataset.nat1 === '1';
  const isNat20 = button.dataset.nat20 === '1';
  const rows = [];
  const hits = [];
  for (const token of placed.tokens) {
    const target = token.actor;
    if (!target) continue;
    const field = target.type === ActorType.NPC ? 'defense' : DEFENSE_FIELD[button.dataset.attackTarget] ?? 'defense';
    const defense = Number(target.system?.[field]) || 0;
    const result = outcomeFor(total, defense, isNat1, isNat20);
    if (result.hit) hits.push(token);
    // Bystander: less damage from areas, by its level (taken off when the area's damage is applied)
    const reduction = areaDamageReduction(target);
    rows.push(
      resultStrip({
        tone: result.tone,
        img: token.texture?.src || target.img,
        name: token.name,
        sub: `${esc($l10n('SDM.FieldDefense'))} ${defense}`,
        outcome: result.word.toUpperCase(),
        margin: result.tone === 'good' || (result.tone === 'bad' && !isNat1) ? marginText(total - defense) : ''
      })
    );
    if (reduction && result.hit) {
      rows.push(`<div class="sdm-card-tag info">${esc($fmt('SDM.AreaBystander', { name: token.name, amount: reduction }))}</div>`);
    }
  }
  setTargets(hits);
  const scene = canvas.scene;
  // Damage (or the power) once for the whole area: every token hit gets it
  const flag = {
    id: item.id,
    name: item.name,
    kind: button.dataset.kind || 'weapon',
    actor: actor.uuid,
    multiplier: button.dataset.multiplier || '',
    areaTargets: hits.map(t => t.actor?.uuid).filter(Boolean)
  };
  const damageButton = hits.length ? attackFollowupHtml(flag) : '';
  const actions =
    damageButton +
    `<button type="button" data-action="sdmAreaTargetHits"><i class="fa-solid fa-crosshairs"></i> ${esc($l10n('SDM.AreaTargetHits'))}</button>` +
    `<button type="button" data-action="sdmAreaRemove"><i class="fa-solid fa-eraser"></i> ${esc($l10n('SDM.AreaRemove'))}</button>`;
  const content = cardWrap(
    cardHeader({ icon: 'fa-solid fa-bullseye', title: item.name, chips: [areaLabel(item), $fmt('SDM.AreaAttackTotal', { total })] }) +
      (rows.length ? rows.join('') : `<div class="sdm-card-tag info">${esc($l10n('SDM.AreaEmpty'))}</div>`) +
      `<div class="sdm-card-actions">${actions}</div>`,
    { kind: 'attack' }
  );
  await createChatMessage({
    actor,
    content,
    flags: { sdm: { areaCard: { sceneId: scene.id, areaId: placed.areaId, hits: hits.map(t => t.uuid) }, attackItem: flag } }
  });
}

/* -------------------------------------------- */
/*  Chat and socket                             */
/* -------------------------------------------- */

/** renderChatMessageHTML: Place area (attack card), Target hits and Remove area (area card). */
export function bindAreaButtons(message, html) {
  html.querySelectorAll('[data-action="sdmPlaceArea"]').forEach(button =>
    button.addEventListener('click', event => {
      event.preventDefault();
      onPlaceAreaFromAttack(button);
    })
  );
  const card = message?.getFlag?.('sdm', 'areaCard');
  if (!card) return;
  html.querySelectorAll('[data-action="sdmAreaTargetHits"]').forEach(button =>
    button.addEventListener('click', event => {
      event.preventDefault();
      const tokens = (card.hits ?? []).map(uuid => fromUuidSync(uuid)).filter(t => t?.parent === canvas.scene);
      setTargets(tokens);
    })
  );
  html.querySelectorAll('[data-action="sdmAreaRemove"]').forEach(button => {
    const allowed = game.user.isGM || message.isAuthor;
    if (!allowed) return button.remove();
    button.addEventListener('click', event => {
      event.preventDefault();
      removeArea(card.sceneId, card.areaId);
    });
  });
}

export function setupAreas() {
  game.socket.on(CHANNEL, async message => {
    if (game.users.activeGM?.id !== game.user.id) return;
    const scene = game.scenes.get(message?.sceneId);
    if (!scene) return;
    if (message.action === CREATE_ACTION) await scene.createEmbeddedDocuments('Region', [message.data]);
    if (message.action === REMOVE_ACTION) {
      const region = scene.regions.find(r => r.getFlag('sdm', AREA_FLAG)?.id === message.areaId);
      await region?.delete();
    }
  });
}

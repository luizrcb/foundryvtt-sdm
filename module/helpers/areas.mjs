import { ActorType } from './constants.mjs';
import { $fmt, $l10n } from './globalUtils.mjs';
import { cardHeader, cardWrap, marginText, resultStrip } from '../rolls/ui/cardParts.mjs';
import { createChatMessage } from './chatUtils.mjs';
import { attackFollowupHtml } from '../rolls/attackFollowup.mjs';
import { getItemIdentifier } from './effectReferences.mjs';
import { bandForMeters, metersPerUnit, sceneUnitsForMeters, sceneZoneLimits, worldUnit, worldUnitsForMeters, ZONE_BANDS } from './zones.mjs';

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

/** The power an item rolls: a power item's own, or an album's selected power (kind "album"). */
function areaPower(item, kind) {
  if (kind === 'album') {
    const powers = item?.system?.powers ?? [];
    return powers[item.system.powers_current_index] ?? powers[0] ?? null;
  }
  if (kind === 'power' || (!kind && item?.system?.type === 'power')) return item?.system?.power ?? null;
  return null;
}

/**
 * The item's area, or null (no area, or a single target): a power's area (power items and the
 * album's selected power, kind "power" / "album"), else the gear's area feature.
 */
export function itemArea(item, kind = '') {
  const power = areaPower(item, kind);
  if (power?.area && AREA_METERS.foot[power.area]) {
    return {
      size: power.area,
      shape: power.area_shape || 'circle',
      affects: power.area_affects || 'everyone',
      meters: AREA_METERS.foot[power.area],
      range: `${power.range ?? ''}`
    };
  }
  if (kind === 'album' || kind === 'power') return null;
  const size = item?.system?.area?.value;
  if (!size || !AREA_METERS.foot[size]) return null;
  if (!item.system?.features?.has?.('area')) return null;
  const shape = item.system.area.shape || 'circle';
  const meters = AREA_METERS[item.system.area.vehicle ? 'vehicle' : 'foot'][size];
  const range = item.system?.weapon?.range || item.system?.range?.value || '';
  return { size, shape, affects: item.system.area.affects || 'everyone', meters, range: `${range}` };
}

/** "small circle (~10 ft)" in the world unit. */
export function areaLabel(item, kind = '') {
  const area = itemArea(item, kind);
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
function areaShape(area, scene, origin, token = null) {
  const across = area.meters * pixelsPerMeter(scene);
  switch (area.shape) {
    case 'cone':
      return { type: 'cone', x: origin.x, y: origin.y, radius: across, angle: CONE_ANGLE, rotation: 0, curvature: 'round', gridBased: true };
    case 'line':
      return { type: 'line', x: origin.x, y: origin.y, length: across, width: LINE_WIDTH_METERS * pixelsPerMeter(scene), rotation: 0, gridBased: true };
    case 'square':
      return { type: 'rectangle', x: 0, y: 0, width: across, height: across, anchorX: 0.5, anchorY: 0.5, rotation: 0, gridBased: true };
    case 'ring': {
      // A band one square wide (1.5 m) on the area's edge: a wall of fire around a point
      const half = (LINE_WIDTH_METERS * pixelsPerMeter(scene)) / 2;
      return { type: 'ring', x: 0, y: 0, radius: across / 2, innerWidth: half, outerWidth: half, gridBased: true };
    }
    case 'emanation': {
      // Around the user's token (a burst from its space): the area's size beyond its edge
      const source = token._source;
      return {
        type: 'emanation',
        base: { type: 'token', x: source.x, y: source.y, width: source.width, height: source.height, shape: source.shape },
        radius: across / 2,
        gridBased: true
      };
    }
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
export async function placeArea({ actor, item, kind = '' }) {
  const area = itemArea(item, kind);
  const scene = canvas?.scene;
  if (!area || !scene || !canvas.ready) {
    if (area) ui.notifications.warn($l10n('SDM.AreaNoScene'));
    return null;
  }
  // Cones and lines start at the user's token; an emanation surrounds it
  const fromToken = area.shape === 'cone' || area.shape === 'line' || area.shape === 'emanation';
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
    shapes: [areaShape(area, scene, origin, sourceToken)],
    restriction: { enabled: false },
    visibility: CONST.REGION_VISIBILITY.ALWAYS,
    highlightMode: 'coverage',
    displayMeasurements: true,
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE, [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
    flags: { sdm: { [AREA_FLAG]: { id: areaId, item: item.uuid, actor: actor?.uuid ?? '', user: game.user.id } } }
  };
  if (canvas.level?.id) data.levels = [canvas.level.id];

  // An emanation needs no placing: it is around the token already
  if (area.shape === 'emanation') {
    const placed = new CONFIG.Region.documentClass(foundry.utils.deepClone(data), { parent: scene });
    return finishPlacement({ area, scene, placed, sourceToken, fromToken, origin, areaId });
  }
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
  return finishPlacement({ area, scene, placed, sourceToken, fromToken, origin, areaId });
}

/** The tokens inside the placed area (its side), the range warning, then the region created. */
async function finishPlacement({ area, scene, placed, sourceToken, fromToken, origin, areaId }) {
  // Who is inside (the attacker too, unless the area starts at or surrounds them)
  const tokens = scene.tokens.filter(token => {
    if (token.hidden && !game.user.isGM) return false;
    if (fromToken && token === sourceToken) return false;
    // No friendly fire (or only allies): by the disposition of the one placing it
    if (sourceToken && area.affects === 'enemies' && token.disposition === sourceToken.disposition) return false;
    if (sourceToken && area.affects === 'allies' && token.disposition !== sourceToken.disposition) return false;
    const center = tokenCenter(token);
    return placed.testPoint({ x: center.x, y: center.y, elevation: token.elevation ?? 0 });
  });

  // Its center within the item's range (a zone band): a warning when beyond (no penalty, your call)
  const outOfRange = !fromToken && sourceToken ? rangeWarning(area, scene, origin, placed) : '';
  if (outOfRange) ui.notifications.warn(outOfRange);

  await createArea(scene, placed.toObject());
  setTargets(tokens);
  return { areaId, tokens, outOfRange };
}

/** "Beyond Fireball's range (short): the area's center is at medium." when the center is out of range. */
function rangeWarning(area, scene, origin, placed) {
  const rangeIndex = ZONE_BANDS.indexOf(area.range.trim().toLowerCase());
  if (rangeIndex < 0) return '';
  const shape = placed.shapes[0];
  // Circles and squares (anchored at their middle) have their center at x, y
  const pixels = Math.hypot(shape.x - origin.x, shape.y - origin.y);
  const distance = (pixels / scene.dimensions.distancePixels) * metersPerUnit(scene);
  const band = bandForMeters(distance, sceneZoneLimits(scene));
  if (band <= rangeIndex) return '';
  const label = index => $l10n(CONFIG.SDM.rangeType?.[ZONE_BANDS[index]] ?? ZONE_BANDS[index]);
  return $fmt('SDM.AreaOutOfRange', { item: placed.name, range: label(rangeIndex), zone: label(band) });
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
  if (!itemArea(item, kind)) return '';
  return (
    `<button type="button" data-action="sdmPlaceArea" data-actor-uuid="${esc(actor.uuid)}" data-item-id="${esc(item.id)}"` +
    ` data-kind="${esc(kind ?? 'weapon')}" data-multiplier="${esc(multiplier ?? '')}"` +
    ` data-total="${Number(total) || 0}" data-nat1="${isNat1 ? 1 : 0}" data-nat20="${isNat20 ? 1 : 0}" data-attack-target="${esc(attackTarget ?? 'physical')}">` +
    `<i class="fa-solid fa-bullseye"></i> ${esc($l10n('SDM.AreaPlace'))} <span class="sdm-followup-formula">${esc(areaLabel(item, kind))}</span></button>`
  );
}

/** A power card's "Place area" (a power with an area): everyone inside takes the power's roll. */
export function areaPowerButton({ actor, item, kind, total }) {
  if (!actor || !item || !itemArea(item, kind)) return '';
  return (
    `<button type="button" data-action="sdmPlacePowerArea" data-actor-uuid="${esc(actor.uuid)}" data-item-id="${esc(item.id)}"` +
    ` data-kind="${esc(kind)}" data-total="${Number(total) || 0}">` +
    `<i class="fa-solid fa-bullseye"></i> ${esc($l10n('SDM.AreaPlace'))} <span class="sdm-followup-formula">${esc(areaLabel(item, kind))}</span></button>`
  );
}

/** Each target's share of an area's damage: the total less its reduction (Bystander). */
export function areaShares(actors, total) {
  return actors.map(target => {
    const reduction = areaDamageReduction(target);
    return { target, reduction, amount: Math.max((Number(total) || 0) - reduction, 0) };
  });
}

/** A button per target to apply its share (damage not applied automatically). */
export function areaApplyButtonsHtml(shares) {
  if (!shares.length) return '';
  return (
    `<div class="sdm-area-apply">` +
    shares
      .map(
        share =>
          `<button type="button" data-action="sdmAreaApplyDamage" data-target-uuid="${esc(share.target.uuid)}" data-amount="${share.amount}">` +
          `<i class="fa-solid fa-heart-crack"></i> ${esc(share.target.name)} −${share.amount}${share.reduction ? ` (−${share.reduction})` : ''}</button>`
      )
      .join('') +
    `</div>`
  );
}

/** Place a power's area from its card: a card lists who is inside, with a button each for the roll. */
async function onPlacePowerArea(button) {
  const actor = fromUuidSync(button.dataset.actorUuid);
  const item = actor?.items?.get(button.dataset.itemId);
  const kind = button.dataset.kind;
  if (!actor?.isOwner || !item) return;
  const placed = await placeArea({ actor, item, kind });
  if (!placed) return;
  const total = Number(button.dataset.total) || 0;
  const targets = [...new Set(placed.tokens.map(t => t.actor).filter(Boolean))];
  const names = placed.tokens.map(t => esc(t.name)).join(', ');
  const actions =
    `<button type="button" data-action="sdmAreaTargetHits"><i class="fa-solid fa-crosshairs"></i> ${esc($l10n('SDM.AreaTargetInside'))}</button>` +
    `<button type="button" data-action="sdmAreaRemove"><i class="fa-solid fa-eraser"></i> ${esc($l10n('SDM.AreaRemove'))}</button>`;
  const content = cardWrap(
    cardHeader({ icon: 'fa-solid fa-bullseye', title: item.name, chips: [areaLabel(item, kind)] }) +
      (placed.outOfRange ? `<div class="sdm-card-tag warn">${esc(placed.outOfRange)}</div>` : '') +
      (names ? `<div class="sdm-card-tag info">${esc($l10n('SDM.AreaInside'))}: ${names}</div>` : `<div class="sdm-card-tag info">${esc($l10n('SDM.AreaEmpty'))}</div>`) +
      (total > 0 ? areaApplyButtonsHtml(areaShares(targets, total)) : '') +
      `<div class="sdm-card-actions">${actions}</div>`,
    { kind: 'power' }
  );
  await createChatMessage({
    actor,
    content,
    flags: { sdm: { areaCard: { sceneId: canvas.scene.id, areaId: placed.areaId, hits: placed.tokens.map(t => t.uuid) } } }
  });
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
  const placed = await placeArea({ actor, item, kind: button.dataset.kind });
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
    cardHeader({ icon: 'fa-solid fa-bullseye', title: item.name, chips: [areaLabel(item, button.dataset.kind), $fmt('SDM.AreaAttackTotal', { total })] }) +
      (placed.outOfRange ? `<div class="sdm-card-tag warn">${esc(placed.outOfRange)}</div>` : '') +
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
  html.querySelectorAll('[data-action="sdmPlacePowerArea"]').forEach(button =>
    button.addEventListener('click', event => {
      event.preventDefault();
      onPlacePowerArea(button);
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

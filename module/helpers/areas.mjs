import { ActorType } from './constants.mjs';
import { $fmt, $l10n } from './globalUtils.mjs';
import { cardHeader, cardWrap, marginText, resultStrip } from '../rolls/ui/cardParts.mjs';
import { createChatMessage } from './chatUtils.mjs';
import { saveDifficultyLabel, saveDifficultyValue } from '../app/save-against.mjs';
import { attackFollowupHtml } from '../rolls/attackFollowup.mjs';
import { getItemIdentifier } from './effectReferences.mjs';
import { bandForMeters, metersForWorldUnits, metersPerUnit, sceneUnitsForMeters, sceneZoneLimits, worldUnit, worldUnitsForMeters, ZONE_BANDS } from './zones.mjs';

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
const SAVE_ACTION = 'areaSave';
const AREA_FLAG = 'area';

/**
 * Sizes in standard squares (1.5 m / 5 ft), from the book's area table: circles, squares and rings by
 * the squares across (2 / 6 / 20: ~3 / 9 / 30 m); cones by length, 30° / 60° / 90° wide (3 / 6 / 11:
 * ~4 / 9 / 16 m); lines by length, one square wide (5 / 21 / 85: ~8 / 32 / 128 m). Vehicle weapons:
 * circles ~10 / 50 / 150 m across, cones and lines five times as long. Other grid scales convert by
 * meters, so the area keeps its size.
 */
const SQUARE_METERS = 1.5;
const AREA_SQUARES = {
  foot: {
    across: { small: 2, medium: 6, large: 20 },
    cone: { small: 3, medium: 6, large: 11 },
    line: { small: 5, medium: 21, large: 85 }
  },
  vehicle: {
    across: { small: 6, medium: 34, large: 100 },
    cone: { small: 15, medium: 30, large: 55 },
    line: { small: 25, medium: 105, large: 425 }
  }
};
const CONE_ANGLES = { small: 30, medium: 60, large: 90 };
const LINE_WIDTH_METERS = SQUARE_METERS;
const AREA_SIZES = ['small', 'medium', 'large'];
const isAreaSize = size => AREA_SIZES.includes(size);

/**
 * An area's size: meters (across, or length for cones and lines), the cone's angle, and the distance
 * shown on its label (the world unit). Across (in the world unit) replaces the size's length.
 */
function areaSize(size, shape, { vehicle = false, across = 0 } = {}) {
  const table = AREA_SQUARES[vehicle ? 'vehicle' : 'foot'];
  const squares = (shape === 'cone' ? table.cone : shape === 'line' ? table.line : table.across)[size] ?? table.across.small;
  const angle = shape === 'cone' ? CONE_ANGLES[size] ?? 60 : null;
  if (Number(across) > 0) return { meters: metersForWorldUnits(across), angle, distance: Number(across) };
  const distance = worldUnit() === 'ft' ? squares * 5 : worldUnit() === 'm' ? squares * SQUARE_METERS : worldUnitsForMeters(squares * SQUARE_METERS);
  return { meters: squares * SQUARE_METERS, angle, distance };
}

const esc = text => foundry.utils.escapeHTML(String(text ?? ''));

/** An area resolved by a save: its ability (blank: the one saving picks), difficulty and what a passed save does. */
function areaSave(ability, difficulty, target, pass) {
  return { ability: ability || '', difficulty: saveDifficultyValue(difficulty || '', target), pass: pass || 'avoid' };
}

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
  if (power?.area && isAreaSize(power.area)) {
    const shape = power.area_shape || 'circle';
    return {
      ...areaSize(power.area, shape, { across: power.area_across }),
      size: power.area,
      shape,
      affects: power.area_affects || 'everyone',
      linger: kind !== 'album' && !!power.area_linger,
      rounds: Number(power.area_rounds) || 0,
      follows: !!power.area_follows,
      save: power.area_resolve === 'save' ? areaSave(power.area_save_ability, power.area_save_difficulty, power.area_save_target, power.area_save_pass) : null,
      range: `${power.range ?? ''}`
    };
  }
  if (kind === 'album' || kind === 'power') return null;
  const size = item?.system?.area?.value;
  if (!size || !isAreaSize(size)) return null;
  if (!item.system?.features?.has?.('area')) return null;
  const shape = item.system.area.shape || 'circle';
  const range = item.system?.weapon?.range || item.system?.range?.value || '';
  return {
    // A size of its own (across, in the world unit), else the size's
    ...areaSize(size, shape, { vehicle: !!item.system.area.vehicle, across: item.system.area.across }),
    size,
    shape,
    affects: item.system.area.affects || 'everyone',
    linger: !!item.system.area.linger,
    rounds: Number(item.system.area.rounds) || 0,
    follows: !!item.system.area.follows,
    save:
      item.system.area.resolve === 'save'
        ? areaSave(item.system.area.save_ability, item.system.area.save_difficulty, item.system.area.save_target, item.system.area.save_pass)
        : null,
    range: `${range}`
  };
}

/** The effects a lingering area gives whoever stands in it: the item's own, except mods and those given to its bearer. */
export function lingerEffects(item) {
  return (item?.effects ?? []).filter(e => !e.transfer && !e.system?.isItemMod && !e.system?.isHallmarkUpgrade);
}

/** "Lingers 3 rounds" / "Lingers" for a lingering area with effects, else ''. */
function lingerLabel(item, kind) {
  const area = itemArea(item, kind);
  if (!area?.linger || !lingerEffects(item).length) return '';
  return area.rounds > 0 ? $fmt('SDM.AreaLingersRounds', { rounds: area.rounds }) : $l10n('SDM.AreaLingers');
}

/** "small circle (~10 ft)" in the world unit. */
export function areaLabel(item, kind = '') {
  const area = itemArea(item, kind);
  if (!area) return '';
  return $fmt('SDM.AreaLabel', {
    size: $l10n(CONFIG.SDM.areaValues[area.size]).toLowerCase(),
    shape: $l10n(CONFIG.SDM.areaShapes[area.shape]).toLowerCase(),
    distance: area.distance,
    unit: worldUnit()
  });
}

/* -------------------------------------------- */
/*  Geometry                                    */
/* -------------------------------------------- */

const pixelsPerMeter = scene => scene.dimensions.distancePixels * sceneUnitsForMeters(1, scene);

function tokenCenter(token) {
  if (token.object?.center) return token.object.center;
  const size = token.parent.grid.size;
  return { x: token.x + (token.width * size) / 2, y: token.y + (token.height * size) / 2 };
}

/* -------------------------------------------- */
/*  Squares                                     */
/* -------------------------------------------- */

/**
 * On square grids an area is the squares it covers more than half of, or whose middle it covers (a
 * circle loses the corner squares a square would have); circles, squares and rings are placed on
 * grid intersections; who is inside is any token on one of those squares. Gridless and hex scenes use the shape itself and the tokens' centers.
 */
const squareGrid = scene => scene?.grid?.type === CONST.GRID_TYPES.SQUARE;
const metersPerSquare = scene => scene.grid.distance / sceneUnitsForMeters(1, scene);
const SAMPLES = 6; // 6 × 6 points per square: more than half of them inside counts it
const squareKey = ({ i, j }) => `${i}.${j}`;

/** A size in the scene's squares (even for areas centered on an intersection). */
function squaresOf(meters, scene, { even = false } = {}) {
  const squares = meters / metersPerSquare(scene);
  return even ? Math.max(2, Math.round(squares / 2) * 2) : Math.max(1, Math.round(squares));
}

/**
 * The squares (offsets {i, j}) a region covers more than half of (or the middle of), less the
 * excluded ones; touched: every square it touches at all (cones).
 */
function coveredSquares(region, scene, exclude = new Set(), { touched = false } = {}) {
  const size = scene.grid.size;
  const bounds = region.bounds;
  const squares = [];
  if (!bounds) return squares;
  const i0 = Math.floor(bounds.y / size);
  const i1 = Math.ceil((bounds.y + bounds.height) / size);
  const j0 = Math.floor(bounds.x / size);
  const j1 = Math.ceil((bounds.x + bounds.width) / size);
  const tree = region.polygonTree;
  // Touched: a finer sample, so slivers count too
  const samples = touched ? 12 : SAMPLES;
  for (let i = i0; i < i1; i++) {
    for (let j = j0; j < j1; j++) {
      if (exclude.has(`${i}.${j}`)) continue;
      let inside = 0;
      for (let a = 0; a < samples && !(touched && inside); a++) {
        for (let b = 0; b < samples; b++) {
          if (tree.testPoint({ x: (j + (b + 0.5) / samples) * size, y: (i + (a + 0.5) / samples) * size })) inside++;
        }
      }
      if (touched) {
        if (inside) squares.push({ i, j });
        continue;
      }
      // A narrow cone's point covers little of a square: its middle inside counts too
      if (inside * 2 > samples * samples || tree.testPoint({ x: (j + 0.5) * size, y: (i + 0.5) * size })) squares.push({ i, j });
    }
  }
  return squares;
}

/** The squares as region shapes: one rectangle per run of squares in a row. */
function squareShapes(squares, scene) {
  const size = scene.grid.size;
  const rows = new Map();
  for (const { i, j } of squares) rows.set(i, [...(rows.get(i) ?? []), j]);
  const shapes = [];
  for (const [i, js] of rows) {
    js.sort((a, b) => a - b);
    let start = js[0];
    let last = js[0];
    for (const j of [...js.slice(1), null]) {
      if (j === last + 1) {
        last = j;
        continue;
      }
      shapes.push({ type: 'rectangle', x: start * size, y: i * size, width: (last - start + 1) * size, height: size, anchorX: 0, anchorY: 0, rotation: 0, gridBased: false });
      start = last = j;
    }
  }
  return shapes;
}

/** The squares a token stands on. */
const tokenSquares = token => token.getOccupiedGridSpaceOffsets?.() ?? [];

/** Tokens on any of the squares. */
function tokensOnSquares(squares, candidates) {
  const keys = new Set(squares.map(squareKey));
  return candidates.filter(token => tokenSquares(token).some(offset => keys.has(squareKey(offset))));
}

/**
 * Where a cone or line leaves the token: the point on its edge (a corner, or the middle of a side)
 * nearest the square it points at. A straight cone from a corner would split every square along it
 * in half (a small one would cover none), so straight ones leave from the middle of a side and
 * diagonal ones from a corner.
 */
function edgePoint(token, point) {
  const size = token.parent.grid.size;
  let best = null;
  for (let i = 0; i <= token.width * 2; i++) {
    for (let j = 0; j <= token.height * 2; j++) {
      if (i > 0 && i < token.width * 2 && j > 0 && j < token.height * 2) continue;
      const candidate = { x: token.x + (i * size) / 2, y: token.y + (j * size) / 2 };
      const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
      if (!best || distance < best.distance - 0.01) best = { ...candidate, distance };
    }
  }
  return { x: best.x, y: best.y };
}

/** The intersection nearest a point. */
const snapToIntersection = point => canvas.grid.getSnappedPoint(point, { mode: CONST.GRID_SNAPPING_MODES.VERTEX });

/** A cone or line from the user's token toward a point (on square grids: toward the middle of the square pointed at). */
function aimShape(shape, token, toward, scene) {
  const square = squareGrid(scene);
  const target = square ? canvas.grid.getSnappedPoint(toward, { mode: CONST.GRID_SNAPPING_MODES.CENTER }) : toward;
  const origin = square ? edgePoint(token, target) : tokenCenter(token);
  if (Math.hypot(target.x - origin.x, target.y - origin.y) < 1) return null;
  return { x: origin.x, y: origin.y, rotation: Math.toDegrees(Math.atan2(target.y - origin.y, target.x - origin.x)) };
}

/** Show the squares while placing (the grid's highlight), or clear them. */
const PREVIEW_LAYER = 'sdmAreaPreview';
function previewSquares(squares, color) {
  const grid = canvas.interface?.grid;
  if (!grid) return;
  if (!grid.highlightLayers?.[PREVIEW_LAYER]) grid.addHighlightLayer(PREVIEW_LAYER);
  grid.clearHighlightLayer(PREVIEW_LAYER);
  const size = canvas.grid.size;
  for (const { i, j } of squares ?? []) grid.highlightPosition(PREVIEW_LAYER, { x: j * size, y: i * size, color, border: color, alpha: 0.35 });
}
const clearPreview = () => canvas.interface?.grid?.destroyHighlightLayer?.(PREVIEW_LAYER);

/* -------------------------------------------- */
/*  Placing                                     */
/* -------------------------------------------- */

/** The region shape of the area (Foundry v14 shapes: circle, cone, line, rectangle, ring, emanation). */
function areaShape(area, scene, origin, token = null) {
  const squares = squareGrid(scene);
  // On square grids the area is counted in squares (see coveredSquares), so the shape is exact
  const gridBased = !squares;
  const centered = !['cone', 'line'].includes(area.shape);
  const across = squares ? squaresOf(area.meters, scene, { even: centered }) * scene.grid.size : area.meters * pixelsPerMeter(scene);
  const width = squares ? scene.grid.size : LINE_WIDTH_METERS * pixelsPerMeter(scene);
  switch (area.shape) {
    case 'cone':
      return { type: 'cone', x: origin.x, y: origin.y, radius: across, angle: area.angle ?? 60, rotation: 0, curvature: 'round', gridBased };
    case 'line':
      return { type: 'line', x: origin.x, y: origin.y, length: across, width, rotation: 0, gridBased };
    case 'square':
      return { type: 'rectangle', x: 0, y: 0, width: across, height: across, anchorX: 0.5, anchorY: 0.5, rotation: 0, gridBased };
    case 'ring':
      // A band one square wide on the area's edge: a wall of fire around a point
      return { type: 'ring', x: 0, y: 0, radius: across / 2, innerWidth: width / 2, outerWidth: width / 2, gridBased };
    case 'emanation': {
      // Around the user's token (a burst from its space): the area's size beyond its edge
      const source = token._source;
      return {
        type: 'emanation',
        base: { type: 'token', x: source.x, y: source.y, width: source.width, height: source.height, shape: source.shape },
        radius: across / 2,
        gridBased
      };
    }
    default:
      return { type: 'circle', x: 0, y: 0, radius: across / 2, gridBased };
  }
}

/**
 * Place the item's area on the current scene (Foundry's region placement: it follows the cursor,
 * the wheel rotates it, click places it, right-click or Esc cancels) and target the tokens inside.
 * On square grids it snaps to intersections (always) and shows the squares it covers; cones and
 * lines start on an intersection of the user's token edge and point at the cursor.
 * @returns {Promise<{areaId, tokens: TokenDocument[]}|false|null>} false when the user cancelled
 *   (right-click or Esc), null when it can't be placed (no scene, no token for a cone).
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
  // Lingering: whoever stands in it has the item's effects (helpers/auras.mjs keeps them), for some rounds
  const effects = area.linger ? lingerEffects(item) : [];
  if (effects.length) {
    const combat = game.combats.find(c => c.started && c.scene?.id === scene.id) ?? null;
    Object.assign(data.flags.sdm[AREA_FLAG], {
      linger: true,
      effects: effects.map(e => e.uuid),
      affects: area.affects,
      disposition: sourceToken?.disposition ?? null,
      sourceToken: sourceToken?.id ?? '',
      expires: combat && area.rounds > 0 ? { combat: combat.id, round: combat.round + area.rounds } : null
    });
  }
  if (canvas.level?.id) data.levels = [canvas.level.id];

  // An emanation needs no placing: it is around the token already
  if (area.shape === 'emanation') {
    const placed = new CONFIG.Region.documentClass(foundry.utils.deepClone(data), { parent: scene });
    return finishPlacement({ area, scene, placed, sourceToken, fromToken, origin, areaId });
  }
  ui.notifications.info($l10n('SDM.AreaPlaceHint'));
  const squares = squareGrid(scene);
  const userSquares = new Set(fromToken && sourceToken ? tokenSquares(sourceToken).map(squareKey) : []);
  const color = game.user.color ?? 0x33bbff;
  // Cones and lines: from the token toward the cursor; the rest on the intersection nearest the cursor
  const onMove = ({ shape, position }) => {
    if (fromToken) {
      const aim = aimShape(shape, sourceToken, position, scene);
      if (aim) shape.updateSource(aim);
      return false;
    }
    if (!squares) return;
    shape.updateSource(snapToIntersection(position));
    return false;
  };
  const onChange = squares ? ({ document }) => previewSquares(coveredSquares(document, scene, userSquares, { touched: area.shape === 'cone' }), color) : undefined;
  let placed;
  try {
    placed = await canvas.regions.placeRegion(data, { create: false, onMove, onChange, allowRotation: !fromToken && !squares });
  } catch (error) {
    console.error('SDM | Placing the area failed', error);
    return null;
  } finally {
    if (squares) clearPreview();
  }
  if (!placed) return false;
  return finishPlacement({ area, scene, placed, sourceToken, fromToken, origin, areaId });
}

/** The tokens inside the placed area (its side), the range warning, then the region created. */
async function finishPlacement({ area, scene, placed, sourceToken, fromToken, origin, areaId }) {
  const candidates = scene.tokens.filter(token => {
    if (token.hidden && !game.user.isGM) return false;
    // The area starting at or surrounding its user leaves the user out
    if (fromToken && token === sourceToken) return false;
    // No friendly fire (or only allies): by the disposition of the one placing it
    if (sourceToken && area.affects === 'enemies' && token.disposition === sourceToken.disposition) return false;
    if (sourceToken && area.affects === 'allies' && token.disposition !== sourceToken.disposition) return false;
    return true;
  });

  // Its center within the item's range (a zone band): a warning when beyond (no penalty, your call)
  const outOfRange = !fromToken && sourceToken ? rangeWarning(area, scene, origin, placed) : '';
  if (outOfRange) ui.notifications.warn(outOfRange);

  const regionData = placed.toObject();
  let tokens;
  if (squareGrid(scene)) {
    // The squares it covers more than half of (not the user's own for cones, lines and emanations)
    const exclude = new Set(fromToken && sourceToken ? tokenSquares(sourceToken).map(squareKey) : []);
    const squares = coveredSquares(placed, scene, exclude, { touched: area.shape === 'cone' });
    tokens = tokensOnSquares(squares, candidates);
    if (squares.length) regionData.shapes = squareShapes(squares, scene);
  } else {
    tokens = candidates.filter(token => {
      const center = tokenCenter(token);
      return placed.testPoint({ x: center.x, y: center.y, elevation: token.elevation ?? 0 });
    });
  }

  // A lingering area that follows its user: attached to the token, it moves with it
  if (area.linger && area.follows && sourceToken && regionData.flags?.sdm?.[AREA_FLAG]?.linger) {
    regionData.attachment = { token: sourceToken.id };
    regionData.hidden = sourceToken.hidden;
    if (sourceToken.level !== undefined && sourceToken.level !== null) regionData.levels = [sourceToken.level];
  }
  await createArea(scene, regionData);
  setTargets(tokens);
  return { areaId, tokens, outOfRange, lingers: !!placed.getFlag('sdm', AREA_FLAG)?.linger };
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
/*  Splash                                      */
/* -------------------------------------------- */

/** Two tokens side by side: their grid spaces touch (diagonals count). */
export function isAdjacent(a, b) {
  const size = a.parent.grid.size;
  const box = t => ({ x0: t.x, y0: t.y, x1: t.x + t.width * size, y1: t.y + t.height * size });
  const p = box(a);
  const q = box(b);
  const gapX = Math.max(q.x0 - p.x1, p.x0 - q.x1, 0);
  const gapY = Math.max(q.y0 - p.y1, p.y0 - q.y1, 0);
  return gapX < size / 2 && gapY < size / 2;
}

/** A weapon's splash settings, or null when it has none. */
export function weaponSplash(item) {
  const w = item?.system?.weapon;
  if (!w) return null;
  const damage = w.splash_damage || 'formula';
  const formula = `${w.splash ?? ''}`.trim();
  if (damage === 'formula' && !formula) return null;
  const across = Number(w.splash_across) || 0;
  return {
    damage,
    formula,
    shape: w.splash_shape || 'around',
    // Sized like areas: a cone (from the attacker or behind) as a cone, behind in a line as a line
    ...areaSize(isAreaSize(w.splash_size) ? w.splash_size : 'small', w.splash_shape === 'behind_line' ? 'line' : 'cone', { across }),
    affects: w.splash_affects || 'everyone'
  };
}

/**
 * Who a splash reaches (never the target nor the attacker): adjacent to the target; in a cone the
 * user places from the attacker (a cleave); or behind the target, a line or a cone continuing the
 * attack's direction (a piercing shot, a blast through). Null when the placement is cancelled.
 */
export async function splashTokens({ splash, attackerToken, targetToken, name }) {
  const scene = targetToken.parent;
  const sides = token => {
    if (!attackerToken || splash.affects === 'everyone') return true;
    return splash.affects === 'enemies' ? token.disposition !== attackerToken.disposition : token.disposition === attackerToken.disposition;
  };
  const candidates = scene.tokens.filter(t => t !== targetToken && t !== attackerToken && t.actor && !(t.hidden && !game.user.isGM) && sides(t));
  if (splash.shape === 'around') return candidates.filter(t => isAdjacent(targetToken, t));

  const squares = squareGrid(scene);
  const length = squares ? squaresOf(splash.meters, scene) * scene.grid.size : splash.meters * pixelsPerMeter(scene);
  const width = squares ? scene.grid.size : LINE_WIDTH_METERS * pixelsPerMeter(scene);
  const gridBased = !squares;
  const target = tokenCenter(targetToken);
  const base = {
    name,
    color: game.user.color?.css,
    restriction: { enabled: false },
    visibility: CONST.REGION_VISIBILITY.ALWAYS,
    highlightMode: 'coverage',
    displayMeasurements: true
  };
  if (canvas.level?.id) base.levels = [canvas.level.id];
  let region;
  if (splash.shape === 'cone') {
    if (!attackerToken) {
      ui.notifications.warn($l10n('SDM.AttackFeature.SplashNoAttacker'));
      return null;
    }
    const cone = { type: 'cone', radius: length, angle: splash.angle ?? 60, curvature: 'round', gridBased };
    Object.assign(cone, aimShape(cone, attackerToken, target, scene) ?? { ...tokenCenter(attackerToken), rotation: 0 });
    const color = game.user.color ?? 0x33bbff;
    const exclude = new Set(tokenSquares(attackerToken).map(squareKey));
    ui.notifications.info($l10n('SDM.AreaPlaceHint'));
    try {
      region = await canvas.regions.placeRegion(
        { ...base, shapes: [cone] },
        {
          create: false,
          allowRotation: false,
          onMove: ({ shape, position }) => {
            const aim = aimShape(shape, attackerToken, position, scene);
            if (aim) shape.updateSource(aim);
            return false;
          },
          onChange: squares ? ({ document }) => previewSquares(coveredSquares(document, scene, exclude, { touched: true }), color) : undefined
        }
      );
    } catch (error) {
      console.error('SDM | Placing the splash failed', error);
      return null;
    } finally {
      if (squares) clearPreview();
    }
    if (!region) return null;
  } else {
    // Behind the target: from it, away from the attacker
    const from = attackerToken ? tokenCenter(attackerToken) : { x: target.x - 1, y: target.y };
    const rotation = Math.toDegrees(Math.atan2(target.y - from.y, target.x - from.x));
    const shape =
      splash.shape === 'behind_line'
        ? { type: 'line', x: target.x, y: target.y, length, width, rotation, gridBased }
        : { type: 'cone', x: target.x, y: target.y, radius: length, angle: splash.angle ?? 60, rotation, curvature: 'round', gridBased };
    region = new CONFIG.Region.documentClass({ ...base, shapes: [shape] }, { parent: scene });
  }
  // Square grids: anyone on a square it covers more than half of (not the target's or attacker's squares)
  if (squares) {
    const exclude = new Set([...tokenSquares(targetToken), ...(attackerToken ? tokenSquares(attackerToken) : [])].map(squareKey));
    return tokensOnSquares(coveredSquares(region, scene, exclude, { touched: splash.shape !== 'behind_line' }), candidates);
  }
  return candidates.filter(t => {
    const c = tokenCenter(t);
    return region.testPoint({ x: c.x, y: c.y, elevation: t.elevation ?? 0 });
  });
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

/** "Sacrificed" / "No sacrifice" for a tie (area card, splash): the Referee's call. */
export function tieButtons({ kind, tokenUuid = '', actorUuid, name, amount = 0, reason = '' }) {
  const data = `data-kind="${esc(kind)}" data-token-uuid="${esc(tokenUuid)}" data-actor-uuid="${esc(actorUuid)}" data-name="${esc(name)}" data-amount="${Number(amount) || 0}" data-reason="${esc(reason)}"`;
  return (
    `<div class="sdm-card-tag warn sdm-tie-row" data-actor-uuid="${esc(actorUuid)}"><i class="fa-solid fa-scale-balanced"></i> ${esc($fmt('SDM.AreaTie', { name }))}` +
    ` <button type="button" data-action="sdmTieSacrifice" data-yes="1" ${data}>${esc($l10n('SDM.SaveAgainst.SacrificeMade'))}</button>` +
    `<button type="button" data-action="sdmTieSacrifice" data-yes="" ${data}>${esc($l10n('SDM.SaveAgainst.SacrificeNot'))}</button></div>`
  );
}

/**
 * A tie resolved by the Referee: on the area card a sacrifice makes it a hit (added to the damage
 * button's targets); on a splash it takes the splash damage already rolled. The row says what was chosen.
 */
async function onTieSacrifice(message, button) {
  const yes = button.dataset.yes === '1';
  const { kind, tokenUuid, actorUuid, name } = button.dataset;
  const flags = foundry.utils.deepClone(message.flags?.sdm ?? {});
  const div = document.createElement('div');
  div.innerHTML = message.content;
  const row = [...div.querySelectorAll('.sdm-tie-row')].find(r => r.dataset.actorUuid === actorUuid);
  if (!row) return;
  const line = document.createElement('div');
  line.className = `sdm-card-tag ${yes ? 'good' : 'info'}`;
  line.textContent = $fmt(yes ? 'SDM.AreaTieHit' : 'SDM.AreaTieMiss', { name });
  row.replaceWith(line);
  if (kind === 'area' && yes && flags.areaCard) {
    flags.areaCard.hits = [...new Set([...(flags.areaCard.hits ?? []), tokenUuid])];
    if (flags.attackItem) {
      flags.attackItem.areaTargets = [...new Set([...(flags.attackItem.areaTargets ?? []), actorUuid])];
      flags.attackItem.sacrificed = [...new Set([...(flags.attackItem.sacrificed ?? []), actorUuid])];
      const damageButton = div.querySelector('[data-action="sdmAttackFollowup"]');
      if (damageButton) {
        damageButton.dataset.areaTargets = flags.attackItem.areaTargets.join(',');
        damageButton.dataset.areaExtra = flags.attackItem.sacrificed.join(',');
      }
    }
  }
  if (kind === 'splash' && yes) {
    const actor = fromUuidSync(actorUuid);
    const { changeLifeOf } = await import('../app/use-item.mjs');
    if (actor) await changeLifeOf(actor, Number(button.dataset.amount) || 0, { reason: button.dataset.reason });
  }
  await message.update({ content: div.innerHTML, 'flags.sdm': flags });
}

/** Each target's share of an area's damage: the total less its reduction (Bystander). */
export function areaShares(actors, total, { saved = [], pass = '' } = {}) {
  const passed = new Set(saved);
  return actors.map(target => {
    const reduction = areaDamageReduction(target);
    // A passed save: half the damage (rounded up) or none; "shorter" only shortens the effects
    let base = Number(total) || 0;
    if (passed.has(target.uuid)) base = pass === 'half' ? Math.ceil(base / 2) : pass === 'avoid' ? 0 : base;
    return { target, reduction, amount: Math.max(base - reduction, 0), saved: passed.has(target.uuid) };
  });
}

/**
 * A button per target to apply its share (damage not applied automatically); with heal, a second
 * one heals it instead (a power that heals in an area: everyone inside gets the roll back).
 */
export function areaApplyButtonsHtml(shares, { heal = false, total = 0 } = {}) {
  if (!shares.length) return '';
  return (
    `<div class="sdm-area-apply">` +
    shares
      .map(
        share =>
          `<span class="sdm-area-share">` +
          `<button type="button" data-action="sdmAreaApplyDamage" data-target-uuid="${esc(share.target.uuid)}" data-amount="${share.amount}">` +
          `<i class="fa-solid fa-heart-crack"></i> ${esc(share.target.name)} −${share.amount}${share.reduction ? ` (−${share.reduction})` : ''}</button>` +
          (heal
            ? `<button type="button" data-action="sdmAreaApplyDamage" data-heal="1" data-target-uuid="${esc(share.target.uuid)}" data-amount="${Number(total) || share.amount}" data-tooltip="${esc($l10n('SDM.Card.Heal'))}"><i class="fa-solid fa-heart"></i> +${Number(total) || share.amount}</button>`
            : '') +
          `</span>`
      )
      .join('') +
    `</div>`
  );
}


function outcomeFor(total, defense, isNat1, isNat20) {
  if (isNat1) return { hit: false, tone: 'bad', word: $l10n('SDM.CriticalFailure') };
  if (isNat20) return { hit: true, tone: 'crit', word: $l10n('SDM.CriticalSuccess') };
  if (total === defense) return { hit: false, tone: 'mid', word: $l10n('SDM.ForceOrFail') };
  return total > defense ? { hit: true, tone: 'good', word: $l10n('SDM.Card.Hit') } : { hit: false, tone: 'bad', word: $l10n('SDM.Card.Miss') };
}

/* -------------------------------------------- */
/*  The area block (area first)                 */
/* -------------------------------------------- */

/**
 * What an area card keeps (flags.sdm.areaCard): the item, the placed area, who is inside, the roll,
 * and for an area resolved by a save, its save and each one's result.
 * mode: 'attack' (the attack against each defense, or their saves), 'power' (everyone inside gets the
 * roll) or 'use' (an item's Use resolved by a save: its harm, by each one's save).
 */
export function areaState({ mode, actor, item, kind, placed, total = 0, isNat1 = false, isNat20 = false, attackTarget = 'physical', multiplier = '' }) {
  const area = itemArea(item, kind);
  return {
    mode,
    actor: actor?.uuid ?? '',
    itemId: item.id,
    itemName: item.name,
    kind: kind || (mode === 'attack' ? 'weapon' : mode === 'power' ? 'power' : ''),
    chips: [areaLabel(item, kind), lingerLabel(item, kind)].filter(Boolean),
    save: area?.save ?? null,
    saves: {},
    lingers: !!area?.linger,
    sceneId: canvas.scene?.id ?? '',
    areaId: placed.areaId,
    inside: placed.tokens.map(t => t.uuid),
    outOfRange: placed.outOfRange ?? '',
    total: Number(total) || 0,
    isNat1: !!isNat1,
    isNat20: !!isNat20,
    attackTarget: attackTarget || 'physical',
    multiplier: multiplier || ''
  };
}

/**
 * The area's part of a card: who is inside and what happened to each (hit / miss, or their save),
 * with the damage button (attack) or each one's share (power), Target, Reposition and Remove.
 * @returns {{html: string, card: object, attackItem: object|null, hits: TokenDocument[]}}
 */
export function areaBlock(state) {
  const tokens = (state.inside ?? []).map(uuid => fromUuidSync(uuid)).filter(t => t?.actor);
  const total = Number(state.total) || 0;
  const rows = [];
  const hits = [];
  const ties = [];
  let attackItem = null;
  let actions = '';
  const chips = [...(state.chips ?? [])];
  if (state.mode === 'attack' && !state.save) chips.push($fmt('SDM.AreaAttackTotal', { total }));
  if (state.save) chips.push($fmt('SDM.AreaSaveChip', { pass: $l10n(CONFIG.SDM.areaSavePass[state.save.pass] ?? 'SDM.AreaSavePass.avoid').toLowerCase() }));
  if (chips.length) rows.push(`<div class="sdm-card-chips">${chips.map(c => `<span class="sdm-chip">${esc(c)}</span>`).join('')}</div>`);
  if (state.outOfRange) rows.push(`<div class="sdm-card-tag warn">${esc(state.outOfRange)}</div>`);
  const targetLabel = state.mode === 'attack' && !state.save ? 'SDM.AreaTargetHits' : 'SDM.AreaTargetInside';

  if (state.save) {
    // Resolved by a save: each one inside saves (NPCs at once, characters on their request card)
    const saves = state.saves ?? {};
    const savedActors = [];
    for (const token of tokens) {
      const result = saves[token.uuid];
      const word =
        result === true
          ? $l10n(`SDM.AreaSaveResult.${state.save.pass}`)
          : result === false
            ? $l10n('SDM.AreaSaveResult.failed')
            : result === 'equal'
              ? $l10n('SDM.AreaSaveResult.equal')
              : $l10n('SDM.AreaSaveResult.pending');
      if (result === true) savedActors.push(token.actor.uuid);
      rows.push(
        resultStrip({
          tone: result === true ? 'good' : result === false ? 'bad' : 'mid',
          img: token.texture?.src || token.actor.img,
          name: token.name,
          sub: esc(saveDifficultyLabel(state.save.difficulty) || $l10n('SDM.AreaSaveStandard')),
          outcome: word.toUpperCase()
        })
      );
      hits.push(token);
    }
    if (!tokens.length) rows.push(`<div class="sdm-card-tag info">${esc($l10n('SDM.AreaEmpty'))}</div>`);
    const targets = [...new Set(tokens.map(t => t.actor))];
    if (state.mode === 'attack') {
      attackItem = {
        id: state.itemId,
        name: state.itemName,
        kind: state.kind || 'weapon',
        actor: state.actor,
        multiplier: state.multiplier || '',
        areaTargets: targets.map(a => a.uuid),
        areaSaved: savedActors,
        areaPass: state.save.pass
      };
      if (targets.length) actions += attackFollowupHtml(attackItem);
    } else if (total > 0 && targets.length) {
      rows.push(areaApplyButtonsHtml(areaShares(targets, total, { saved: savedActors, pass: state.save.pass }), { heal: state.mode === 'power', total }));
    }
  } else if (state.mode === 'attack') {
    // The attack against each defense inside
    for (const token of tokens) {
      const target = token.actor;
      const field = target.type === ActorType.NPC ? 'defense' : DEFENSE_FIELD[state.attackTarget] ?? 'defense';
      const defense = Number(target.system?.[field]) || 0;
      const result = outcomeFor(total, defense, state.isNat1, state.isNat20);
      if (result.hit) hits.push(token);
      rows.push(
        resultStrip({
          tone: result.tone,
          img: token.texture?.src || target.img,
          name: token.name,
          sub: `${esc($l10n('SDM.FieldDefense'))} ${defense}`,
          outcome: result.word.toUpperCase(),
          margin: result.tone === 'good' || (result.tone === 'bad' && !state.isNat1) ? marginText(total - defense) : ''
        })
      );
      // Bystander: less damage from areas, by its level (taken off when the damage is applied)
      const reduction = areaDamageReduction(target);
      if (reduction && result.hit) rows.push(`<div class="sdm-card-tag info">${esc($fmt('SDM.AreaBystander', { name: token.name, amount: reduction }))}</div>`);
      // A tie: sacrifice something to hit it, or miss (the Referee decides)
      if (result.tone === 'mid') {
        ties.push(token.uuid);
        rows.push(tieButtons({ kind: 'area', tokenUuid: token.uuid, actorUuid: target.uuid, name: token.name }));
      }
    }
    if (!tokens.length) rows.push(`<div class="sdm-card-tag info">${esc($l10n('SDM.AreaEmpty'))}</div>`);
    attackItem = {
      id: state.itemId,
      name: state.itemName,
      kind: state.kind || 'weapon',
      actor: state.actor,
      multiplier: state.multiplier || '',
      areaTargets: hits.map(t => t.actor.uuid)
    };
    if (hits.length) actions += attackFollowupHtml(attackItem);
  } else {
    // A power: everyone inside, each with its share of the roll
    hits.push(...tokens);
    const names = tokens.map(t => esc(t.name)).join(', ');
    rows.push(
      names
        ? `<div class="sdm-card-tag info">${esc($l10n('SDM.AreaInside'))}: ${names}</div>`
        : `<div class="sdm-card-tag info">${esc($l10n('SDM.AreaEmpty'))}</div>`
    );
    const targets = [...new Set(tokens.map(t => t.actor))];
    if (total > 0 && targets.length) rows.push(areaApplyButtonsHtml(areaShares(targets, total), { heal: true, total }));
  }

  actions +=
    `<button type="button" data-action="sdmAreaTargetHits"><i class="fa-solid fa-crosshairs"></i> ${esc($l10n(targetLabel))}</button>` +
    `<button type="button" data-action="sdmAreaReposition"><i class="fa-solid fa-arrows-up-down-left-right"></i> ${esc($l10n('SDM.AreaReposition'))}</button>` +
    `<button type="button" data-action="sdmAreaRemove"><i class="fa-solid fa-eraser"></i> ${esc($l10n('SDM.AreaRemove'))}</button>`;
  const card = { ...state, hits: hits.map(t => t.uuid), ties };
  const html = `<div class="sdm-area-block">${rows.join('')}<div class="sdm-card-actions">${actions}</div></div>`;
  return { html, card, attackItem, hits };
}

/** The flags a card with an area block keeps. */
function blockFlags(block) {
  return { 'flags.sdm.areaCard': block.card, ...(block.attackItem ? { 'flags.sdm.attackItem': block.attackItem } : {}) };
}

/** Put a new area block in the message's place of the old one. */
async function replaceBlock(message, block) {
  const div = document.createElement('div');
  div.innerHTML = message.content;
  const old = div.querySelector('.sdm-area-block');
  if (old) old.outerHTML = block.html;
  await message.update({ content: div.innerHTML, ...blockFlags(block) });
}

/**
 * "Place area" on a card whose area wasn't placed before the roll (skipped, or no scene then): a card
 * of its own with the area block, for the attack (mode 'attack') or the power ('power').
 */
async function onPlaceAreaFromCard(button, mode) {
  const actor = fromUuidSync(button.dataset.actorUuid);
  const item = actor?.items?.get(button.dataset.itemId);
  if (!actor?.isOwner || !item) return;
  const kind = button.dataset.kind || (mode === 'attack' ? 'weapon' : 'power');
  const placed = await placeArea({ actor, item, kind });
  if (!placed) return;
  const block = areaBlock(
    areaState({
      mode,
      actor,
      item,
      kind,
      placed,
      total: Number(button.dataset.total) || 0,
      isNat1: button.dataset.nat1 === '1',
      isNat20: button.dataset.nat20 === '1',
      attackTarget: button.dataset.attackTarget || 'physical',
      multiplier: button.dataset.multiplier || ''
    })
  );
  setTargets(block.hits);
  const message = await createChatMessage({
    actor,
    content: cardWrap(cardHeader({ icon: 'fa-solid fa-bullseye', title: item.name }) + block.html, { kind: mode === 'attack' ? 'attack' : 'power' }),
    flags: { sdm: { areaCard: block.card, ...(block.attackItem ? { attackItem: block.attackItem } : {}) } }
  });
  if (block.card.save && message) await requestAreaSaves(message);
}

/** Reposition: the area is placed again (the old one goes), and the card checks who is inside now. */
async function onReposition(message, card) {
  const actor = fromUuidSync(card.actor);
  const item = actor?.items?.get(card.itemId);
  if (!actor || !item) return;
  if (canvas.scene?.id !== card.sceneId) return ui.notifications.warn($l10n('SDM.AreaNoScene'));
  const placed = await placeArea({ actor, item, kind: card.kind });
  if (!placed) return;
  await removeArea(card.sceneId, card.areaId);
  const block = areaBlock({
    ...card,
    saves: {},
    areaId: placed.areaId,
    sceneId: canvas.scene.id,
    inside: placed.tokens.map(t => t.uuid),
    outOfRange: placed.outOfRange ?? ''
  });
  setTargets(block.hits);
  await replaceBlock(message, block);
  // A save area: everyone inside now saves (again)
  if (block.card.save) await requestAreaSaves(game.messages.get(message.id));
}

/* -------------------------------------------- */
/*  Saves                                       */
/* -------------------------------------------- */

/** A save area: everyone inside is asked for the save (NPCs roll at once, characters get a request). */
export async function requestAreaSaves(message) {
  const card = message?.getFlag?.('sdm', 'areaCard');
  if (!card?.save) return;
  const { saveAgainst } = await import('../app/save-against.mjs');
  for (const uuid of card.inside ?? []) {
    const token = fromUuidSync(uuid);
    if (!token?.actor) continue;
    await saveAgainst(token.actor, {
      area: { message: message.id, token: uuid },
      source: card.itemName,
      ability: card.save.ability || '',
      difficulty: card.save.difficulty || ''
    });
  }
}

/** A save made for an area (true, false or 'equal'): the area card is told (by the Referee's game). */
export async function reportAreaSave(area, result) {
  if (!area?.message || !area?.token) return;
  if (game.user.isGM) return applyAreaSave(area, result);
  if (!game.users.activeGM) return ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
  game.socket.emit(CHANNEL, { action: SAVE_ACTION, area, result });
}

/**
 * The Referee's game records a save on the area card and gives its effects: a failed save gets the
 * item's effects, a passed one none (or for 1 round when the passed save only shortens them). A
 * lingering area gives its effects by itself, so none are given here.
 */
async function applyAreaSave(area, result) {
  const message = game.messages.get(area.message);
  const card = foundry.utils.deepClone(message?.getFlag('sdm', 'areaCard') ?? null);
  if (!message || !card?.save) return;
  // A save for an area placed before a reposition: no longer counts
  if (!(card.inside ?? []).includes(area.token)) return;
  card.saves = { ...(card.saves ?? {}), [area.token]: result };
  const actor = fromUuidSync(area.token)?.actor;
  const item = fromUuidSync(card.actor)?.items?.get(card.itemId);
  if (actor && item && !card.lingers && result !== 'equal') {
    // What it gave before goes (hero dice may have changed the result), then what the result gives
    const key = `${message.id}|${area.token}`;
    const old = actor.effects.filter(e => e.getFlag('sdm', 'areaSave') === key).map(e => e.id);
    if (old.length) await actor.deleteEmbeddedDocuments('ActiveEffect', old);
    const shorter = result === true && card.save.pass === 'shorter';
    if (result === false || shorter) {
      const data = lingerEffects(item).map(effect => {
        const copy = effect.toObject();
        delete copy._id;
        copy.origin = item.uuid;
        copy.transfer = false;
        copy.disabled = false;
        foundry.utils.setProperty(copy, 'flags.sdm.temporary', true);
        foundry.utils.setProperty(copy, 'flags.sdm.areaSave', key);
        if (shorter) copy.duration = { ...(copy.duration ?? {}), value: 1, units: 'rounds' };
        return copy;
      });
      if (data.length) await actor.createEmbeddedDocuments('ActiveEffect', data);
    }
  }
  await replaceBlock(message, areaBlock(card));
}

/* -------------------------------------------- */
/*  Chat and socket                             */
/* -------------------------------------------- */

/** renderChatMessageHTML: Place area, ties, and the area block's Target, Reposition and Remove. */
export function bindAreaButtons(message, html) {
  html.querySelectorAll('[data-action="sdmPlaceArea"]').forEach(button =>
    button.addEventListener('click', event => {
      event.preventDefault();
      onPlaceAreaFromCard(button, 'attack');
    })
  );
  html.querySelectorAll('[data-action="sdmPlacePowerArea"]').forEach(button =>
    button.addEventListener('click', event => {
      event.preventDefault();
      onPlaceAreaFromCard(button, 'power');
    })
  );
  // Ties (area card, splash): only the Referee decides
  html.querySelectorAll('[data-action="sdmTieSacrifice"]').forEach(button => {
    if (!game.user.isGM) return button.remove();
    button.addEventListener('click', event => {
      event.preventDefault();
      button.disabled = true;
      onTieSacrifice(message, button).catch(error => console.error('SDM | Tie failed', error));
    });
  });
  const card = message?.getFlag?.('sdm', 'areaCard');
  if (!card) return;
  const allowed = game.user.isGM || message.isAuthor;
  html.querySelectorAll('[data-action="sdmAreaTargetHits"]').forEach(button =>
    button.addEventListener('click', event => {
      event.preventDefault();
      const tokens = (card.hits ?? []).map(uuid => fromUuidSync(uuid)).filter(t => t?.parent === canvas.scene);
      setTargets(tokens);
    })
  );
  html.querySelectorAll('[data-action="sdmAreaReposition"]').forEach(button => {
    // Only the card's own (the newest card of a hero dice chain carries it too)
    if (!allowed || !card.itemId) return button.remove();
    button.addEventListener('click', event => {
      event.preventDefault();
      onReposition(message, card).catch(error => console.error('SDM | Reposition failed', error));
    });
  });
  html.querySelectorAll('[data-action="sdmAreaRemove"]').forEach(button => {
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
    if (message?.action === SAVE_ACTION) return applyAreaSave(message.area, message.result);
    const scene = game.scenes.get(message?.sceneId);
    if (!scene) return;
    if (message.action === CREATE_ACTION) await scene.createEmbeddedDocuments('Region', [message.data]);
    if (message.action === REMOVE_ACTION) {
      const region = scene.regions.find(r => r.getFlag('sdm', AREA_FLAG)?.id === message.areaId);
      await region?.delete();
    }
  });
}

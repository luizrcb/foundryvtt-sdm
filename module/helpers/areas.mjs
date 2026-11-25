import { ActorType } from './constants.mjs';
import { $fmt, $l10n } from './globalUtils.mjs';
import { cardHeader, cardWrap, marginText, resultStrip } from '../rolls/ui/cardParts.mjs';
import { createChatMessage } from './chatUtils.mjs';
import { saveDifficultyLabel, saveDifficultyValue } from '../app/save-against.mjs';
import { attackFollowupHtml, powerWithoutRoll } from '../rolls/attackFollowup.mjs';
import { getItemIdentifier, resolveFormulaReferences } from './effectReferences.mjs';
import { buildChanges, getLightPreset, lightConfig } from './lights.mjs';
import { bandForMeters, metersForWorldUnits, metersPerUnit, sceneUnitsForMeters, sceneZoneLimits, worldUnit, worldUnitsForMeters, ZONE_BANDS } from './zones.mjs';
import { deleteEffects } from './deleteEffects.mjs';

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
const HAZARD_ACTION = 'hazardSave';
const AREA_FLAG = 'area';

/**
 * Sizes in standard squares (1.5 m / 5 ft): the book's area table mixed with the d20 grid rules,
 * checked against the book's numbers of targets (a few / some / many). Circles and squares by the
 * squares across (2 / 6 / 10: ~3 / 9 / 15 m, on an intersection; 4 / 32 / 80 squares); rings by the squares across,
 * centered on a square (3 / 7 / 13: around one creature, a small group, a crowd), a wall one square thick; cones by length (3 / 6 / 11: 7 / 24 /
 * 71 squares straight, about as wide as they are far); lines by length, one square wide (4 / 12 /
 * 24). Vehicle weapons: circles ~10 / 50 / 150 m across, rings three times and cones and lines five times
 * as long. Other
 * grid scales convert by meters, so the area keeps its size.
 */
const SQUARE_METERS = 1.5;
const AREA_SQUARES = {
  foot: {
    across: { small: 2, medium: 6, large: 10 },
    ring: { small: 3, medium: 7, large: 13 },
    cone: { small: 3, medium: 6, large: 11 },
    line: { small: 4, medium: 12, large: 24 }
  },
  vehicle: {
    across: { small: 6, medium: 34, large: 100 },
    ring: { small: 9, medium: 21, large: 39 },
    cone: { small: 15, medium: 30, large: 55 },
    line: { small: 20, medium: 60, large: 120 }
  }
};
const CONE_ANGLE = 60; // degrees: the guide while placing, and the cone on gridless and hex scenes
const LINE_WIDTH_METERS = SQUARE_METERS;
const AREA_SIZES = ['small', 'medium', 'large'];
const isAreaSize = size => AREA_SIZES.includes(size);
/** A line's width or a ring's wall, in meters (0: one square), from a value in the world unit. */
const areaWidth = value => (Number(value) > 0 ? metersForWorldUnits(Number(value)) : 0);

/**
 * An area's size: meters (across, or length for cones and lines), the cone's angle, and the distance
 * shown on its label (the world unit). Across (in the world unit) replaces the size's length.
 */
function areaSize(size, shape, { vehicle = false, across = 0 } = {}) {
  const table = AREA_SQUARES[vehicle ? 'vehicle' : 'foot'];
  const squares = (table[shape] ?? table.across)[size] ?? table.across.small;
  const angle = shape === 'cone' ? CONE_ANGLE : null;
  if (Number(across) > 0) return { meters: metersForWorldUnits(across), angle, distance: Number(across) };
  const distance = worldUnit() === 'ft' ? squares * 5 : worldUnit() === 'm' ? squares * SQUARE_METERS : worldUnitsForMeters(squares * SQUARE_METERS);
  return { meters: squares * SQUARE_METERS, angle, distance };
}

const esc = text => foundry.utils.escapeHTML(String(text ?? ''));

/** An area resolved by a save: its ability (blank: the one saving picks), difficulty and what a passed save does. */
function areaSave(ability, difficulty, target, pass) {
  return { ability: ability || '', difficulty: saveDifficultyValue(difficulty || '', target), pass: pass || 'avoid' };
}

/** A lingering area's damage each round (and on entering) and its condition, or null when it has none. */
function areaRound(damage, formula, enter, condition, conditionRounds) {
  const hasDamage = damage === 'item' || (damage === 'formula' && `${formula ?? ''}`.trim());
  const hasCondition = !!condition && CONFIG.statusEffects.some(s => s.id === condition);
  if (!hasDamage && !hasCondition) return null;
  return {
    damage: hasDamage ? damage : 'none',
    formula: damage === 'formula' ? `${formula}`.trim() : '',
    enter: !!enter,
    condition: hasCondition ? condition : '',
    conditionRounds: Math.max(Number(conditionRounds) || 0, 0)
  };
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
export function itemArea(item, kind = '', { overcharged = false } = {}) {
  const power = areaPower(item, kind);
  if (power?.area && isAreaSize(power.area)) {
    const shape = power.area_shape || 'circle';
    // Overcharged: its bigger area, when it has one (a size, its own across, or both)
    const bigger = overcharged && ((power.area_overcharge && isAreaSize(power.area_overcharge)) || Number(power.area_overcharge_across) > 0);
    const size = bigger && power.area_overcharge && isAreaSize(power.area_overcharge) ? power.area_overcharge : power.area;
    const across = bigger ? (Number(power.area_overcharge_across) > 0 ? power.area_overcharge_across : power.area_overcharge ? 0 : power.area_across) : power.area_across;
    return {
      ...areaSize(size, shape, { across }),
      size,
      overcharged: !!bigger,
      shape,
      width: areaWidth(power.area_width),
      affects: power.area_affects || 'everyone',
      linger: kind !== 'album' && !!power.area_linger,
      rounds: Number(power.area_rounds) || 0,
      follows: !!power.area_follows,
      light: power.area_light || 'none',
      round: areaRound(power.area_round_damage, power.area_round_formula, power.area_round_enter, power.area_round_condition, power.area_round_condition_rounds),
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
    width: areaWidth(item.system.area.width),
    affects: item.system.area.affects || 'everyone',
    linger: !!item.system.area.linger,
    rounds: Number(item.system.area.rounds) || 0,
    follows: !!item.system.area.follows,
    light: item.system.area.light || 'none',
    round: areaRound(
      item.system.area.round_damage,
      item.system.area.round_formula,
      item.system.area.round_enter,
      item.system.area.round_condition,
      item.system.area.round_condition_rounds
    ),
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
function lingerLabel(item, kind, options = {}) {
  const area = itemArea(item, kind, options);
  if (!area?.linger || !(lingerEffects(item).length || area.round)) return '';
  return area.rounds > 0 ? $fmt('SDM.AreaLingersRounds', { rounds: area.rounds }) : $l10n('SDM.AreaLingers');
}

/** "small circle (~10 ft)" in the world unit. */
export function areaLabel(item, kind = '', options = {}) {
  const area = itemArea(item, kind, options);
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

/** A line's width or a ring's wall in the scene's squares (at least one). */
const widthSquares = (area, scene) => (area?.width > 0 ? Math.max(1, Math.round(area.width / metersPerSquare(scene))) : 1);

/** A size in the scene's squares (even for areas centered on an intersection, odd for those on a square). */
function squaresOf(meters, scene, { even = false, odd = false } = {}) {
  const squares = meters / metersPerSquare(scene);
  if (even) return Math.max(2, Math.round(squares / 2) * 2);
  if (odd) return Math.max(3, 2 * Math.round((squares - 1) / 2) + 1);
  return Math.max(1, Math.round(squares));
}

/**
 * A ring's wall closed at its diagonals: where two of its squares touch only by a corner, the square
 * farther from the middle joins them (nobody slips through).
 */
function closeRing(squares, center, size) {
  const keys = new Set(squares.map(squareKey));
  const added = [];
  const distance = ({ i, j }) => Math.hypot((j + 0.5) * size - center.x, (i + 0.5) * size - center.y);
  for (const { i, j } of squares) {
    for (const [di, dj] of [[1, 1], [1, -1]]) {
      if (!keys.has(`${i + di}.${j + dj}`) || keys.has(`${i + di}.${j}`) || keys.has(`${i}.${j + dj}`)) continue;
      const a = { i: i + di, j };
      const b = { i, j: j + dj };
      const pick = distance(a) >= distance(b) ? a : b;
      keys.add(squareKey(pick));
      added.push(pick);
    }
  }
  return [...squares, ...added];
}

/** The squares (offsets {i, j}) a region covers more than half of (or the middle of), less the excluded ones. */
function coveredSquares(region, scene, exclude = new Set()) {
  const size = scene.grid.size;
  const bounds = region.bounds;
  const squares = [];
  if (!bounds) return squares;
  const i0 = Math.floor(bounds.y / size);
  const i1 = Math.ceil((bounds.y + bounds.height) / size);
  const j0 = Math.floor(bounds.x / size);
  const j1 = Math.ceil((bounds.x + bounds.width) / size);
  const tree = region.polygonTree;
  const samples = SAMPLES;
  for (let i = i0; i < i1; i++) {
    for (let j = j0; j < j1; j++) {
      if (exclude.has(`${i}.${j}`)) continue;
      let inside = 0;
      for (let a = 0; a < samples; a++) {
        for (let b = 0; b < samples; b++) {
          if (tree.testPoint({ x: (j + (b + 0.5) / samples) * size, y: (i + (a + 0.5) / samples) * size })) inside++;
        }
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

/**
 * Line of effect: an area doesn't go through walls. A point is reached when nothing blocking movement
 * (walls, closed doors) stands between the area's origin (its middle; a cone's or line's point on the
 * user's token; the token for "around the user") and it.
 */
function reaches(origin) {
  const backend = CONFIG.Canvas.polygonBackends?.move;
  if (!origin || !backend?.testCollision) return () => true;
  const level = canvas.level ?? undefined;
  return point => !backend.testCollision(origin, point, { type: 'move', mode: 'any', ...(level ? { level } : {}) });
}

/** The squares the area reaches from its origin (line of effect). */
function reachedSquares(squares, origin, size) {
  const clear = reaches(origin);
  return squares.filter(({ i, j }) => clear({ x: (j + 0.5) * size, y: (i + 0.5) * size }));
}

/** The squares a token stands on. */
const tokenSquares = token => token.getOccupiedGridSpaceOffsets?.() ?? [];

/** Tokens on any of the squares. */
function tokensOnSquares(squares, candidates) {
  const keys = new Set(squares.map(squareKey));
  return candidates.filter(token => tokenSquares(token).some(offset => keys.has(squareKey(offset))));
}

/** A cone or line on gridless and hex scenes: from the token's middle toward a point. */
function aimShape(token, toward) {
  const origin = tokenCenter(token);
  if (Math.hypot(toward.x - origin.x, toward.y - origin.y) < 1) return null;
  return { x: origin.x, y: origin.y, rotation: Math.toDegrees(Math.atan2(toward.y - origin.y, toward.x - origin.x)) };
}

const DIRECTIONS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/**
 * Where a cone or line points (square grids): one of eight directions, the nearest to the point, from
 * the middle of the token's side (straight: the row or column of the token nearest the point) or its
 * corner (diagonal).
 */
function patternFrame(token, point) {
  const size = token.parent.grid.size;
  const ti = Math.round(token.y / size);
  const tj = Math.round(token.x / size);
  const w = Math.max(1, Math.round(token.width));
  const h = Math.max(1, Math.round(token.height));
  const center = tokenCenter(token);
  const index = (((Math.round(Math.atan2(point.y - center.y, point.x - center.x) / (Math.PI / 4)) % 8) + 8) % 8);
  const [dx, dy] = DIRECTIONS[index];
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const axis = dx && dy ? null : dx ? clamp(Math.floor(point.y / size), ti, ti + h - 1) : clamp(Math.floor(point.x / size), tj, tj + w - 1);
  let origin;
  if (dx && dy) origin = { x: (dx > 0 ? tj + w : tj) * size, y: (dy > 0 ? ti + h : ti) * size };
  else if (dx) origin = { x: (dx > 0 ? tj + w : tj) * size, y: (axis + 0.5) * size };
  else origin = { x: (axis + 0.5) * size, y: (dy > 0 ? ti + h : ti) * size };
  return { ti, tj, w, h, dx, dy, axis, origin, rotation: index * 45 };
}

/**
 * Cones and lines on square grids are fixed patterns (the d20 way): a straight line is one row of
 * squares and a diagonal one a staircase; a straight cone is as wide as it is far, symmetric (rows of
 * 1, 3, 3, 5, 5, 7…); a diagonal cone fans out from the corner, the squares within 30° of the
 * diagonal and its length.
 */
/**
 * How many squares a line of `length` squares covers on a perfect diagonal: as many diagonal steps as
 * fit in its length by the world's Grid Diagonals rule (equidistant: all of them; exact: ÷ √2;
 * alternating 1/2: about two thirds…), the same count as Foundry's ruler and movement.
 */
function diagonalLineSteps(scene, length) {
  const grid = scene.grid;
  const limit = length * (Number(grid.distance) || 1) + 1e-6;
  let steps = 0;
  for (let k = 1; k <= length; k++) {
    let distance;
    try {
      distance = grid.measurePath([{ i: 0, j: 0 }, { i: k, j: k }]).distance;
    } catch {
      return length;
    }
    if (!(distance <= limit)) break;
    steps = k;
  }
  return Math.max(steps, 1);
}

/**
 * The rows a band `width` squares wide takes around its middle row (offsets from it): centered when
 * odd; when even, one more on the side of `side` (negative: before the middle, positive: after).
 */
function bandOffsets(width, side) {
  const w = Math.max(1, Math.round(width));
  const start = w % 2 ? -(w - 1) / 2 : side < 0 ? -w / 2 : -(w / 2 - 1);
  return Array.from({ length: w }, (_, k) => start + k);
}

function patternSquares(token, point, shape, length, width = 1) {
  const { ti, tj, w, h, dx, dy, axis, origin: edge } = patternFrame(token, point);
  const size = token.parent.grid.size;
  // Line of effect from just inside the token: a wall along its side blocks the pattern
  const center = tokenCenter(token);
  const nudge = 2 / Math.max(Math.hypot(center.x - edge.x, center.y - edge.y), 1);
  const origin = { x: edge.x + (center.x - edge.x) * nudge, y: edge.y + (center.y - edge.y) * nudge };
  const squares = [];
  if (!dx || !dy) {
    for (let k = 1; k <= length; k++) {
      const step = dx ? (dx > 0 ? tj + w - 1 + k : tj - k) : dy > 0 ? ti + h - 1 + k : ti - k;
      // A line: its width in rows (the cursor's side takes the extra row of an even width); a cone widens
      const offsets =
        shape === 'line'
          ? bandOffsets(width, dx ? point.y / size - (axis + 0.5) : point.x / size - (axis + 0.5))
          : Array.from({ length: 2 * Math.floor(k / 2) + 1 }, (_, n) => n - Math.floor(k / 2));
      for (const o of offsets) squares.push(dx ? { i: axis + o, j: step } : { i: step, j: axis + o });
    }
    return reachedSquares(squares, origin, size);
  }
  const i0 = dy > 0 ? ti + h : ti - 1;
  const j0 = dx > 0 ? tj + w : tj - 1;
  // A diagonal line: as many steps as its length allows by the Grid Diagonals rule
  const steps = shape === 'line' ? diagonalLineSteps(token.parent, length) : length;
  // A wider diagonal line: staircases side by side (a − b: which one), the extra one of an even width
  // on the cursor's side; each as long as the line
  // (a counts along x, b along y from the token's corner: a − b > 0 lies on the x side of the diagonal)
  const cursorSide = dx * (point.x - edge.x) - dy * (point.y - edge.y);
  const bands = shape === 'line' ? bandOffsets(width, cursorSide) : [0];
  const extent = length + Math.max(...bands.map(Math.abs));
  for (let a = 0; a < extent; a++) {
    for (let b = 0; b < extent; b++) {
      const inside =
        shape === 'line'
          ? bands.includes(a - b) && a + b < 2 * steps
          : Math.abs(Math.toDegrees(Math.atan2(b + 0.5, a + 0.5)) - 45) <= CONE_ANGLE / 2 + 1e-6 && Math.hypot(a + 0.5, b + 0.5) <= length;
      if (inside) squares.push({ i: i0 + dy * b, j: j0 + dx * a });
    }
  }
  return reachedSquares(squares, origin, size);
}

/**
 * A free cone or line (square grids, Shift): from where the aim leaves the user's token toward the
 * point, at any angle. Returns { origin, angle (radians), rotation (degrees) }, or null on the token.
 */
function freeFrame(token, point) {
  const size = token.parent.grid.size;
  const center = tokenCenter(token);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  if (Math.hypot(dx, dy) < 1) return null;
  const halfW = (Math.max(1, token.width) * size) / 2;
  const halfH = (Math.max(1, token.height) * size) / 2;
  // How far along the aim the token's edge is
  const t = Math.min(dx ? halfW / Math.abs(dx) : Infinity, dy ? halfH / Math.abs(dy) : Infinity);
  const angle = Math.atan2(dy, dx);
  return { origin: { x: center.x + dx * t, y: center.y + dy * t }, angle, rotation: Math.toDegrees(angle) };
}

/**
 * The squares a free cone or line covers. A cone: more than half of a square, or its middle (as
 * circles and squares). A line: every square its middle passes through, but not one it only grazes
 * at a corner (so a diagonal line is a clean staircase at any angle).
 */
function freeSquares(token, point, shape, length, width = 1) {
  const frame = freeFrame(token, point);
  if (!frame) return [];
  const size = token.parent.grid.size;
  const { origin, angle } = frame;
  const reach = length * size;
  // A line ends where its length does by the world's Grid Diagonals rule (as Foundry's ruler and the
  // lines aimed without Shift); a cone keeps its true distance
  const grid = token.parent.grid;
  const end =
    shape === 'line'
      ? grid.getTranslatedPoint(origin, Math.toDegrees(angle), length * (Number(grid.distance) || 1))
      : { x: origin.x + Math.cos(angle) * reach, y: origin.y + Math.sin(angle) * reach };
  const i0 = Math.floor((Math.min(origin.y, end.y) - reach) / size);
  const i1 = Math.ceil((Math.max(origin.y, end.y) + reach) / size);
  const j0 = Math.floor((Math.min(origin.x, end.x) - reach) / size);
  const j1 = Math.ceil((Math.max(origin.x, end.x) + reach) / size);
  const center = tokenCenter(token);
  const onToken = (i, j) => {
    const ti = Math.round(token.y / size);
    const tj = Math.round(token.x / size);
    return i >= ti && i < ti + Math.max(1, Math.round(token.height)) && j >= tj && j < tj + Math.max(1, Math.round(token.width));
  };
  const squares = [];
  if (shape === 'line' && width > 1) {
    // A wider line: a band that many squares wide along the aim; the squares it covers more than half
    // of, or whose middle it covers (as circles)
    const lengthPx = Math.hypot(end.x - origin.x, end.y - origin.y);
    const ux = (end.x - origin.x) / (lengthPx || 1);
    const uy = (end.y - origin.y) / (lengthPx || 1);
    const half = (width * size) / 2;
    const inBand = p => {
      const t = (p.x - origin.x) * ux + (p.y - origin.y) * uy;
      const n = Math.abs(-(p.x - origin.x) * uy + (p.y - origin.y) * ux);
      return t >= 0 && t <= lengthPx && n <= half;
    };
    for (let i = i0 - width; i < i1 + width; i++) {
      for (let j = j0 - width; j < j1 + width; j++) {
        if (onToken(i, j)) continue;
        let inside = 0;
        for (let a = 0; a < SAMPLES; a++) {
          for (let b = 0; b < SAMPLES; b++) if (inBand({ x: (j + (b + 0.5) / SAMPLES) * size, y: (i + (a + 0.5) / SAMPLES) * size })) inside++;
        }
        if (inside * 2 > SAMPLES * SAMPLES || inBand({ x: (j + 0.5) * size, y: (i + 0.5) * size })) squares.push({ i, j });
      }
    }
  } else if (shape === 'line') {
    // Segment through the square's interior: clipped length more than a sliver
    const minLength = size * 0.05;
    for (let i = i0; i < i1; i++) {
      for (let j = j0; j < j1; j++) {
        if (onToken(i, j)) continue;
        if (clippedLength(origin, end, j * size, i * size, size) > minLength) squares.push({ i, j });
      }
    }
  } else {
    const half = Math.toRadians(CONE_ANGLE / 2);
    const inCone = p => {
      const d = Math.hypot(p.x - origin.x, p.y - origin.y);
      if (d > reach) return false;
      if (d < 1e-6) return true;
      let diff = Math.atan2(p.y - origin.y, p.x - origin.x) - angle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      return Math.abs(diff) <= half + 1e-9;
    };
    for (let i = i0; i < i1; i++) {
      for (let j = j0; j < j1; j++) {
        if (onToken(i, j)) continue;
        let inside = 0;
        for (let a = 0; a < SAMPLES; a++) {
          for (let b = 0; b < SAMPLES; b++) if (inCone({ x: (j + (b + 0.5) / SAMPLES) * size, y: (i + (a + 0.5) / SAMPLES) * size })) inside++;
        }
        if (inside * 2 > SAMPLES * SAMPLES || inCone({ x: (j + 0.5) * size, y: (i + 0.5) * size })) squares.push({ i, j });
      }
    }
  }
  // Line of effect from just inside the token
  const nudge = 2 / Math.max(Math.hypot(center.x - origin.x, center.y - origin.y), 1);
  const from = { x: origin.x + (center.x - origin.x) * nudge, y: origin.y + (center.y - origin.y) * nudge };
  return reachedSquares(squares, from, size);
}

/** Length of the segment a→b inside the square at (x, y) of side `size` (Liang–Barsky). */
function clippedLength(a, b, x, y, size) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of [[-dx, a.x - x], [dx, x + size - a.x], [-dy, a.y - y], [dy, y + size - a.y]]) {
    if (p === 0) {
      if (q < 0) return 0;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return 0;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return 0;
      if (r < t1) t1 = r;
    }
  }
  return Math.max(t1 - t0, 0) * Math.hypot(dx, dy);
}

/**
 * Point a cone or line (square grids) with Foundry's placement, so its outline and measurements show:
 * the guide turns to the nearest of eight directions around the token and the pattern's squares
 * light up; click places it, right-click or Esc cancels. Resolves to the squares, or false.
 */
async function placePattern({ data, token, shape, length, scene, width = 1 }) {
  const size = scene.grid.size;
  const color = data.color || (game.user.color ?? 0x33bbff);
  let last = canvas.mousePosition ?? tokenCenter(token);
  let free = false;
  const squaresNow = () => (free ? freeSquares(token, last, shape, length, width) : patternSquares(token, last, shape, length, width));
  const guide =
    shape === 'cone'
      ? { type: 'cone', x: 0, y: 0, radius: length * size, angle: CONE_ANGLE, rotation: 0, curvature: 'round', gridBased: false }
      : // A line's guide is measured by the grid (its Grid Diagonals rule): it ends where its squares do
        // and shows its full length (18 m on the diagonal too)
        { type: 'line', x: 0, y: 0, length: length * size, width: width * size, rotation: 0, gridBased: true };
  const onMove = ({ shape: current, position, snap }) => {
    last = position;
    // Shift (Foundry's "don't snap"): any angle, from where the aim leaves the token; otherwise the 8 directions
    free = snap === false;
    const frame = free ? freeFrame(token, last) : patternFrame(token, last);
    if (frame) current.updateSource({ x: frame.origin.x, y: frame.origin.y, rotation: frame.rotation });
    return false;
  };
  const onChange = () => previewSquares(squaresNow(), color);
  let placed;
  try {
    // The guide is drawn as its outline only: the squares lit up are the pattern's (what it hits), not
    // Foundry's coverage of the guide (a grid-measured line would light a band three squares wide)
    placed = await canvas.regions.placeRegion({ ...data, highlightMode: 'shapes', shapes: [guide] }, { create: false, onMove, onChange, allowRotation: false });
  } finally {
    clearPreview();
  }
  if (!placed) return false;
  return squaresNow();
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

/** A splash's squares shown on the map while its result is confirmed, and cleared after. */
export function showSplashPreview(squares) {
  if (squares?.length) previewSquares(squares, game.user.color?.css ?? '#ff6400');
}
export const clearSplashPreview = clearPreview;

/* -------------------------------------------- */
/*  Placing                                     */
/* -------------------------------------------- */

/** The region shape of the area (Foundry v14 shapes: circle, cone, line, rectangle, ring, emanation). */
function areaShape(area, scene, origin, token = null) {
  const squares = squareGrid(scene);
  // On square grids the area is counted in squares (see coveredSquares), so the shape is exact
  const gridBased = !squares;
  // Circles and squares are centered on an intersection (even sizes), rings on a square (odd sizes)
  const ring = area.shape === 'ring';
  const centered = !['cone', 'line', 'ring'].includes(area.shape);
  const across = squares ? squaresOf(area.meters, scene, { even: centered, odd: ring }) * scene.grid.size : area.meters * pixelsPerMeter(scene);
  // A line's width, a ring's wall: one square unless the area has its own
  const width = squares ? widthSquares(area, scene) * scene.grid.size : (area.width > 0 ? area.width : LINE_WIDTH_METERS) * pixelsPerMeter(scene);
  switch (area.shape) {
    case 'cone':
      return { type: 'cone', x: origin.x, y: origin.y, radius: across, angle: area.angle ?? CONE_ANGLE, rotation: 0, curvature: 'round', gridBased };
    case 'line':
      return { type: 'line', x: origin.x, y: origin.y, length: across, width, rotation: 0, gridBased };
    case 'square':
      return { type: 'rectangle', x: 0, y: 0, width: across, height: across, anchorX: 0.5, anchorY: 0.5, rotation: 0, gridBased };
    case 'ring': {
      // A wall around a point, one square thick unless it has its own: its outer edge makes the size
      // across (on square grids the outer squares' outer side), and it grows inward
      const outer = squares ? across / 2 : across / 2 + (LINE_WIDTH_METERS * pixelsPerMeter(scene)) / 2;
      const wall = Math.min(width, outer);
      return { type: 'ring', x: 0, y: 0, radius: outer - wall / 2, innerWidth: wall / 2, outerWidth: wall / 2, gridBased };
    }
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
 * On square grids circles and squares snap to intersections and rings to the middle of a square
 * (always), showing the squares they cover; cones and lines are fixed patterns pointed around the
 * user's token. Without an item (area: drawn from the scene controls) it only draws the area.
 * @returns {Promise<{areaId, tokens: TokenDocument[]}|false|null>} false when the user cancelled
 *   (right-click or Esc), null when it can't be placed (no scene, no token for a cone).
 */
export async function placeArea({ actor = null, item = null, kind = '', area: given = null, token = null, name = '', hazard: givenHazard = null, color: givenColor = '', overcharged = false }) {
  const area = given ?? itemArea(item, kind, { overcharged });
  const scene = canvas?.scene;
  if (!area || !scene || !canvas.ready) {
    if (area) ui.notifications.warn($l10n('SDM.AreaNoScene'));
    return null;
  }
  const free = !item;
  // Cones and lines start at the user's token; an emanation surrounds it
  const fromToken = area.shape === 'cone' || area.shape === 'line' || area.shape === 'emanation';
  const sourceToken = token ?? actor?.getActiveTokens?.(false, true)?.find(t => t.parent === scene) ?? null;
  if (fromToken && !sourceToken) {
    ui.notifications.warn(free ? $l10n('SDM.AreaDrawNeedsToken') : $fmt('SDM.AreaNeedsToken', { name: actor?.name ?? '' }));
    return null;
  }
  const origin = sourceToken ? tokenCenter(sourceToken) : { x: 0, y: 0 };
  const areaId = foundry.utils.randomID();
  const data = {
    name: item?.name ?? name,
    // Its color: the one picked in Draw an area, else the user's
    color: givenColor || game.user.color?.css,
    shapes: [areaShape(area, scene, origin, sourceToken)],
    restriction: { enabled: false },
    visibility: CONST.REGION_VISIBILITY.ALWAYS,
    highlightMode: 'coverage',
    displayMeasurements: true,
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE, [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
    flags: { sdm: { [AREA_FLAG]: { id: areaId, item: item?.uuid ?? '', actor: actor?.uuid ?? '', user: game.user.id, ...(free ? { free: true } : {}) } } }
  };
  // Lingering: whoever stands in it has the item's effects (helpers/auras.mjs keeps them), for some rounds
  const effects = item && area.linger ? lingerEffects(item) : [];
  // …and damage and conditions each round (and on entering): a hazard on its region
  // (a drawn area: the hazard set in the dialog)
  const hazard = givenHazard ?? (item && area.linger ? areaHazard(area, item, kind, sourceToken, actor) : null);
  // …and light while it lasts (the Referee's game makes it, see setupAreas)
  const light = item && area.linger && area.light && area.light !== 'none' ? areaLightData(area, item, actor) : null;
  if (light) data.flags.sdm[AREA_FLAG].light = light;
  if (effects.length || (hazard && !givenHazard) || light) {
    // The combat on this scene (linked to it, or with combatants here)
    const combat = game.combats.find(c => c.started && (c.scene?.id === scene.id || c.combatants.some(cb => cb.sceneId === scene.id))) ?? null;
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
  const finish = (placed, squares = null) => finishPlacement({ area, scene, placed, sourceToken, fromToken, origin, areaId, squares, free, hazard });

  // An emanation needs no placing: it is around the token already
  if (area.shape === 'emanation') return finish(new CONFIG.Region.documentClass(foundry.utils.deepClone(data), { parent: scene }));
  ui.notifications.info($l10n('SDM.AreaPlaceHint'));
  const squares = squareGrid(scene);
  // Square grids: cones and lines are fixed patterns pointed around the token
  if (squares && (area.shape === 'cone' || area.shape === 'line')) {
    let picked;
    try {
      picked = await placePattern({ data, token: sourceToken, shape: area.shape, length: squaresOf(area.meters, scene), scene, width: area.shape === 'line' ? widthSquares(area, scene) : 1 });
    } catch (error) {
      console.error('SDM | Placing the area failed', error);
      return null;
    }
    if (!picked) return false;
    return finish(new CONFIG.Region.documentClass({ ...foundry.utils.deepClone(data), shapes: squareShapes(picked, scene) }, { parent: scene }), picked);
  }
  const color = data.color || (game.user.color ?? 0x33bbff);
  const ring = area.shape === 'ring';
  // Cones and lines (gridless, hex): from the token toward the cursor; square grids: rings on the middle
  // of a square, the rest on the intersection nearest the cursor
  const onMove = ({ shape, position, snap }) => {
    if (fromToken) {
      const aim = aimShape(sourceToken, position);
      if (aim) shape.updateSource(aim);
      return false;
    }
    if (!squares) return;
    // Shift: no snapping (anywhere on the map); otherwise intersections (rings: square middles)
    const point = snap === false
      ? position
      : canvas.grid.getSnappedPoint(position, { mode: ring ? CONST.GRID_SNAPPING_MODES.CENTER : CONST.GRID_SNAPPING_MODES.VERTEX });
    shape.updateSource({ x: point.x, y: point.y });
    return false;
  };
  const onChange = squares ? ({ document }) => previewSquares(areaSquares(area, document, scene), color) : undefined;
  let placed;
  try {
    // The wheel rotates squares (and, off the grid, everything placed freely); cones and lines aim
    placed = await canvas.regions.placeRegion(data, { create: false, onMove, onChange, allowRotation: !fromToken && (!squares || area.shape === 'square') });
  } catch (error) {
    console.error('SDM | Placing the area failed', error);
    return null;
  } finally {
    if (squares) clearPreview();
  }
  if (!placed) return false;
  return finish(placed);
}

/** The squares a placed (circle, square, ring, emanation) area covers; a ring's wall closed at its diagonals. */
function areaSquares(area, region, scene, exclude = new Set(), from = null) {
  const shape = region.shapes[0];
  // Its middle (or the user's token, around the user): walls stop it there
  const origin = from ?? { x: shape.x, y: shape.y };
  let squares = coveredSquares(region, scene, exclude);
  if (area.shape === 'ring') squares = closeRing(squares, { x: shape.x, y: shape.y }, scene.grid.size);
  return reachedSquares(squares, origin, scene.grid.size);
}

/** The tokens inside the placed area (its side), the range warning, then the region created. */
async function finishPlacement({ area, scene, placed, sourceToken, fromToken, origin, areaId, squares: picked = null, free = false, hazard = null }) {
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
  const outOfRange = !free && !fromToken && sourceToken ? rangeWarning(area, scene, origin, placed) : '';
  if (outOfRange) ui.notifications.warn(outOfRange);

  const regionData = placed.toObject();
  let tokens;
  if (squareGrid(scene)) {
    // The squares it covers (not the user's own for cones, lines and emanations), drawn as those squares
    const exclude = new Set(fromToken && sourceToken ? tokenSquares(sourceToken).map(squareKey) : []);
    const squares = picked ?? areaSquares(area, placed, scene, exclude, fromToken ? origin : null);
    tokens = tokensOnSquares(squares, candidates);
    if (squares.length) {
      regionData.shapes = squareShapes(squares, scene);
      // The measurements were for placing it: on the squares they'd be one label per row
      regionData.displayMeasurements = false;
    }
  } else {
    // Gridless and hex: the tokens' centers, reached from the area's middle (or the user's token)
    const shape = placed.shapes[0];
    const clear = reaches(fromToken ? origin : { x: shape.x, y: shape.y });
    tokens = candidates.filter(token => {
      const center = tokenCenter(token);
      return placed.testPoint({ x: center.x, y: center.y, elevation: token.elevation ?? 0 }) && clear(center);
    });
  }

  // Its hazard (damage, condition each round): those inside now aren't "entering" it (the area just hit them)
  if (hazard) {
    const inside = squareGrid(scene) ? tokensOnSquares(regionSquares(regionData, scene), scene.tokens.contents) : tokens;
    foundry.utils.setProperty(hazard, 'flags.sdm.hazard.initial', inside.map(t => t.uuid));
    regionData.behaviors = [hazard];
  }

  // A lingering area that follows its user: attached to the token, it moves with it
  if (area.linger && area.follows && sourceToken && regionData.flags?.sdm?.[AREA_FLAG]?.linger) {
    regionData.attachment = { token: sourceToken.id };
    regionData.hidden = sourceToken.hidden;
    if (sourceToken.level !== undefined && sourceToken.level !== null) regionData.levels = [sourceToken.level];
  }
  await createArea(scene, regionData);
  // Drawn only (no item): nobody is targeted
  if (!free) setTargets(tokens);
  return { areaId, tokens, outOfRange, lingers: !!placed.getFlag('sdm', AREA_FLAG)?.linger };
}

/* -------------------------------------------- */
/*  A lingering area's light                    */
/* -------------------------------------------- */

const LIGHT_KEY = 'areaLight'; // an ambient light, or an effect on the user's actor: <area id>

/** What a lingering area's light needs (stored on the region; the Referee's game makes it). */
function areaLightData(area, item, actor) {
  const own = item.system?.light ?? {};
  return {
    preset: area.light,
    color: own.color || '',
    animation: own.animation || '',
    follows: !!area.follows,
    actor: actor?.uuid ?? ''
  };
}

/** The light settings (radii in grid squares) for a region: its reach (to its edge, bright half), or a preset. */
function regionLightSettings(region, light) {
  const scene = region.parent;
  if (light.preset !== 'reach') return getLightPreset(light.preset);
  const bounds = region.bounds;
  const reach = bounds ? Math.max(bounds.width, bounds.height) / 2 / scene.grid.size : 1;
  return { ...getLightPreset('glow'), dim: reach, bright: reach / 2, color: light.color || getLightPreset('glow').color, animation: light.animation || '' };
}

/** The Referee's game: a lingering area with a light gets it (an ambient light in its middle, or its user's token). */
async function onAreaCreated(region) {
  if (!game.users.activeGM?.isSelf) return;
  const flag = region.getFlag('sdm', AREA_FLAG);
  if (!flag?.light) return;
  const scene = region.parent;
  const settings = regionLightSettings(region, flag.light);
  const distance = Number(scene.grid.distance) || 5;
  const key = `flags.sdm.${LIGHT_KEY}`;
  if (flag.light.follows && flag.light.actor) {
    const actor = fromUuidSync(flag.light.actor);
    if (!actor) return;
    await actor.createEmbeddedDocuments('ActiveEffect', [
      { name: region.name, img: 'icons/svg/light.svg', transfer: false, system: { changes: buildChanges(settings, distance) }, flags: { sdm: { [LIGHT_KEY]: flag.id } } }
    ]);
    return;
  }
  const bounds = region.bounds;
  if (!bounds) return;
  await scene.createEmbeddedDocuments('AmbientLight', [
    { x: Math.round(bounds.x + bounds.width / 2), y: Math.round(bounds.y + bounds.height / 2), config: lightConfig(settings, distance), [key]: flag.id }
  ]);
}

/** The Referee's game: a lingering area gone takes its light with it. */
async function onAreaDeleted(region) {
  if (!game.users.activeGM?.isSelf) return;
  const flag = region.getFlag('sdm', AREA_FLAG);
  if (!flag?.light) return;
  const scene = region.parent;
  const lights = scene.lights.filter(l => l.getFlag('sdm', LIGHT_KEY) === flag.id).map(l => l.id);
  if (lights.length) await scene.deleteEmbeddedDocuments('AmbientLight', lights);
  const actor = flag.light.actor ? fromUuidSync(flag.light.actor) : null;
  const effects = actor?.effects.filter(e => e.getFlag('sdm', LIGHT_KEY) === flag.id).map(e => e.id) ?? [];
  if (effects.length) await deleteEffects(actor, effects);
}

/* -------------------------------------------- */
/*  Drawing an area (no item)                   */
/* -------------------------------------------- */

/**
 * The scene controls' "Area" button: pick a shape and a size and place it on the map, with no item,
 * roll or card (cones, lines and "around the user" from the selected token). Also removes the areas
 * drawn this way (the user's own; the Referee's: everyone's on the scene).
 */
// The user's last shape and size in "Draw an area" (a flag on the user: the same on every device)
const DRAW_AREA_FLAG = 'drawArea';

export async function drawArea() {
  if (!canvas?.ready || !canvas.scene) return ui.notifications.warn($l10n('SDM.AreaNoScene'));
  const option = (value, label, selected) => `<option value="${value}"${selected ? ' selected' : ''}>${esc($l10n(label))}</option>`;
  // The shape and size this user picked last time (first time: the first shape, medium)
  const last = game.user.getFlag('sdm', DRAW_AREA_FLAG) ?? {};
  const shapeKeys = Object.keys(CONFIG.SDM.areaShapes);
  const lastShape = shapeKeys.includes(last.shape) ? last.shape : shapeKeys[0];
  const lastSize = AREA_SIZES.includes(last.size) ? last.size : 'medium';
  const shapes = Object.entries(CONFIG.SDM.areaShapes).map(([key, label]) => option(key, label, key === lastShape)).join('');
  const sizes = AREA_SIZES.map(key => option(key, CONFIG.SDM.areaValues[key], key === lastSize)).join('');
  // Its color: the last one picked, else the user's color
  const lastColor = /^#[0-9a-f]{6}$/i.test(last.color ?? '') ? last.color : game.user.color?.css ?? '#ff6400';
  const content =
    `<div class="form-group"><label>${esc($l10n('SDM.AreaShape.Label'))}</label><select name="shape">${shapes}</select></div>` +
    `<div class="form-group"><label>${esc($l10n('SDM.AreaDrawSize'))}</label><select name="size">${sizes}</select></div>` +
    `<div class="form-group" data-tooltip="${esc($l10n('SDM.AreaWidthHint'))}"><label>${esc($l10n('SDM.AreaWidth'))}</label><input type="number" name="width" min="0" step="any" value="${Number(last.width) > 0 ? Number(last.width) : ''}" /></div>` +
    `<div class="form-group"><label>${esc($l10n('SDM.AreaDrawColor'))}</label><color-picker name="color" value="${esc(lastColor)}"></color-picker></div>` +
    (game.user.isGM ? hazardFields() : '');
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: 'SDM.AreaDraw', icon: 'fa-solid fa-draw-polygon' },
    content,
    buttons: [
      {
        action: 'place',
        label: 'SDM.AreaDrawPlace',
        icon: 'fa-solid fa-bullseye',
        default: true,
        callback: (event, button) => ({
          shape: button.form.elements.shape.value,
          size: button.form.elements.size.value,
          width: Math.max(Number(button.form.elements.width.value) || 0, 0),
          color: `${new foundry.applications.ux.FormDataExtended(button.form).object.color ?? ''}`,
          hazard: hazardFromForm(button.form)
        })
      },
      { action: 'clear', label: 'SDM.AreaDrawClear', icon: 'fa-solid fa-eraser', callback: () => 'clear' }
    ],
    rejectClose: false
  });
  if (!choice) return;
  if (choice === 'clear') return clearDrawnAreas();
  const color = /^#[0-9a-f]{6}$/i.test(choice.color) ? choice.color : '';
  if (choice.shape !== last.shape || choice.size !== last.size || (color && color !== last.color) || choice.width !== (Number(last.width) || 0)) {
    await game.user.setFlag('sdm', DRAW_AREA_FLAG, { shape: choice.shape, size: choice.size, color: color || last.color || '', width: choice.width }).catch(() => {});
  }
  const area = { ...areaSize(choice.size, choice.shape), size: choice.size, shape: choice.shape, width: areaWidth(choice.width), affects: 'everyone', linger: false, rounds: 0, follows: false, save: null, range: '' };
  const token = canvas.tokens.controlled[0]?.document ?? game.user.character?.getActiveTokens?.(false, true)?.find(t => t.parent === canvas.scene) ?? null;
  const label = `${$l10n(CONFIG.SDM.areaValues[choice.size])} ${$l10n(CONFIG.SDM.areaShapes[choice.shape]).toLowerCase()}`;
  const hazard = choice.hazard ? { ...choice.hazard, name: label } : null;
  if (hazard) foundry.utils.setProperty(hazard, 'flags.sdm.hazard.disposition', token?.disposition ?? null);
  await placeArea({ area, token, name: label, hazard, color });
}

/** The Referee's hazard settings in "Draw an area" (none: no damage and no condition). */
function hazardFields() {
  const E = CONST.REGION_EVENTS;
  const events = [E.TOKEN_ENTER, E.TOKEN_TURN_START, E.TOKEN_ROUND_START]
    .map(
      (event, index) =>
        `<label class="checkbox"><input type="checkbox" name="hazardEvent" value="${event}"${index === 0 ? ' checked' : ''}> ${esc($l10n(`REGION.EVENTS.${event}.label`))}</label>`
    )
    .join(' ');
  const conditions = CONFIG.statusEffects
    .map(status => [status.id, $l10n(status.name ?? status.label ?? status.id)])
    .sort((a, b) => a[1].localeCompare(b[1], game.i18n.lang))
    .map(([id, label]) => `<option value="${esc(id)}">${esc(label)}</option>`)
    .join('');
  return (
    `<fieldset><legend>${esc($l10n('SDM.AreaDrawHazard'))}</legend>` +
    `<p class="hint">${esc($l10n('SDM.AreaDrawHazardHint'))}</p>` +
    `<div class="form-group"><label>${esc($l10n('SDM.AreaDrawWhen'))}</label><div class="form-fields">${events}</div></div>` +
    `<div class="form-group"><label>${esc($l10n('SDM.AreaDrawDamage'))}</label><input type="text" name="hazardDamage"></div>` +
    `<div class="form-group"><label>${esc($l10n('SDM.AreaDrawCondition'))}</label><select name="hazardCondition"><option value=""></option>${conditions}</select></div>` +
    `<div class="form-group"><label>${esc($l10n('SDM.AreaDrawUses'))}</label><input type="number" name="hazardUses" min="0" step="1"></div>` +
    `</fieldset>`
  );
}

/** The hazard behavior from the dialog's fields (null: none set, or not the Referee). */
function hazardFromForm(form) {
  if (!game.user.isGM || !form.elements.hazardDamage) return null;
  const damage = form.elements.hazardDamage.value.trim();
  const condition = form.elements.hazardCondition.value;
  if (!damage && !condition) return null;
  const events = [...form.querySelectorAll('input[name="hazardEvent"]:checked')].map(input => input.value);
  return {
    type: HAZARD_TYPE,
    system: {
      events: events.length ? events : [CONST.REGION_EVENTS.TOKEN_ENTER],
      damage,
      condition,
      conditionRounds: 1,
      save: false,
      saveAbility: '',
      saveDifficulty: '',
      savePass: 'avoid',
      affects: 'everyone',
      uses: Math.max(Math.floor(Number(form.elements.hazardUses.value) || 0), 0)
    },
    flags: { sdm: { hazard: {} } }
  };
}

/** Remove the areas drawn with the Area button: the user's own, or (the Referee) all on the scene. */
async function clearDrawnAreas() {
  const regions = canvas.scene.regions.filter(r => {
    const flag = r.getFlag('sdm', AREA_FLAG);
    return flag?.free && (game.user.isGM || flag.user === game.user.id);
  });
  for (const region of regions) await removeArea(canvas.scene.id, region.getFlag('sdm', AREA_FLAG).id);
}

/** "Beyond Fireball's range (short): the area's center is at medium." when the center is out of range. */
function rangeWarning(area, scene, origin, placed) {
  const rangeIndex = ZONE_BANDS.indexOf(area.range.trim().toLowerCase());
  if (rangeIndex < 0) return '';
  const shape = placed.shapes[0];
  // Circles and squares (anchored at their middle) have their center at x, y
  // Measured as the other range checks are (Foundry's grid: the world's Grid Diagonals rule)
  let units;
  try {
    units = scene.grid.measurePath([{ x: origin.x, y: origin.y }, { x: shape.x, y: shape.y }]).distance;
  } catch {
    units = Math.hypot(shape.x - origin.x, shape.y - origin.y) / scene.dimensions.distancePixels;
  }
  const distance = (Number(units) || 0) * metersPerUnit(scene);
  const band = bandForMeters(distance, sceneZoneLimits(scene));
  if (band <= rangeIndex) return '';
  const label = index => $l10n(CONFIG.SDM.rangeType?.[ZONE_BANDS[index]] ?? ZONE_BANDS[index]);
  return $fmt('SDM.AreaOutOfRange', { item: placed.name, range: label(rangeIndex), zone: label(band) });
}

async function createArea(scene, data) {
  delete data._id;
  // With a hazard (a behavior), only the Referee's game creates it
  if (game.user.isGM || (!data.behaviors?.length && CONFIG.Region.documentClass.canUserCreate(game.user))) return scene.createEmbeddedDocuments('Region', [data]);
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
  if (splash.shape === 'around') {
    // Next to the target, with no wall between them
    const clear = reaches(tokenCenter(targetToken));
    const around = candidates.filter(t => isAdjacent(targetToken, t) && clear(tokenCenter(t)));
    // The squares shown while confirming: those of whoever it reaches
    if (squareGrid(scene)) around.squares = around.flatMap(t => tokenSquares(t));
    return around;
  }

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
  // Square grids: fixed patterns, as areas' cones and lines (never the target's or attacker's squares)
  if (squares) {
    const exclude = new Set([...tokenSquares(targetToken), ...(attackerToken ? tokenSquares(attackerToken) : [])].map(squareKey));
    const size = squaresOf(splash.meters, scene);
    let picked;
    if (splash.shape === 'cone') {
      if (!attackerToken) {
        ui.notifications.warn($l10n('SDM.AttackFeature.SplashNoAttacker'));
        return null;
      }
      ui.notifications.info($l10n('SDM.AreaPlaceHint'));
      try {
        picked = await placePattern({ data: base, token: attackerToken, shape: 'cone', length: size, scene });
      } catch (error) {
        console.error('SDM | Placing the splash failed', error);
        return null;
      }
      if (!picked) return null;
    } else {
      // Behind the target: from its far side, away from the attacker
      const from = attackerToken ? tokenCenter(attackerToken) : { x: target.x - 1, y: target.y };
      const beyond = { x: target.x + (target.x - from.x), y: target.y + (target.y - from.y) };
      picked = patternSquares(targetToken, beyond, splash.shape === 'behind_line' ? 'line' : 'cone', size);
    }
    const reachedSquares = picked.filter(square => !exclude.has(squareKey(square)));
    const reached = tokensOnSquares(reachedSquares, candidates);
    // The squares shown while confirming
    reached.squares = reachedSquares;
    return reached;
  }
  let region;
  if (splash.shape === 'cone') {
    if (!attackerToken) {
      ui.notifications.warn($l10n('SDM.AttackFeature.SplashNoAttacker'));
      return null;
    }
    const cone = { type: 'cone', radius: length, angle: CONE_ANGLE, curvature: 'round', gridBased };
    Object.assign(cone, aimShape(attackerToken, target) ?? { ...tokenCenter(attackerToken), rotation: 0 });
    ui.notifications.info($l10n('SDM.AreaPlaceHint'));
    try {
      region = await canvas.regions.placeRegion(
        { ...base, shapes: [cone] },
        {
          create: false,
          allowRotation: false,
          onMove: ({ shape, position }) => {
            const aim = aimShape(attackerToken, position);
            if (aim) shape.updateSource(aim);
            return false;
          }
        }
      );
    } catch (error) {
      console.error('SDM | Placing the splash failed', error);
      return null;
    }
    if (!region) return null;
  } else {
    // Behind the target: from it, away from the attacker
    const from = attackerToken ? tokenCenter(attackerToken) : { x: target.x - 1, y: target.y };
    const rotation = Math.toDegrees(Math.atan2(target.y - from.y, target.x - from.x));
    const shape =
      splash.shape === 'behind_line'
        ? { type: 'line', x: target.x, y: target.y, length, width, rotation, gridBased }
        : { type: 'cone', x: target.x, y: target.y, radius: length, angle: CONE_ANGLE, rotation, curvature: 'round', gridBased };
    region = new CONFIG.Region.documentClass({ ...base, shapes: [shape] }, { parent: scene });
  }
  const shape = region.shapes[0];
  const clear = reaches({ x: shape.x, y: shape.y });
  return candidates.filter(t => {
    const c = tokenCenter(t);
    return region.testPoint({ x: c.x, y: c.y, elevation: t.elevation ?? 0 }) && clear(c);
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
export function areaPowerButton({ actor, item, kind, total, overcharged = false }) {
  if (!actor || !item || !itemArea(item, kind, { overcharged })) return '';
  return (
    `<button type="button" data-action="sdmPlacePowerArea" data-actor-uuid="${esc(actor.uuid)}" data-item-id="${esc(item.id)}"` +
    ` data-kind="${esc(kind)}" data-total="${Number(total) || 0}"${overcharged ? ' data-overcharged="1"' : ''}>` +
    `<i class="fa-solid fa-bullseye"></i> ${esc($l10n('SDM.AreaPlace'))} <span class="sdm-followup-formula">${esc(areaLabel(item, kind, { overcharged }))}</span></button>`
  );
}

/** "Sacrificed" / "No sacrifice" for a tie (area card, splash): the Referee's call. */
export function tieButtons({ kind, tokenUuid = '', actorUuid, name, amount = 0, reason = '' }) {
  const data = `data-kind="${esc(kind)}" data-token-uuid="${esc(tokenUuid)}" data-actor-uuid="${esc(actorUuid)}" data-name="${esc(name)}" data-amount="${Number(amount) || 0}" data-reason="${esc(reason)}"`;
  return (
    `<div class="sdm-card-tag warn sdm-tie-row" data-actor-uuid="${esc(actorUuid)}"><i class="fa-solid fa-scale-balanced"></i> ${esc($fmt('SDM.AreaTie', { name }))}` +
    // Side by side under the text, as on the save card
    `<div class="sdm-sacrifice-buttons"><button type="button" data-action="sdmTieSacrifice" data-yes="1" ${data}><i class="fa-solid fa-shield-halved"></i> ${esc($l10n('SDM.SaveAgainst.SacrificeMade'))}</button>` +
    `<button type="button" data-action="sdmTieSacrifice" data-yes="" ${data}><i class="fa-solid fa-triangle-exclamation"></i> ${esc($l10n('SDM.SaveAgainst.SacrificeNot'))}</button></div></div>`
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
 * one heals it instead (a power that heals in an area: everyone inside gets the roll back). With
 * more than one target, Apply to all (and Heal all) does everyone not done yet. What was applied is
 * kept on the card (rolls/ui/applyDamage.mjs), with an Undo each.
 */
export function areaApplyButtonsHtml(shares, { heal = false, total = 0 } = {}) {
  if (!shares.length) return '';
  return (
    `<div class="sdm-area-apply">` +
    shares
      .map(
        share =>
          `<span class="sdm-area-share" data-target-uuid="${esc(share.target.uuid)}">` +
          `<button type="button" data-action="sdmAreaApplyDamage" data-target-uuid="${esc(share.target.uuid)}" data-amount="${share.amount}">` +
          `<i class="fa-solid fa-heart-crack"></i> ${esc(share.target.name)} −${share.amount}${share.reduction ? ` (−${share.reduction})` : ''}</button>` +
          (heal
            ? `<button type="button" data-action="sdmAreaApplyDamage" data-heal="1" data-target-uuid="${esc(share.target.uuid)}" data-amount="${Number(total) || share.amount}" data-tooltip="${esc($l10n('SDM.Card.Heal'))}"><i class="fa-solid fa-heart"></i> +${Number(total) || share.amount}</button>`
            : '') +
          `</span>`
      )
      .join('') +
    // Everyone at once (each their own share)
    (shares.length > 1
      ? `<span class="sdm-area-all"><button type="button" data-action="sdmAreaApplyAll"><i class="fa-solid fa-heart-crack"></i> ${esc($l10n('SDM.AreaApplyAll'))}</button>` +
        (heal ? `<button type="button" data-action="sdmAreaApplyAll" data-heal="1"><i class="fa-solid fa-heart"></i> ${esc($l10n('SDM.AreaHealAll'))}</button>` : '') +
        `</span>`
      : '') +
    `</div>`
  );
}


/** The actors an area attack card hit (each defense inside against the attack), for event triggers. */
export function areaAttackHits(card) {
  if (card?.mode !== 'attack' || card.save) return [];
  const field = DEFENSE_FIELD[card.attackTarget] ?? 'defense';
  return (card.inside ?? [])
    .map(uuid => fromUuidSync(uuid)?.actor)
    .filter(actor => actor && outcomeFor(Number(card.total) || 0, Number(actor.system?.[field] ?? actor.system?.defense) || 0, card.isNat1, card.isNat20).hit);
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
export function areaState({ mode, actor, item, kind, placed, total = 0, isNat1 = false, isNat20 = false, attackTarget = 'physical', multiplier = '', overcharged = false }) {
  const area = itemArea(item, kind, { overcharged });
  return {
    mode,
    actor: actor?.uuid ?? '',
    itemId: item.id,
    itemName: item.name,
    kind: kind || (mode === 'attack' ? 'weapon' : mode === 'power' ? 'power' : ''),
    chips: [areaLabel(item, kind, { overcharged }), lingerLabel(item, kind, { overcharged })].filter(Boolean),
    // Placed overcharged (its bigger area): Reposition places that one again
    overcharged: !!area?.overcharged,
    save: area?.save ?? null,
    saves: {},
    lingers: !!area?.linger,
    affects: area?.affects ?? 'everyone',
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
  // Nobody inside: with Affects set, say so (the others were left out on purpose)
  const empty = `<div class="sdm-card-tag info">${esc(
    state.affects && state.affects !== 'everyone'
      ? $fmt('SDM.AreaEmptyAffects', { affects: $l10n(CONFIG.SDM.areaAffects[state.affects] ?? '').toLowerCase() })
      : $l10n('SDM.AreaEmpty')
  )}</div>`;

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
    if (!tokens.length) rows.push(empty);
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
      // A power that rolls nothing is used at once after the attack (rolls/sdmRoll.mjs): no button
      if (targets.length && !powerWithoutRoll(attackItem)) actions += attackFollowupHtml(attackItem);
    } else if (total > 0 && targets.length) {
      rows.push(areaApplyButtonsHtml(areaShares(targets, total, { saved: savedActors, pass: state.save.pass }), { heal: state.mode === 'power', total }));
    }
  } else if (state.mode === 'attack') {
    // The attack against each defense inside
    for (const token of tokens) {
      const target = token.actor;
      // NPCs too: their mental and social defenses are the typed one plus those bonuses
      const field = DEFENSE_FIELD[state.attackTarget] ?? 'defense';
      const defense = Number(target.system?.[field] ?? target.system?.defense) || 0;
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
    if (!tokens.length) rows.push(empty);
    attackItem = {
      id: state.itemId,
      name: state.itemName,
      kind: state.kind || 'weapon',
      actor: state.actor,
      multiplier: state.multiplier || '',
      areaTargets: hits.map(t => t.actor.uuid)
    };
    if (hits.length && !powerWithoutRoll(attackItem)) actions += attackFollowupHtml(attackItem);
  } else {
    // A power: everyone inside, each with its share of the roll
    hits.push(...tokens);
    const names = tokens.map(t => esc(t.name)).join(', ');
    rows.push(
      names
        ? `<div class="sdm-card-tag info">${esc($l10n('SDM.AreaInside'))}: ${names}</div>`
        : empty
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
  const overcharged = button.dataset.overcharged === '1';
  const placed = await placeArea({ actor, item, kind, overcharged });
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
      multiplier: button.dataset.multiplier || '',
      overcharged
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
  const placed = await placeArea({ actor, item, kind: card.kind, overcharged: !!card.overcharged });
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
    if (old.length) await deleteEffects(actor, old);
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
/*  Hazards (region behavior)                   */
/* -------------------------------------------- */

// A system's own subtype has no prefix (system.json documentTypes.RegionBehavior.hazard)
export const HAZARD_TYPE = 'hazard';
// A token is hit at most once per round (in combat) by each hazard
const hazardHits = new Map();

/** The damage formula an item deals: a power's roll, a weapon's damage (with its bonus), a consumable's Harm. */
function itemDamageFormula(item, kind = '') {
  const power = areaPower(item, kind);
  if (power) return `${power.roll_formula ?? ''}`.trim();
  const damage = item?.system?.weapon?.damage;
  if (damage?.base) {
    const bonus = Number(damage.bonus) || 0;
    return bonus ? `${damage.base}${bonus > 0 ? '+' : ''}${bonus}` : `${damage.base}`;
  }
  return `${item?.system?.use?.harm ?? ''}`.trim();
}

/** The hazard a lingering item area puts on its region (damage, condition, save each round), or null. */
function areaHazard(area, item, kind, sourceToken, actor) {
  const round = area.round;
  if (!round) return null;
  const E = CONST.REGION_EVENTS;
  const save = area.save;
  const exact = /^\d+$/.test(`${save?.difficulty ?? ''}`);
  return {
    type: HAZARD_TYPE,
    name: item.name,
    system: {
      events: [E.TOKEN_ROUND_START, ...(round.enter ? [E.TOKEN_ENTER] : [])],
      damage: round.damage === 'item' ? itemDamageFormula(item, kind) : round.damage === 'formula' ? round.formula : '',
      condition: round.condition,
      conditionRounds: round.conditionRounds,
      save: !!save,
      saveAbility: save?.ability ?? '',
      saveDifficulty: save && !exact ? save.difficulty ?? '' : '',
      savePass: save?.pass ?? 'avoid',
      affects: area.affects || 'everyone',
      uses: 0
    },
    flags: {
      sdm: {
        hazard: {
          actor: actor?.uuid ?? '',
          item: item.uuid,
          disposition: sourceToken?.disposition ?? null,
          ...(exact ? { difficulty: save.difficulty } : {})
        }
      }
    }
  };
}

/** The squares a region's rectangles cover (an area drawn as squares). */
function regionSquares(regionData, scene) {
  const size = scene.grid.size;
  const squares = [];
  for (const shape of regionData.shapes ?? []) {
    if (shape.type !== 'rectangle') continue;
    for (let i = Math.round(shape.y / size); i < Math.round((shape.y + shape.height) / size); i++) {
      for (let j = Math.round(shape.x / size); j < Math.round((shape.x + shape.width) / size); j++) squares.push({ i, j });
    }
  }
  return squares;
}

/** Does the hazard affect this token (its side)? */
function hazardAffects(behavior, token) {
  const affects = behavior.system.affects;
  const D = CONST.TOKEN_DISPOSITIONS;
  const placer = behavior.getFlag('sdm', 'hazard')?.disposition ?? null;
  if (affects === 'hostile') return token.disposition === D.HOSTILE;
  if (affects === 'friendly') return token.disposition === D.FRIENDLY;
  if (affects === 'neutral') return token.disposition === D.NEUTRAL;
  if (affects === 'enemies') return placer === null || token.disposition !== placer;
  if (affects === 'allies') return placer === null || token.disposition === placer;
  return true;
}

/**
 * A hazard's event (the Referee's game): the token entered, started its turn, or was inside when the
 * round started. Once per round in combat; uses (when set) run out and switch it off.
 */
export async function hazardEvent(behavior, token, eventName = '') {
  if (!behaviorAlive(behavior)) return;
  // Not on those already down (0 life, defeated)
  const { isDown } = await import('./auras.mjs');
  if (!hazardAffects(behavior, token) || isDown(token.actor)) return;
  // Inside when the item's area was placed: it doesn't "enter" until it leaves and comes back
  const initial = behavior.getFlag('sdm', 'hazard')?.initial ?? [];
  if (eventName === CONST.REGION_EVENTS.TOKEN_ENTER && initial.includes(token.uuid)) return;
  const combat = game.combats.find(c => c.started && (c.scene?.id === token.parent?.id || c.combatants.some(cb => cb.sceneId === token.parent?.id))) ?? null;
  if (combat) {
    const key = `${behavior.uuid}|${token.uuid}`;
    const stamp = `${combat.id}|${combat.round}`;
    if (hazardHits.get(key) === stamp) return;
    hazardHits.set(key, stamp);
  }
  const flag = behavior.getFlag('sdm', 'hazard') ?? {};
  const uses = Number(behavior.system.uses) || 0;
  if (uses > 0) {
    const used = (Number(flag.used) || 0) + 1;
    await behavior.update({ 'flags.sdm.hazard.used': used, ...(used >= uses ? { disabled: true } : {}) });
  }
  // The damage (Bystander takes its level off), then the save or the result at once
  let amount = 0;
  const formula = `${behavior.system.damage ?? ''}`.trim();
  if (formula) {
    const actor = flag.actor ? fromUuidSync(flag.actor) : null;
    const item = flag.item ? fromUuidSync(flag.item) : null;
    try {
      const roll = await new Roll(resolveFormulaReferences(formula, { actor, item }), actor?.getRollData?.() ?? {}).evaluate();
      amount = Math.max((Number(roll.total) || 0) - areaDamageReduction(token.actor), 0);
      // The roll goes to the Referee only (who can reveal it from the message's menu); applied already,
      // so no apply buttons and no hero dice on it
      await roll.toMessage(
        {
          speaker: ChatMessage.getSpeaker({ alias: behavior.name || behavior.region?.name || '' }),
          flavor: $fmt('SDM.Hazard.RollFlavor', { name: behavior.name || behavior.region?.name || '', target: token.name }),
          flags: { sdm: { hazardRoll: true, noHeroDice: true } }
        },
        { messageMode: 'gm' }
      );
    } catch (error) {
      console.warn(`SDM | ${behavior.name}: "${formula}" could not be rolled`, error);
    }
  }
  const condition = behavior.system.condition;
  if (amount <= 0 && !condition) return;
  const name = behavior.name || behavior.region?.name || '';
  const hit = { token: token.uuid, amount, condition, rounds: Number(behavior.system.conditionRounds) || 0, pass: behavior.system.savePass, name };
  if (!behavior.system.save) return applyHazard(hit, false);
  const { saveAgainst } = await import('../app/save-against.mjs');
  await saveAgainst(token.actor, {
    hazard: hit,
    source: name,
    ability: behavior.system.saveAbility || '',
    difficulty: flag.difficulty || behavior.system.saveDifficulty || ''
  });
}

/**
 * The behavior and its region are still there: deleting a region (Remove area, Remove drawn areas)
 * makes the tokens inside "leave" it, after the server already deleted it.
 */
function behaviorAlive(behavior) {
  const region = behavior?.parent;
  return !!region?.parent?.regions?.has(region.id) && !!region.behaviors?.has(behavior.id);
}

/** A token leaving a hazard's region: from now on, coming back in counts as entering. */
export async function hazardExit(behavior, token) {
  if (!behaviorAlive(behavior)) return;
  const initial = behavior.getFlag('sdm', 'hazard')?.initial ?? [];
  if (initial.includes(token.uuid)) await behavior.setFlag('sdm', 'hazard', { initial: initial.filter(uuid => uuid !== token.uuid) });
}

/** What a hazard's result gives: damage and the condition's rounds (null: none); a tie waits for the Referee. */
function hazardOutcome(hit, result) {
  if (result === undefined || result === null || result === 'equal') return { amount: 0, rounds: null };
  if (result === false) return { amount: hit.amount, rounds: hit.condition ? hit.rounds : null };
  if (hit.pass === 'half') return { amount: Math.ceil(hit.amount / 2), rounds: null };
  if (hit.pass === 'shorter') return { amount: hit.amount, rounds: hit.condition ? 1 : null };
  return { amount: 0, rounds: null };
}

/** A hazard's save result (true, false, 'equal'): applied by the Referee's game. */
export async function reportHazardSave(hit, result, previous) {
  if (game.user.isGM) return applyHazard(hit, result, previous);
  if (!game.users.activeGM) return ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
  game.socket.emit(CHANNEL, { action: HAZARD_ACTION, hit, result, previous });
}

/**
 * Apply a hazard's result; when hero dice change it (previous), only the difference: damage added or
 * given back, the condition put on, taken off or put on again for its new rounds.
 */
async function applyHazard(hit, result, previous) {
  const actor = fromUuidSync(hit.token)?.actor;
  if (!actor) return;
  const now = hazardOutcome(hit, result);
  const before = hazardOutcome(hit, previous);
  const { changeLifeOf, applyStatusToTargets } = await import('../app/use-item.mjs');
  const diff = now.amount - before.amount;
  if (diff) await changeLifeOf(actor, Math.abs(diff), { heal: diff < 0, reason: hit.name });
  if (!hit.condition || now.rounds === before.rounds) return;
  if (before.rounds !== null) await applyStatusToTargets(hit.condition, null, { targets: [actor], remove: true, silent: true });
  if (now.rounds !== null) await applyStatusToTargets(hit.condition, null, { targets: [actor], rounds: now.rounds });
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
  Hooks.on('createRegion', region => onAreaCreated(region).catch(error => console.warn('SDM | Area light failed', error)));
  Hooks.on('deleteRegion', region => onAreaDeleted(region).catch(error => console.warn('SDM | Area light removal failed', error)));
  game.socket.on(CHANNEL, async message => {
    if (game.users.activeGM?.id !== game.user.id) return;
    if (message?.action === SAVE_ACTION) return applyAreaSave(message.area, message.result);
    if (message?.action === HAZARD_ACTION) return applyHazard(message.hit, message.result, message.previous);
    const scene = game.scenes.get(message?.sceneId);
    if (!scene) return;
    if (message.action === CREATE_ACTION) await scene.createEmbeddedDocuments('Region', [message.data]);
    if (message.action === REMOVE_ACTION) {
      const region = scene.regions.find(r => r.getFlag('sdm', AREA_FLAG)?.id === message.areaId);
      await region?.delete();
    }
  });
}

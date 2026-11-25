/**
 * Vision from effects: an effect's Vision tab (a vision mode, a sight range in spaces, extra senses)
 * changes how its actor's tokens see while it is on — a trait, readied goggles, a power with a
 * duration, a consumable's Use, a form. Foundry's effects can't reach a token, so the Referee's game
 * sets the tokens' sight and detection modes and keeps what they had (flags.sdm.ownVision) to put it
 * back when no effect gives vision any more. Several at once: the longest range wins, its mode with
 * it; the senses add up. Seeing the invisible stays the Sees invisible condition (helpers/conditions).
 */

const OWN_FLAG = 'ownVision';
// Extra senses an effect can give (Foundry's detection modes)
export const VISION_SENSES = ['feelTremor', 'senseInvisibility', 'seeAll', 'senseAll'];
// The vision modes offered (blindness is the Blind condition's)
export const VISION_MODES = ['basic', 'darkvision', 'monochromatic', 'tremorsense', 'lightAmplification'];
// Senses with no range of their own reach the whole scene
const FAR = 9999;
const SIGHT_KEYS = ['enabled', 'range', 'visionMode', 'color', 'attenuation', 'brightness', 'saturation', 'contrast'];

const isActiveGM = () => game.user.isGM && game.users.activeGM?.isSelf;

/** Vision modes for the effect sheet: { id: label }. */
export function visionModeChoices() {
  return Object.fromEntries(VISION_MODES.filter(id => CONFIG.Canvas.visionModes?.[id]).map(id => [id, CONFIG.Canvas.visionModes[id].label]));
}

/** Senses for the effect sheet: [{ id, label }]. */
export function visionSenseChoices() {
  return VISION_SENSES.filter(id => CONFIG.Canvas.detectionModes?.[id]).map(id => ({ id, label: CONFIG.Canvas.detectionModes[id].label }));
}

// Senses that perceive the invisible and the hidden (feeling tremors doesn't: flying or still creatures)
const PERCEIVES_UNSEEN = ['senseInvisibility', 'seeAll', 'senseAll'];

/** The actor's token on the scene in view (a linked actor: its first one there), or null. */
function tokenOnCanvas(actor) {
  return actor?.getActiveTokens?.()?.[0] ?? null;
}

/**
 * The viewer perceives the other one though it is invisible or hidden: one of its vision senses
 * (sense invisibility, see all, sense all) reaches it — within the sense's range when both tokens are
 * on the scene in view (blank range, or no tokens: any distance). For the rolls (helpers/conditions).
 */
export function perceivesUnseen(viewer, other) {
  if (!viewer) return false;
  const reaches = [];
  for (const effect of viewer.allApplicableEffects?.() ?? []) {
    if (!effect.active || !givesVision(effect)) continue;
    const vision = effect.system.vision;
    if (!PERCEIVES_UNSEEN.some(id => vision.senses?.[id])) continue;
    reaches.push({ spaces: vision.range ?? null });
  }
  const formVision = viewer.flags?.sdm?.form?.numbers?.vision;
  if (formVision?.senses?.some(id => PERCEIVES_UNSEEN.includes(id))) reaches.push({ units: Number(formVision.range) || null });
  if (!reaches.length) return false;

  const a = tokenOnCanvas(viewer);
  const b = tokenOnCanvas(other);
  if (!a || !b || !canvas?.grid) return true;
  const distance = canvas.grid.measurePath([a.center, b.center]).distance;
  const perSpace = Number(canvas.scene?.grid?.distance) || 1;
  return reaches.some(({ spaces, units }) => {
    const range = spaces !== null && spaces !== undefined ? Number(spaces) * perSpace : units;
    return !range || distance <= range;
  });
}

/** An effect that gives vision while it is on. */
export function givesVision(effect) {
  return !!effect?.system?.vision?.enabled;
}

/**
 * What the actor's vision sources ask for, for a scene: { mode, range (scene units, null: the
 * token's own), senses: Set }, or null when nothing gives vision.
 */
function wantedVision(actor, scene) {
  const perSpace = Number(scene?.grid?.distance) || 1;
  const sources = [];
  for (const effect of actor.allApplicableEffects?.() ?? []) {
    if (!effect.active || !givesVision(effect)) continue;
    const vision = effect.system.vision;
    const spaces = vision.range;
    sources.push({
      mode: vision.mode || '',
      range: spaces === null || spaces === undefined || spaces === '' ? null : Number(spaces) * perSpace,
      senses: VISION_SENSES.filter(id => vision.senses?.[id])
    });
  }
  // A form that takes its NPC's vision (helpers/forms.mjs): already in scene units
  const formVision = actor.flags?.sdm?.form?.numbers?.vision;
  if (formVision) sources.push({ mode: formVision.mode || '', range: Number.isFinite(formVision.range) ? formVision.range : null, senses: formVision.senses ?? [] });
  if (!sources.length) return null;

  const ranged = sources.filter(s => s.range !== null);
  const range = ranged.length ? Math.max(...ranged.map(s => s.range)) : null;
  const withMode = sources.filter(s => s.mode);
  const best = withMode.sort((a, b) => (b.range ?? -1) - (a.range ?? -1))[0];
  return { mode: best?.mode || '', range, senses: new Set(sources.flatMap(s => s.senses)) };
}

/** The update that gives the token this vision (or puts its own back), or null when nothing changes. */
function visionUpdate(token, wanted) {
  const source = token._source;
  const own = token.getFlag('sdm', OWN_FLAG);
  const current = source.detectionModes ?? {};
  const update = {};

  if (!wanted) {
    if (!own) return null;
    for (const key of SIGHT_KEYS) if (key in (own.sight ?? {})) update[`sight.${key}`] = own.sight[key];
    for (const [id, original] of Object.entries(own.modes ?? {})) {
      if (original) update[`detectionModes.${id}`] = original;
      else if (id in current) update[`detectionModes.-=${id}`] = null;
    }
    update[`flags.sdm.-=${OWN_FLAG}`] = null;
    return update;
  }

  const kept = own ?? { sight: Object.fromEntries(SIGHT_KEYS.map(key => [key, source.sight?.[key] ?? null])), modes: {} };
  const modes = { ...(kept.modes ?? {}) };

  // Sight: the mode (with its look) and range asked for, else the token's own
  const sight = { ...kept.sight, enabled: true };
  if (wanted.mode) Object.assign(sight, { visionMode: wanted.mode, ...(CONFIG.Canvas.visionModes?.[wanted.mode]?.vision?.defaults ?? {}) });
  if (wanted.range !== null) sight.range = wanted.range;
  for (const key of SIGHT_KEYS) {
    if (key in sight && sight[key] !== source.sight?.[key]) update[`sight.${key}`] = sight[key];
  }

  // Detection modes: the senses asked for (and basic sight following a new range); those no longer
  // asked for get their own back
  const senseRange = wanted.range > 0 ? wanted.range : FAR;
  const desired = {};
  for (const id of wanted.senses) desired[id] = { enabled: true, range: Math.max(Number(current[id]?.range) || 0, senseRange) };
  if (wanted.range !== null && current.basicSight) desired.basicSight = { enabled: true, range: wanted.range };
  for (const [id, entry] of Object.entries(desired)) {
    if (!(id in modes)) modes[id] = current[id] ? { ...current[id] } : null;
    if (current[id]?.enabled !== entry.enabled || current[id]?.range !== entry.range) update[`detectionModes.${id}`] = entry;
  }
  for (const [id, original] of Object.entries(modes)) {
    if (id in desired) continue;
    if (original) update[`detectionModes.${id}`] = original;
    else if (id in current) update[`detectionModes.-=${id}`] = null;
    delete modes[id];
  }

  const flag = { sight: kept.sight, modes };
  if (!own || JSON.stringify(own) !== JSON.stringify(flag) || Object.keys(update).length) update[`flags.sdm.${OWN_FLAG}`] = flag;
  return Object.keys(update).length ? update : null;
}

/** Every token of the actor (linked: all scenes; unlinked: its own). */
function tokensOf(actor) {
  if (actor?.isToken) return [actor.token].filter(Boolean);
  return game.scenes.contents.flatMap(scene => scene.tokens.filter(t => t.actorLink && t.actorId === actor?.id));
}

/** Give the actor's tokens the vision its effects ask for (the Referee's game). */
export async function syncVision(actor) {
  if (!(actor instanceof Actor) || !isActiveGM()) return;
  for (const token of tokensOf(actor)) {
    const update = visionUpdate(token, wantedVision(actor, token.parent));
    if (update) await token.update(update, { sdmVision: true });
  }
}

// One sync per actor for a burst of changes
const pending = new Map();
function schedule(actor) {
  if (!(actor instanceof Actor) || !isActiveGM()) return;
  const key = actor.uuid;
  clearTimeout(pending.get(key));
  pending.set(key, setTimeout(() => {
    pending.delete(key);
    syncVision(actor).catch(error => console.error('SDM | Vision sync failed', error));
  }, 50));
}

const ownerOf = doc => (doc?.parent instanceof Actor ? doc.parent : doc?.parent?.parent instanceof Actor ? doc.parent.parent : null);

function onEffectChange(effect, changes) {
  if (!givesVision(effect) && !foundry.utils.hasProperty(changes ?? {}, 'system.vision')) return;
  schedule(ownerOf(effect));
}

function onItemChange(item) {
  if (!item.effects?.some?.(givesVision)) return;
  schedule(item.parent);
}

export function setupVision() {
  Hooks.on('createActiveEffect', effect => onEffectChange(effect));
  Hooks.on('updateActiveEffect', (effect, changes) => onEffectChange(effect, changes));
  Hooks.on('deleteActiveEffect', effect => onEffectChange(effect));
  Hooks.on('createItem', onItemChange);
  Hooks.on('updateItem', onItemChange);
  Hooks.on('deleteItem', onItemChange);
  // A form taking its NPC's vision (or ending)
  Hooks.on('updateActor', (actor, changes) => {
    if (foundry.utils.hasProperty(changes, 'flags.sdm.form') || foundry.utils.hasProperty(changes, 'flags.sdm.-=form')) schedule(actor);
  });
  Hooks.on('createToken', token => {
    if (token.actor && (token.getFlag('sdm', OWN_FLAG) || [...(token.actor.allApplicableEffects?.() ?? [])].some(givesVision) || token.actor.flags?.sdm?.form?.numbers?.vision)) schedule(token.actor);
  });
}

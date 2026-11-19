import { resolveEffectReferences, resolveFormulaReferences } from './effectReferences.mjs';
import { $l10n } from './globalUtils.mjs';
import { metersPerUnit, sceneZoneLimits } from './zones.mjs';
import { buildChanges, getLightPreset, lightSettingsFrom } from './lights.mjs';
import { isItemPileActor } from './itemUtils.mjs';

/**
 * Auras: an active effect with its aura on radiates from its actor's tokens. Each source token gets
 * one region per aura (an emanation attached to the token, reaching a zone band of the scene or a
 * distance of its own); every other token inside, of the right side (allies / enemies / any), gets a
 * copy of the effect, removed when it leaves. The aura's own changes don't apply to its actor unless
 * "applies to self" is ticked. With "evaluate on the source" the copy's values come from the source
 * (Soldier: the Soldier's charisma, not the ally's). Auras that don't stack: only the best one of the
 * same name applies (by the best formula, else the sum of its values).
 * All the work (regions and copies) is done by the active GM's game, on the scenes people are on.
 * Built after the Aura Effects module (MIT, roth-michael): same region approach, our own data.
 */

const REGION_FLAG = 'auraRegion'; // region: { effect: <effect uuid>, token: <token id> }
const COPY_FLAG = 'fromAura'; // copy on the recipient: <source effect uuid>
const SOURCE_FLAG = 'auraSource'; // copy: the source's name (tooltip)
const AREA_FLAG = 'area'; // a placed area (helpers/areas.mjs); lingering ones give their item's effects
const SETTING = 'enableAuras';
const AURA_EFFECTS_MODULE = 'auraeffects';

export function isAura(effect) {
  return !!effect?.system?.aura?.enabled;
}

export function isAuraCopy(effect) {
  return !!effect?.getFlag?.('sdm', COPY_FLAG);
}

/** The name of the aura's source, for a copy ("Aura from Bob"). */
export function auraSourceName(effect) {
  return isAuraCopy(effect) ? effect.getFlag('sdm', SOURCE_FLAG) || '' : '';
}

/** On unless turned off, and off while the Aura Effects module is active (auras would apply twice). */
export function aurasEnabled() {
  if (game.modules.get(AURA_EFFECTS_MODULE)?.active) return false;
  try {
    return game.settings.get('sdm', SETTING) !== false;
  } catch {
    return true;
  }
}

/** The actor's aura effects that are on (its own and those its items give it). */
export function auraEffectsOf(actor) {
  if (!actor) return [];
  actor._sdmListingAuras = true;
  try {
    return [...actor.allApplicableEffects()].filter(e => isAura(e) && e.active && !isAuraCopy(e));
  } finally {
    actor._sdmListingAuras = false;
  }
}

/**
 * The actor's effects as its sheet lists them: its auras too (they don't apply to the actor itself, so
 * allApplicableEffects leaves them out, but they're the actor's to edit or delete).
 */
export function listedEffects(actor) {
  if (!actor) return [];
  actor._sdmListingAuras = true;
  try {
    return [...actor.allApplicableEffects()];
  } finally {
    actor._sdmListingAuras = false;
  }
}

/** True for an aura effect whose changes must not apply to its own actor (see SdmActor#allApplicableEffects). */
export function skipsItsActor(effect, actor) {
  return isAura(effect) && !effect.system.aura.applyToSelf && !actor?._sdmListingAuras;
}

/* -------------------------------------------- */
/*  Regions                                     */
/* -------------------------------------------- */

/**
 * The aura's reach in the scene's grid units: its band in the scene's zone scale, or its own reach in
 * grid spaces (squares or hexes; older auras: a distance in the world unit).
 */
function auraDistance(effect, scene) {
  const aura = effect.system.aura;
  if (aura.band === 'custom' && Number(aura.spaces) > 0) return Number(aura.spaces) * (Number(scene.grid.distance) || 1);
  const world = aura.band === 'custom' ? Number(aura.distance) || 0 : sceneZoneLimits(scene)[aura.band] ?? 0;
  return Math.max(world / metersPerUnit(scene), 0);
}

function auraColor(effect, actor) {
  const color = effect.system.aura.color;
  if (color) return color.css ?? String(color);
  const owner = game.users.find(u => !u.isGM && u.character === actor) ?? game.users.activeGM;
  return owner?.color?.css ?? undefined;
}

function regionData(effect, token) {
  const aura = effect.system.aura;
  const scene = token.parent;
  const data = {
    name: effect.name,
    attachment: { token: token.id },
    color: auraColor(effect, token.actor),
    displayMeasurements: false,
    flags: { sdm: { [REGION_FLAG]: { effect: effect.uuid, token: token.id } } },
    locked: true,
    restriction: aura.walls ? { enabled: true, type: 'move' } : { enabled: false },
    shapes: [
      {
        type: 'emanation',
        base: {
          type: 'token',
          x: token._source.x,
          y: token._source.y,
          width: token._source.width,
          height: token._source.height,
          shape: token._source.shape
        },
        // Along the grid (the spaces around the token's edge)
        gridBased: true,
        hole: false,
        radius: auraDistance(effect, scene) * scene.dimensions.distancePixels
      }
    ],
    visibility: aura.showRadius ? CONST.REGION_VISIBILITY.ALWAYS : CONST.REGION_VISIBILITY.LAYER_UNLOCKED
  };
  if (token.level !== undefined && token.level !== null) data.levels = [token.level];
  data.flags.sdm[REGION_FLAG].sig = regionSignature(data);
  return data;
}

/** What changes a region needs (reach, look, walls); null when it is up to date. Compared by what we last
 *  wrote (the flag's signature), not by the shape core may adjust, so updates never loop. */
function regionSignature(data) {
  // "grid": regions drawn while auras were round get redrawn along the grid
  return JSON.stringify(['grid', data.name, Math.round(data.shapes[0].radius), data.visibility, !!data.restriction.enabled, data.color ?? '']);
}

function regionChanges(region, data) {
  if (region.getFlag('sdm', REGION_FLAG)?.sig === data.flags.sdm[REGION_FLAG].sig) return null;
  return {
    _id: region.id,
    name: data.name,
    color: data.color,
    restriction: data.restriction,
    visibility: data.visibility,
    shapes: data.shapes,
    [`flags.sdm.${REGION_FLAG}.sig`]: data.flags.sdm[REGION_FLAG].sig
  };
}

const regionKey = (tokenId, effectUuid) => `${tokenId}|${effectUuid}`;

function inStartedCombat(token) {
  return game.combats.some(c => c.started && c.combatants.some(cb => cb.tokenId === token.id && cb.sceneId === token.parent?.id));
}

async function syncSceneRegions(scene, enabled) {
  const wanted = new Map();
  if (enabled) {
    for (const token of scene.tokens) {
      if (token.hidden || !token.actor) continue;
      for (const effect of auraEffectsOf(token.actor)) {
        if (effect.system.aura.combatOnly && !inStartedCombat(token)) continue;
        if (auraDistance(effect, scene) <= 0) continue;
        wanted.set(regionKey(token.id, effect.uuid), regionData(effect, token));
      }
    }
  }
  const toCreate = [];
  const toUpdate = [];
  const toDelete = [];
  const seen = new Set();
  for (const region of scene.regions) {
    const flag = region.getFlag('sdm', REGION_FLAG);
    if (!flag) continue;
    const key = regionKey(flag.token, flag.effect);
    const data = wanted.get(key);
    if (!data || seen.has(key)) {
      toDelete.push(region.id);
      continue;
    }
    seen.add(key);
    const changes = regionChanges(region, data);
    if (changes) toUpdate.push(changes);
  }
  for (const [key, data] of wanted) if (!seen.has(key)) toCreate.push(data);
  if (toDelete.length) await scene.deleteEmbeddedDocuments('Region', toDelete);
  if (toUpdate.length) await scene.updateEmbeddedDocuments('Region', toUpdate);
  if (toCreate.length) await scene.createEmbeddedDocuments('Region', toCreate);
}

/* -------------------------------------------- */
/*  Copies                                      */
/* -------------------------------------------- */

/**
 * Same side? A neutral item pile (an item lying on the map) counts as the party's: its allies are the
 * friendly tokens, its enemies the others. Give the pile's token another disposition to change it.
 */
function sameSide(a, b) {
  const D = CONST.TOKEN_DISPOSITIONS;
  if (a.disposition === D.NEUTRAL && isItemPileActor(a.actor)) return b.disposition === D.FRIENDLY;
  return a.disposition === b.disposition;
}

function fitsDisposition(aura, source, target) {
  if (aura.disposition === 'any') return true;
  return aura.disposition === 'allies' ? sameSide(source, target) : !sameSide(source, target);
}

/** The copy the recipient gets: the source's values when "evaluate on the source" is ticked. */
function copyData(effect, sourceActor, sourceName = sourceActor?.name) {
  const aura = effect.system.aura;
  const item = effect.parent?.documentName === 'Item' ? effect.parent : null;
  const changes = effect.system.changes.map(change => {
    const c = foundry.utils.deepClone(change);
    if (aura.evaluateOnSource && typeof c.value === 'string') {
      const resolved = resolveEffectReferences(c.value, { actor: sourceActor, item, effect });
      c.value = typeof resolved === 'string' ? resolved : String(resolved);
    }
    return c;
  });
  return {
    name: effect.name,
    img: effect.img,
    type: effect.type,
    description: effect.description ?? '',
    origin: effect.uuid,
    transfer: false,
    disabled: false,
    statuses: [...(effect.statuses ?? [])],
    system: { changes, aura: { enabled: false } },
    flags: { sdm: { [COPY_FLAG]: effect.uuid, [SOURCE_FLAG]: sourceName ?? '' } }
  };
}

/** How good an aura is, for auras that don't stack: its best formula (on the source), else the sum of its values. */
function auraValue(effect, sourceActor, copy) {
  const aura = effect.system.aura;
  const item = effect.parent?.documentName === 'Item' ? effect.parent : null;
  try {
    if (aura.bestFormula?.trim()) {
      const formula = resolveFormulaReferences(aura.bestFormula, { actor: sourceActor, item });
      return Number(Roll.safeEval(formula)) || 0;
    }
  } catch {
    return 0;
  }
  return copy.system.changes.reduce((sum, c) => sum + (Number(c.value) || 0), 0);
}

/** The copies each actor on these scenes should have, keyed by actor uuid. */
function wantedCopies(scenes) {
  const byActor = new Map(); // uuid → { actor, candidates: [] }
  for (const scene of scenes) {
    const regions = scene.regions.filter(r => r.getFlag('sdm', REGION_FLAG));
    const lingering = scene.regions.filter(r => r.getFlag('sdm', AREA_FLAG)?.linger);
    for (const token of scene.tokens) {
      const actor = token.actor;
      if (!actor) continue;
      const entry = byActor.get(actor.uuid) ?? { actor, candidates: [] };
      byActor.set(actor.uuid, entry);
      for (const region of regions) {
        if (!region.tokens?.has(token)) continue;
        const flag = region.getFlag('sdm', REGION_FLAG);
        const source = scene.tokens.get(flag.token);
        const effect = fromUuidSync(flag.effect);
        if (!source?.actor || !effect || !isAura(effect)) continue;
        if (source === token || source.actor === actor) continue;
        if (!fitsDisposition(effect.system.aura, source, token)) continue;
        if (entry.candidates.some(c => c.effect.uuid === effect.uuid)) continue;
        const copy = copyData(effect, source.actor);
        entry.candidates.push({ effect, copy, value: auraValue(effect, source.actor, copy) });
      }
      // Lingering areas (helpers/areas.mjs): whoever stands in one has its item's effects
      for (const region of lingering) {
        if (!region.tokens?.has(token)) continue;
        const flag = region.getFlag('sdm', AREA_FLAG);
        if (flag.affects === 'enemies' && flag.disposition !== null && token.disposition === flag.disposition) continue;
        if (flag.affects === 'allies' && flag.disposition !== null && token.disposition !== flag.disposition) continue;
        const sourceActor = fromUuidSync(flag.actor);
        for (const uuid of flag.effects ?? []) {
          const effect = fromUuidSync(uuid);
          if (!effect || entry.candidates.some(c => c.effect.uuid === effect.uuid)) continue;
          const copy = copyData(effect, sourceActor ?? actor, region.name);
          entry.candidates.push({ effect, copy, value: auraValue(effect, sourceActor ?? actor, copy) });
        }
      }
    }
  }
  // Auras that don't stack: the best of each name
  for (const entry of byActor.values()) {
    const best = new Map();
    const kept = [];
    for (const c of entry.candidates) {
      if (c.effect.system.aura?.canStack) {
        kept.push(c);
        continue;
      }
      const key = c.effect.name.trim().toLowerCase();
      const current = best.get(key);
      if (!current || c.value > current.value) best.set(key, c);
    }
    entry.copies = [...kept, ...best.values()].map(c => c.copy);
  }
  return byActor;
}

function copyChanged(existing, data) {
  return (
    existing.name !== data.name ||
    existing.img !== data.img ||
    JSON.stringify(existing.system.changes.map(c => [c.key, String(c.value), c.type, c.phase])) !==
      JSON.stringify(data.system.changes.map(c => [c.key, String(c.value), c.type, c.phase])) ||
    existing.getFlag('sdm', SOURCE_FLAG) !== data.flags.sdm[SOURCE_FLAG]
  );
}

async function syncActorCopies(actor, copies) {
  const existing = actor.effects.filter(isAuraCopy);
  const byOrigin = new Map(existing.map(e => [e.getFlag('sdm', COPY_FLAG), e]));
  const wanted = new Map(copies.map(c => [c.flags.sdm[COPY_FLAG], c]));
  const toDelete = existing.filter(e => !wanted.has(e.getFlag('sdm', COPY_FLAG))).map(e => e.id);
  const toCreate = [];
  const toUpdate = [];
  for (const [origin, data] of wanted) {
    const current = byOrigin.get(origin);
    if (!current) toCreate.push(data);
    else if (copyChanged(current, data)) {
      toUpdate.push({ _id: current.id, name: data.name, img: data.img, 'system.changes': data.system.changes, [`flags.sdm.${SOURCE_FLAG}`]: data.flags.sdm[SOURCE_FLAG] });
    }
  }
  if (toDelete.length) await actor.deleteEmbeddedDocuments('ActiveEffect', toDelete);
  if (toUpdate.length) await actor.updateEmbeddedDocuments('ActiveEffect', toUpdate);
  if (toCreate.length) await actor.createEmbeddedDocuments('ActiveEffect', toCreate);
}

/* -------------------------------------------- */
/*  Light                                       */
/* -------------------------------------------- */

const LIGHT_FLAG = 'auraLight'; // an actor's light from its aura: <aura effect uuid>

/** The light an aura gives its source token (settings in grid spaces, and the scene's grid distance), or null. */
function auraLightSettings(effect, token) {
  const aura = effect.system.aura;
  const preset = aura.lightPreset;
  if (!preset || preset === 'none') return null;
  const scene = token.parent;
  const unit = Number(scene.grid.distance) || 1;
  let settings;
  if (preset === 'reach') {
    // Dim to the aura's edge (from the token's middle), bright half of it
    const dim = auraDistance(effect, scene) / unit + (Number(token.width) || 1) / 2;
    settings = { ...getLightPreset('glow'), dim, bright: dim / 2 };
  } else {
    settings = { ...lightSettingsFrom({ preset, bright: aura.lightBright, dim: aura.lightDim, color: '', animation: '' }, 'glow') };
  }
  // The aura's color (or, for its reach and custom light, the owner's), and its animation when set
  const color = aura.color ? aura.color.css ?? String(aura.color) : preset === 'reach' || preset === 'custom' ? auraColor(effect, token.actor) : '';
  if (color) settings.color = color;
  if (aura.lightAnimation) settings.animation = aura.lightAnimation;
  return { settings, distance: unit };
}

/** The light effect an actor should have from its auras (the first aura with light), or null. */
function lightData(actor, token) {
  for (const effect of auraEffectsOf(actor)) {
    if (effect.system.aura.combatOnly && !inStartedCombat(token)) continue;
    const light = auraLightSettings(effect, token);
    if (!light) continue;
    return {
      name: effect.name,
      img: effect.img,
      transfer: false,
      disabled: false,
      system: { changes: buildChanges(light.settings, light.distance) },
      flags: { sdm: { [LIGHT_FLAG]: effect.uuid } }
    };
  }
  return null;
}

/** Put on, update or take off an actor's aura light. */
async function syncActorLight(actor, data) {
  const existing = actor.effects.filter(e => e.getFlag('sdm', LIGHT_FLAG));
  const [current, ...extra] = existing;
  if (extra.length || (current && !data)) await actor.deleteEmbeddedDocuments('ActiveEffect', (data ? extra : existing).map(e => e.id));
  if (!data) return;
  if (!current) return actor.createEmbeddedDocuments('ActiveEffect', [data]);
  const same =
    current.getFlag('sdm', LIGHT_FLAG) === data.flags.sdm[LIGHT_FLAG] &&
    JSON.stringify(current.system.changes.map(c => [c.key, String(c.value)])) === JSON.stringify(data.system.changes.map(c => [c.key, String(c.value)]));
  if (!same) await actor.updateEmbeddedDocuments('ActiveEffect', [{ _id: current.id, name: data.name, img: data.img, 'system.changes': data.system.changes, [`flags.sdm.${LIGHT_FLAG}`]: data.flags.sdm[LIGHT_FLAG] }]);
}

/* -------------------------------------------- */
/*  Sync                                        */
/* -------------------------------------------- */

/** The scenes people are on (the active one and those viewed): auras work there. */
function playedScenes() {
  const ids = new Set();
  if (game.scenes.active) ids.add(game.scenes.active.id);
  for (const user of game.users) if (user.active && user.viewedScene) ids.add(user.viewedScene);
  return [...ids].map(id => game.scenes.get(id)).filter(Boolean);
}

let running = false;
let pending = false;

async function syncAuras() {
  if (game.users.activeGM?.id !== game.user.id) return;
  if (running) {
    pending = true;
    return;
  }
  running = true;
  try {
    const enabled = aurasEnabled();
    const scenes = enabled ? playedScenes() : [...game.scenes];
    for (const scene of scenes) await syncSceneRegions(scene, enabled);
    const copies = enabled ? wantedCopies(scenes) : new Map();
    // Actors on these scenes, and world actors still holding copies from elsewhere
    for (const actor of game.actors) {
      if (!copies.has(actor.uuid) && actor.effects.some(isAuraCopy)) copies.set(actor.uuid, { actor, copies: [] });
    }
    for (const scene of scenes) {
      for (const token of scene.tokens) {
        const actor = token.actor;
        if (actor && !copies.has(actor.uuid) && actor.effects.some(isAuraCopy)) copies.set(actor.uuid, { actor, copies: [] });
      }
    }
    for (const { actor, copies: list } of copies.values()) await syncActorCopies(actor, list ?? []);
    // Light from auras: the source tokens' actors (hidden tokens shed none), and those that no longer have it
    const lights = new Map();
    if (enabled) {
      for (const scene of scenes) {
        for (const token of scene.tokens) {
          if (token.hidden || !token.actor || lights.get(token.actor.uuid)?.data) continue;
          lights.set(token.actor.uuid, { actor: token.actor, data: lightData(token.actor, token) });
        }
      }
    }
    for (const actor of game.actors) {
      if (!lights.has(actor.uuid) && actor.effects.some(e => e.getFlag('sdm', LIGHT_FLAG))) lights.set(actor.uuid, { actor, data: null });
    }
    for (const scene of scenes) {
      for (const token of scene.tokens) {
        const actor = token.actor;
        if (actor && !lights.has(actor.uuid) && actor.effects.some(e => e.getFlag('sdm', LIGHT_FLAG))) lights.set(actor.uuid, { actor, data: null });
      }
    }
    for (const { actor, data } of lights.values()) await syncActorLight(actor, data);
  } catch (error) {
    console.error('SDM | Aura update failed', error);
  } finally {
    running = false;
    if (pending) {
      pending = false;
      scheduleAuraSync();
    }
  }
}

export const scheduleAuraSync = foundry.utils.debounce(() => syncAuras(), 150);

/** A change that can move, add or remove auras or their copies (not the copies themselves). */
function onEffectChange(effect) {
  if (isAuraCopy(effect) || effect.getFlag?.('sdm', LIGHT_FLAG)) return;
  scheduleAuraSync();
}

function onRegionChange(region) {
  if (region.getFlag('sdm', REGION_FLAG) || region.getFlag('sdm', AREA_FLAG)?.linger) scheduleAuraSync();
}

/* -------------------------------------------- */
/*  Damage each round                           */
/* -------------------------------------------- */

/** True when the actor has an effect dealing damage each round to the last foe it attacked (Irresistible). */
export function hasLastFoeDamage(actor) {
  return [...(actor?.allApplicableEffects?.() ?? [])].some(
    e => e.active && e.system?.roundDamage?.formula && e.system.roundDamage.target === 'lastFoe'
  );
}

async function rollRoundDamage(effect, sourceActor) {
  const item = effect.parent?.documentName === 'Item' ? effect.parent : null;
  const formula = resolveFormulaReferences(effect.system.roundDamage.formula, { actor: sourceActor, item });
  try {
    const roll = await new Roll(formula, sourceActor.getRollData()).evaluate();
    return Math.max(Number(roll.total) || 0, 0);
  } catch (error) {
    console.warn(`SDM | ${effect.name}: damage each round "${formula}" could not be rolled`, error);
    return 0;
  }
}

/**
 * At the start of each round (the active GM): auras with damage each round hurt the tokens inside
 * (Glowing Skeleton, Mouth of the Void), and effects aimed at the last foe hurt it (Irresistible).
 */
/** The scenes a combat is on: the one it's linked to, else those of its combatants' tokens. */
export function combatScenes(combat) {
  return [...new Set([combat?.scene, ...(combat?.combatants ?? []).map(c => c.token?.parent ?? game.scenes.get(c.sceneId))].filter(Boolean))];
}

async function onCombatRound(combat, changed, options) {
  if (!('round' in (changed ?? {})) || !combat.started) return;
  if (options?.direction !== undefined && options.direction < 0) return;
  if (game.users.activeGM?.id !== game.user.id) return;
  const { changeLifeOf } = await import('../app/use-item.mjs');
  // The scenes the combat is on: its own, or (a combat not linked to a scene) its combatants'
  for (const scene of combatScenes(combat)) {
    // Lingering areas whose rounds are over go away (and with them their effects)
    if (scene) {
      const ended = scene.regions.filter(r => {
        const expires = r.getFlag('sdm', AREA_FLAG)?.expires;
        return expires && expires.combat === combat.id && combat.round >= expires.round;
      });
      if (ended.length) await scene.deleteEmbeddedDocuments('Region', ended.map(r => r.id));
    }
    if (scene && aurasEnabled()) {
      for (const region of scene.regions) {
        const flag = region.getFlag('sdm', REGION_FLAG);
        if (!flag) continue;
        const effect = fromUuidSync(flag.effect);
        const source = scene.tokens.get(flag.token);
        if (!effect?.system?.roundDamage?.formula || effect.system.roundDamage.target !== 'inside' || !source?.actor) continue;
        for (const token of region.tokens ?? []) {
          if (token === source || !token.actor || token.actor === source.actor) continue;
          if (!fitsDisposition(effect.system.aura, source, token)) continue;
          const amount = await rollRoundDamage(effect, source.actor);
          if (amount > 0) await changeLifeOf(token.actor, amount, { reason: effect.name });
        }
      }
    }
    // Lingering areas: their effects with damage each round (to the tokens inside) hurt whoever is in them
    if (scene && aurasEnabled()) {
      for (const region of scene.regions) {
        const flag = region.getFlag('sdm', AREA_FLAG);
        if (!flag?.linger) continue;
        const placer = fromUuidSync(flag.actor);
        for (const uuid of flag.effects ?? []) {
          const effect = fromUuidSync(uuid);
          if (!effect?.system?.roundDamage?.formula || effect.system.roundDamage.target !== 'inside') continue;
          for (const token of region.tokens ?? []) {
            if (!token.actor) continue;
            if (flag.affects === 'enemies' && flag.disposition !== null && token.disposition === flag.disposition) continue;
            if (flag.affects === 'allies' && flag.disposition !== null && token.disposition !== flag.disposition) continue;
            const amount = await rollRoundDamage(effect, placer ?? token.actor);
            if (amount > 0) await changeLifeOf(token.actor, amount, { reason: region.name });
          }
        }
      }
    }
  }
  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor || combatant.defeated) continue;
    const effects = [...actor.allApplicableEffects()].filter(
      e => e.active && e.system?.roundDamage?.formula && e.system.roundDamage.target === 'lastFoe'
    );
    if (!effects.length) continue;
    const foe = fromUuidSync(actor.getFlag('sdm', 'lastAttacked') ?? '');
    if (!foe || foe.documentName !== 'Actor') continue;
    for (const effect of effects) {
      const amount = await rollRoundDamage(effect, actor);
      if (amount > 0) await changeLifeOf(foe, amount, { reason: effect.name });
    }
  }
}

export function registerAuraSettings() {
  game.settings.register('sdm', SETTING, {
    name: 'SDM.SettingsEnableAuras',
    hint: 'SDM.SettingsEnableAurasHint',
    scope: 'world',
    restricted: true,
    type: Boolean,
    default: true,
    onChange: () => scheduleAuraSync()
  });
}

export function setupAuras() {
  for (const hook of ['createToken', 'updateToken', 'deleteToken']) Hooks.on(hook, () => scheduleAuraSync());
  for (const hook of ['createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect']) Hooks.on(hook, onEffectChange);
  for (const hook of ['createItem', 'updateItem', 'deleteItem', 'updateActor']) Hooks.on(hook, () => scheduleAuraSync());
  for (const hook of ['createCombat', 'updateCombat', 'deleteCombat', 'createCombatant', 'deleteCombatant']) {
    Hooks.on(hook, () => scheduleAuraSync());
  }
  for (const hook of ['createRegion', 'updateRegion', 'deleteRegion']) Hooks.on(hook, onRegionChange);
  Hooks.on('updateScene', () => scheduleAuraSync());
  Hooks.on('updateCombat', (combat, changed, options) => {
    onCombatRound(combat, changed, options).catch(error => console.error('SDM | Damage each round failed', error));
  });
  Hooks.on('updateUser', (user, changes) => {
    if ('viewedScene' in (changes ?? {})) scheduleAuraSync();
  });
  Hooks.on('canvasReady', () => scheduleAuraSync());
  Hooks.once('ready', () => {
    if (game.user.isGM && game.modules.get(AURA_EFFECTS_MODULE)?.active) {
      ui.notifications.warn($l10n('SDM.Aura.ModuleActive'));
    }
    scheduleAuraSync();
  });
}

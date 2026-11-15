import { ActorType, GearType, ItemStatusType, ItemType } from './constants.mjs';
import { $fmt, $l10n } from './globalUtils.mjs';
import { featureEnabled } from './features.mjs';
import { lastChargeUpdate } from './itemUtils.mjs';
import { getUsesCounter, spendUsesUpdate, usesLeft } from './itemUses.mjs';

/**
 * Token light from items (light category or glowing feature).
 * Optional (Core Rules setting "Item lights"): off, nothing lights and no light UI is shown.
 *
 * The light is an active effect on the actor whose changes override `token.light.*` (core v14
 * applies them to the actor's tokens), so the token's own light comes back when it is removed
 * and the light follows the character to other scenes. One light per actor: lighting another
 * item puts the current one out.
 *
 * Lighting spends, after the light is on: replenish → usage roll; charges → one charge; items
 * with neither (lamps, glowing gear) are free. The item must be readied, not broken and not run
 * out; running out, breaking, unreadying or deleting it puts the light out.
 */

export const LIGHT_FLAG = 'light';
const SPEND_OPTION = 'sdmLightSpend';
const HUD_CLASS = 'sdm-light-hud';
const LIGHT_PRIORITY = 100;

/** Default presets, radii in grid squares (converted with the scene's grid distance when lit). */
export const LIGHT_PRESETS = {
  torch: { bright: 4, dim: 8, color: '#ff9329', alpha: 0.4, animation: 'torch', speed: 5, intensity: 5 },
  lantern: { bright: 6, dim: 12, color: '#ffc46b', alpha: 0.35, animation: 'torch', speed: 2, intensity: 2 },
  candle: { bright: 1, dim: 2, color: '#ffb15c', alpha: 0.4, animation: 'torch', speed: 4, intensity: 3 },
  glow: { bright: 4, dim: 8, color: '#bfe3ff', alpha: 0.3, animation: 'pulse', speed: 2, intensity: 2 }
};

export const LIGHT_PRESET_KEYS = ['torch', 'lantern', 'candle', 'glow'];

/** A preset as the GM configured it (world setting), over the defaults. */
export function getLightPreset(name) {
  const base = LIGHT_PRESETS[name] ?? LIGHT_PRESETS.torch;
  let configured = {};
  try {
    configured = game.settings.get('sdm', 'lightPresets')?.[name] ?? {};
  } catch {
    configured = {};
  }
  const num = (value, fallback, min = 0, max = Infinity) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
  };
  return {
    bright: num(configured.bright, base.bright),
    dim: num(configured.dim, base.dim),
    color: typeof configured.color === 'string' ? configured.color : base.color,
    alpha: num(configured.alpha, base.alpha, 0, 1),
    animation: typeof configured.animation === 'string' ? configured.animation : base.animation,
    speed: num(configured.speed, base.speed, 0, 10),
    intensity: num(configured.intensity, base.intensity, 0, 10)
  };
}

export const LIGHT_PRESET_CHOICES = {
  '': 'SDM.Light.Preset.auto',
  torch: 'SDM.Light.Preset.torch',
  lantern: 'SDM.Light.Preset.lantern',
  candle: 'SDM.Light.Preset.candle',
  glow: 'SDM.Light.Preset.glow',
  custom: 'SDM.Light.Preset.custom'
};

/** Powers: no light unless a preset is chosen. */
export const POWER_LIGHT_PRESET_CHOICES = {
  none: 'SDM.Light.Preset.none',
  torch: 'SDM.Light.Preset.torch',
  lantern: 'SDM.Light.Preset.lantern',
  candle: 'SDM.Light.Preset.candle',
  glow: 'SDM.Light.Preset.glow',
  custom: 'SDM.Light.Preset.custom'
};

/** A trait with a light preset (Glowing Skeleton): it lights like a lamp, for free. */
export function isLightTrait(item) {
  if (item?.type !== ItemType.TRAIT) return false;
  const preset = item.system?.light?.preset;
  return !!preset && preset !== 'none';
}

/** Gear that can light up: light category, or glowing (feature or category) (not powers); traits with a light. */
export function isLightSource(item) {
  if (!featureEnabled('lights')) return false;
  if (isLightTrait(item)) return true;
  if (item?.type !== ItemType.GEAR) return false;
  const system = item.system;
  if (system.type === GearType.POWER || system.size?.unit === 'cash') return false;
  const categories = system.categories;
  return !!(categories?.has?.('light') || categories?.has?.('glowing') || system.features?.has?.('glowing'));
}

/** The light settings in effect: auto = torch for the light category, glow for glowing gear. */
export function getLightSettings(item) {
  const light = item.system.light ?? {};
  return lightSettingsFrom(light, item.system.categories?.has?.('light') ? 'torch' : 'glow');
}

/** Settings from a light field (fallback preset for auto). */
function lightSettingsFrom(light = {}, fallback = 'torch') {
  const preset = light.preset && light.preset !== 'none' ? light.preset : fallback;
  if (preset === 'custom') {
    return {
      bright: Math.max(Number(light.bright) || 0, 0),
      dim: Math.max(Number(light.dim) || 0, 0),
      color: light.color || '',
      alpha: 0.4,
      animation: light.animation || '',
      speed: 5,
      intensity: 5
    };
  }
  return getLightPreset(preset);
}

/** The light effect currently on the actor (only one). */
export function getLitEffect(actor) {
  if (!featureEnabled('lights')) return null;
  return actor?.effects?.find(effect => effect.getFlag('sdm', LIGHT_FLAG)) ?? null;
}

export function isLit(item) {
  if (!featureEnabled('lights')) return false;
  const effect = getLitEffect(item?.actor);
  return !!effect && effect.getFlag('sdm', LIGHT_FLAG)?.itemId === item.id;
}

/** Why the item cannot be lit now (localization key), or null. */
export function lightBlockedReason(item) {
  // Traits are always at hand
  if (isLightTrait(item)) return null;
  const system = item.system;
  if (!system.readied) return 'SDM.Light.NotReadied';
  if (system.status === ItemStatusType.BROKEN) return 'SDM.Light.Broken';
  if (system.resources === 'run_out') return 'SDM.Light.RunOut';
  const features = system.features;
  if (!features?.has?.('replenish') && getUsesCounter(item)) return usesLeft(item) > 0 ? null : 'SDM.Light.NoUses';
  if (!features?.has?.('replenish') && features?.has?.('charges') && (Number(system.charges?.value) || 0) <= 0) {
    return 'SDM.Light.NoCharges';
  }
  return null;
}

/** Items of the actor that can light (lit ones included, so they can be put out). */
export function getLightItems(actor) {
  if (!actor || actor.type === ActorType.CARAVAN) return [];
  return actor.items.filter(item => isLightSource(item) && (isLit(item) || !lightBlockedReason(item)));
}

function gridDistance(actor) {
  const token = actor.getActiveTokens(false, true)[0];
  return Number(token?.parent?.grid?.distance ?? canvas?.scene?.grid?.distance) || 5;
}

function buildChanges(settings, distance) {
  const entry = (key, value) => ({ key: `token.light.${key}`, value, type: 'override', phase: 'initial', priority: LIGHT_PRIORITY });
  return [
    entry('dim', settings.dim * distance),
    entry('bright', settings.bright * distance),
    entry('angle', 360),
    entry('color', settings.color || ''),
    entry('alpha', settings.alpha),
    entry('negative', false),
    entry('animation.type', settings.animation || ''),
    entry('animation.speed', settings.speed),
    entry('animation.intensity', settings.intensity),
    entry('animation.reverse', false)
  ];
}

/** Does casting this power create light? */
export function powerCreatesLight(power) {
  if (!featureEnabled('lights')) return false;
  const preset = power?.light?.preset;
  return !!preset && preset !== 'none';
}

/** Casting a power that creates light: the caster's token lights up (nothing spent; one light at a time). */
export async function lightFromPower(actor, power) {
  if (!actor?.isOwner || actor.type === ActorType.CARAVAN || !powerCreatesLight(power)) return;
  const current = getLitEffect(actor);
  if (current) await current.delete();
  await actor.createEmbeddedDocuments('ActiveEffect', [
    {
      name: $fmt('SDM.Light.EffectName', { name: power.name }),
      img: power.img || 'icons/svg/light.svg',
      transfer: false,
      system: { changes: buildChanges(lightSettingsFrom(power.light), gridDistance(actor)) },
      flags: { sdm: { [LIGHT_FLAG]: { power: power.name } } }
    }
  ]);
}

/** Spend what lighting costs (after the light is on). The light stays on for this time. */
async function spendForLight(item) {
  const system = item.system;
  const options = { [SPEND_OPTION]: true };
  if (system.features?.has?.('replenish')) {
    await item.spendUsage(options);
    return;
  }
  if (getUsesCounter(item)) {
    const update = spendUsesUpdate(item);
    if (update) await item.update(update, options);
    return;
  }
  if (system.features?.has?.('charges')) {
    const charges = Math.max((Number(system.charges?.value) || 0) - 1, 0);
    await item.update(
      {
        'system.charges.value': charges,
        ...(charges === 0 ? { 'system.resources': 'run_out' } : lastChargeUpdate(item, charges))
      },
      options
    );
  }
  // Neither: lamps and glowing gear light for free
}

export async function lightItem(item) {
  const actor = item?.actor;
  if (!actor?.isOwner || !isLightSource(item)) return;
  if (isLit(item)) return;
  const reason = lightBlockedReason(item);
  if (reason) {
    ui.notifications.warn($fmt(reason, { name: item.name }));
    return;
  }
  const current = getLitEffect(actor);
  if (current) await current.delete();
  const [created] = await actor.createEmbeddedDocuments('ActiveEffect', [
    {
      name: $fmt('SDM.Light.EffectName', { name: item.name }),
      img: item.img,
      origin: item.uuid,
      transfer: false,
      system: { changes: buildChanges(getLightSettings(item), gridDistance(actor)) },
      flags: { sdm: { [LIGHT_FLAG]: { itemId: item.id } } }
    }
  ]);
  if (!created) return;
  await spendForLight(item);
}

export async function putOutLight(actor, { itemId } = {}) {
  const effect = getLitEffect(actor);
  if (!effect) return;
  if (itemId && effect.getFlag('sdm', LIGHT_FLAG)?.itemId !== itemId) return;
  await effect.delete();
}

export async function toggleLight(item) {
  if (isLit(item)) return putOutLight(item.actor, { itemId: item.id });
  return lightItem(item);
}

/* ---------------- Hooks ---------------- */

/** Running out, breaking or unreadying a lit item puts its light out. */
function onUpdateItem(item, changes, options, userId) {
  if (userId !== game.user.id || options?.[SPEND_OPTION]) return;
  if (!item.actor || !isLit(item)) return;
  const system = foundry.utils.getProperty(changes, 'system') ?? {};
  const putOut =
    system.resources === 'run_out' ||
    system.status === ItemStatusType.BROKEN ||
    system.readied === false ||
    !isLightSource(item);
  if (putOut) return putOutLight(item.actor, { itemId: item.id });
  // New light settings while lit: update the light
  if ('light' in system) {
    getLitEffect(item.actor)?.update({
      'system.changes': buildChanges(getLightSettings(item), gridDistance(item.actor))
    });
  }
}

function onDeleteItem(item, options, userId) {
  if (userId !== game.user.id || !item.actor) return;
  putOutLight(item.actor, { itemId: item.id });
}

/** Token HUD: a flame button; one light item toggles it, several open a small palette. */
function onRenderTokenHUD(hud, html) {
  if (!featureEnabled('lights')) return;
  const token = hud?.document ?? hud?.object?.document;
  const actor = token?.actor;
  if (!actor?.isOwner) return;
  const lit = getLitEffect(actor);
  // A power's light (no item behind it) can be put out from here too
  const powerLight = lit && !lit.getFlag('sdm', LIGHT_FLAG)?.itemId ? lit : null;
  const entries = getLightItems(actor).map(item => ({
    name: item.name,
    img: item.img,
    lit: isLit(item),
    toggle: () => toggleLight(item)
  }));
  if (powerLight) {
    entries.unshift({ name: powerLight.name, img: powerLight.img, lit: true, toggle: () => powerLight.delete() });
  }
  if (!entries.length) return;
  const root = html?.querySelectorAll ? html : html?.[0];
  if (!root || root.querySelector(`.${HUD_CLASS}`)) return;

  const wrapper = document.createElement('div');
  wrapper.classList.add(HUD_CLASS);
  const button = document.createElement('button');
  button.type = 'button';
  button.classList.add('control-icon', 'sdm-light-toggle');
  if (lit) button.classList.add('active');
  const label = lit ? $l10n('SDM.Light.PutOut') : $l10n('SDM.Light.Light');
  button.dataset.tooltip = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = '<i class="fa-solid fa-fire-flame-curved" inert></i>';

  const palette = document.createElement('div');
  palette.classList.add('sdm-light-palette');
  for (const light of entries) {
    const entry = document.createElement('button');
    entry.type = 'button';
    entry.classList.add('sdm-light-entry');
    if (light.lit) entry.classList.add('lit');
    entry.innerHTML = '<img width="24" height="24" inert/><span inert></span>';
    entry.querySelector('img').src = light.img;
    entry.querySelector('span').textContent = light.name;
    entry.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      palette.classList.remove('open');
      await light.toggle();
      hud.render();
    });
    palette.append(entry);
  }

  button.addEventListener('click', async event => {
    event.preventDefault();
    event.stopPropagation();
    if (entries.length === 1) {
      await entries[0].toggle();
      hud.render();
    } else palette.classList.toggle('open');
  });

  wrapper.append(button, palette);
  (root.querySelector('.col.left') ?? root).append(wrapper);
}

/** The GM turned item lights off: put out every light (world actors and unlinked tokens). Active GM only. */
export async function putOutAllLights() {
  if (!game.users.activeGM?.isSelf) return;
  const actors = new Set(game.actors);
  for (const scene of game.scenes) {
    for (const token of scene.tokens) if (!token.actorLink && token.actor) actors.add(token.actor);
  }
  for (const actor of actors) {
    const ids = actor.effects.filter(effect => effect.getFlag('sdm', LIGHT_FLAG)).map(effect => effect.id);
    if (ids.length) await actor.deleteEmbeddedDocuments('ActiveEffect', ids);
  }
}

/**
 * NPCs with natural light (a trait with a light) enter the scene lit: nobody has to light them.
 * The creating user lights the token's actor (a linked NPC already lit stays as it is).
 */
async function onCreateNpcToken(token, options, userId) {
  if (userId !== game.user.id || !featureEnabled('lights')) return;
  const actor = token.actor;
  if (actor?.type !== ActorType.NPC || getLitEffect(actor)) return;
  const trait = actor.items.find(isLightTrait);
  if (trait) await lightItem(trait);
}

export function setupLights() {
  Hooks.on('createToken', onCreateNpcToken);
  Hooks.on('updateItem', onUpdateItem);
  Hooks.on('deleteItem', onDeleteItem);
  Hooks.on('renderTokenHUD', onRenderTokenHUD);
}

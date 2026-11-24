import { ItemType } from '../helpers/constants.mjs';
import { areaBlock, areaDamageReduction, areaState, itemArea, lingerEffects, placeArea, requestAreaSaves } from '../helpers/areas.mjs';
import { createChatMessage } from '../helpers/chatUtils.mjs';
import { cardHeader, cardWrap } from '../rolls/ui/cardParts.mjs';
import { resolveFormula, showSideDice } from '../helpers/formulas.mjs';
import { lastChargeUpdate } from '../helpers/itemUtils.mjs';
import { canRefillUses, getUsesCounter, spendUsesUpdate, usesLeft } from '../helpers/itemUses.mjs';
import { $fmt, $l10n } from '../helpers/globalUtils.mjs';
import { deleteEffects } from '../helpers/deleteEffects.mjs';
import { getItemIdentifier } from '../helpers/effectReferences.mjs';

/**
 * Using consumables (gear with the consumable feature) (separate from the caravan's Consume Supply).
 * "Use" restores life or an ability point (rolled formulas) and copies the item's effects onto
 * the targets as temporary effects (removed by hand), then spends the item:
 *  - replenish: the usage roll (charges are left alone),
 *  - charges: one charge (at 0 the item has run out),
 *  - otherwise one of its quantity (the item is removed at 0).
 * Targets: the targeted tokens, else the selected ones, else the user's own character.
 * Actors the user does not own are changed by the active Referee.
 */

const CHANNEL = 'system.sdm';
const APPLY_ACTION = 'useItemApply';
const { DialogV2 } = foundry.applications.api;
const esc = text => foundry.utils.escapeHTML?.(String(text ?? '')) ?? String(text ?? '');

/** "full": restore everything (all missing life / all ability points) instead of a roll. */
export const isFullRestore = formula => `${formula ?? ''}`.trim().toLowerCase() === 'full';

/** Gear with the consumable feature. */
export function isUsable(item) {
  return item?.type === ItemType.GEAR && !!item.system?.features?.has?.('consumable');
}

export function setupUseItem() {
  game.socket.on(CHANNEL, message => {
    if (message?.action !== APPLY_ACTION) return;
    if (game.users.activeGM?.id !== game.user.id) return;
    applyToActor(message.payload).catch(error => console.error('SDM | Use item failed', error));
  });
  // A temporary life effect ended (expired, deleted or disabled): the temporary life left is capped
  Hooks.on('deleteActiveEffect', (effect, options, userId) => onTempLifeEffectGone(effect, userId));
  Hooks.on('updateActiveEffect', (effect, changes, options, userId) => {
    if (changes.disabled === true) onTempLifeEffectGone(effect, userId);
  });
}

const TEMP_LIFE_FLAG = 'tempLife';

async function onTempLifeEffectGone(effect, userId) {
  if (userId !== game.user.id || !effect.getFlag('sdm', TEMP_LIFE_FLAG)) return;
  const actor = effect.parent;
  const temp = actor?.documentName === 'Actor' ? actor.system.temporary_life : null;
  if (!temp) return;
  // No other source: nothing left; otherwise at most the new maximum
  const cap = temp.enabled ? Math.max(Number(temp.max) || 0, 0) : 0;
  if ((Number(temp.value) || 0) > cap) await actor.update({ 'system.temporary_life.value': cap });
}

/**
 * Temporary life from a consumable: an effect (named after the item, lasting as long as its effects)
 * turns temporary life on and raises its maximum by the amount; the current temporary life rises by
 * the same amount. When the effect ends the maximum drops back and the rest is capped. Doses stack.
 */
async function grantTemporaryLife(actor, { amount, name, img, origin, duration }) {
  if (!actor.system.temporary_life || !('enabled' in actor.system.temporary_life)) return;
  const data = {
    name: $fmt('SDM.Use.TempLifeEffect', { item: name ?? '' }),
    img: img || 'icons/svg/regen.svg',
    origin,
    transfer: false,
    system: {
      changes: [
        { key: 'system.temporary_life.enabled', type: 'override', value: true, phase: 'initial', priority: null },
        { key: 'system.temporary_life.max', type: 'add', value: amount, phase: 'initial', priority: null }
      ]
    },
    flags: { sdm: { temporary: true, [TEMP_LIFE_FLAG]: amount } }
  };
  if (duration) data.duration = duration;
  await actor.createEmbeddedDocuments('ActiveEffect', [data]);
  const temp = actor.system.temporary_life;
  const value = Math.min((Number(temp.value) || 0) + amount, Math.max(Number(temp.max) || 0, 0));
  await actor.update({ 'system.temporary_life.value': value });
}

function getTargets(actor) {
  const fromTokens = tokens => [...new Set([...tokens].map(token => token.actor).filter(Boolean))];
  const targeted = fromTokens(game.user.targets ?? []);
  if (targeted.length) return targeted;
  const selected = fromTokens(canvas?.tokens?.controlled ?? []);
  if (selected.length) return selected;
  return [actor];
}

/** Abilities a consumable can restore: any, only physical or only mental. */
export const ABILITY_GROUPS = { physical: ['str', 'end', 'agi'], mental: ['cha', 'aur', 'tho'] };

function abilityKeys(group) {
  const all = Object.keys(CONFIG.SDM.abilities);
  return ABILITY_GROUPS[group] ? all.filter(key => ABILITY_GROUPS[group].includes(key)) : all;
}

function abilityOptions(group) {
  return abilityKeys(group)
    .map(key => `<option value="${key}">${esc($l10n(CONFIG.SDM.abilities[key]))}</option>`)
    .join('');
}

/** Label of the ability restore, naming the group when it is limited. */
function abilityLabel(use) {
  const group = ABILITY_GROUPS[use.ability_group] ? $l10n(`SDM.Use.Group.${use.ability_group}`) : '';
  if (isFullRestore(use.ability)) return group ? $fmt('SDM.Use.RestoreAllGroup', { group }) : $l10n('SDM.Use.RestoreAllAbilities');
  return group ? $fmt('SDM.Use.RestoreGroup', { formula: esc(use.ability), group }) : $fmt('SDM.Use.RestoreAbility', { formula: esc(use.ability) });
}

/**
 * What this use does, picked with checkboxes when there is more than one option: restore life,
 * restore an ability (which one), grant temporary life, apply the item's effects (Black Light
 * Lotus: smoke it to heal, apply it for the charisma, or both). Only the first option starts ticked.
 * Harm and the roll table are not options: they always happen.
 * Returns { life, ability, abilityKey, tempLife, effects } (booleans), or null when closed.
 */
async function chooseUse(use, effects) {
  const hasLife = !!use.life?.trim();
  const hasAbility = !!use.ability?.trim();
  const hasTemp = !!use.temp_life?.trim();
  const hasEffects = effects.length > 0;
  const count = hasLife + hasAbility + hasTemp + hasEffects;
  const abilityFull = isFullRestore(use.ability);
  if (count <= 1) {
    return {
      life: hasLife,
      ability: hasAbility,
      abilityKey: null,
      tempLife: hasTemp,
      effects: hasEffects,
      askAbility: hasAbility && !abilityFull
    };
  }

  const first = hasLife ? 'life' : hasAbility ? 'ability' : hasTemp ? 'tempLife' : 'effects';
  const box = (kind, label) =>
    `<label class="sdm-upgrade-choice"><input type="checkbox" name="${kind}" ${kind === first ? 'checked' : ''} /> ${label}</label>`;
  const meantFor = use.for?.trim() ? `<p class="hint">${$fmt('SDM.Use.For', { for: esc(use.for.trim()) })}</p>` : '';
  const content = `<div class="sdm-upgrade">${meantFor}
      ${hasLife ? box('life', isFullRestore(use.life) ? $l10n('SDM.Use.RestoreAllLife') : $fmt('SDM.Use.RestoreLife', { formula: esc(use.life) })) : ''}
      ${hasAbility ? box('ability', abilityLabel(use)) + (abilityFull ? '' : `<div class="sdm-upgrade-detail"><select name="abilityKey">${abilityOptions(use.ability_group)}</select></div>`) : ''}
      ${hasTemp ? box('tempLife', $fmt('SDM.Use.TempLife', { formula: esc(use.temp_life) })) : ''}
      ${hasEffects ? box('effects', $fmt('SDM.Use.ApplyEffects', { effects: effects.map(e => esc(e.name)).join(', ') })) : ''}
    </div>`;
  return DialogV2.prompt({
    window: { title: $l10n('SDM.Use.Title'), icon: 'fa-solid fa-hand-holding-medical' },
    content,
    rejectClose: false,
    render: (event, dialog) => {
      // Picking an ability ticks the ability option
      const form = dialog.element.querySelector('form') ?? dialog.element;
      form.querySelector('select[name="abilityKey"]')?.addEventListener('focus', () => {
        const option = form.querySelector('input[name="ability"]');
        if (option) option.checked = true;
      });
    },
    ok: {
      label: $l10n('SDM.Use.Confirm'),
      callback: (event, button) => {
        const checked = name => !!button.form.querySelector(`input[name="${name}"]`)?.checked;
        return {
          life: checked('life'),
          ability: checked('ability'),
          abilityKey: button.form.elements.abilityKey?.value,
          tempLife: checked('tempLife'),
          effects: checked('effects')
        };
      }
    }
  });
}

/** Ask only which ability (single option: restore an ability), among its group. */
async function chooseAbility(group = '') {
  return DialogV2.prompt({
    window: { title: $l10n('SDM.Use.Title'), icon: 'fa-solid fa-hand-holding-medical' },
    content: `<div class="sdm-upgrade"><select name="abilityKey">${abilityOptions(group)}</select></div>`,
    rejectClose: false,
    ok: { label: $l10n('SDM.Use.Confirm'), callback: (event, button) => button.form.elements.abilityKey.value }
  });
}

/** The effect duration of a use, as active effect duration data (null: until removed by hand). */
function useDuration(use) {
  return durationData(use?.duration?.value, use?.duration?.units);
}

/**
 * An effect's duration (V14 shape) from a number and a unit: rounds end at the end of a turn,
 * minutes … weeks become seconds of world time (a calendar module advancing it expires them).
 * null when there is none.
 */
export function durationData(amount, units) {
  const value = Number(amount) || 0;
  if (!value || !units) return null;
  if (units === 'rounds') return { value, units: 'rounds', expiry: 'turnEnd' };
  const seconds = { minutes: 60, hours: 3600, days: 86400, weeks: 604800 }[units];
  return seconds ? { value: value * seconds, units: 'seconds' } : null;
}

/** Restoration and effects on one actor (here, or by the active Referee for actors the user does not own). */
async function applyToActor({ actorUuid, restores = [], restore, effects }) {
  const actor = await fromUuid(actorUuid);
  if (!actor) return;
  if (restore) restores = [restore]; // older clients
  for (const restore of restores) {
    // Ability damage: the ability's current score drops (never below 0)
    if (restore?.kind === 'abilityDamage' && restore.ability && restore.amount > 0) {
      const current = Number(actor.system?.abilities?.[restore.ability]?.current);
      if (!Number.isFinite(current)) continue;
      const next = Math.max(current - restore.amount, 0);
      if (next === current) continue;
      await actor.update({ [`system.abilities.${restore.ability}.current`]: next });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<p><i class="fa-solid fa-heart-crack"></i> ${$fmt('SDM.Trigger.AbilityDamageChat', {
          actor: esc(actor.name),
          amount: current - next,
          ability: esc($l10n(CONFIG.SDM.abilities[restore.ability])),
          source: esc(restore.reason ?? '')
        })}</p>`
      });
      continue;
    }
    // A replenisher: the item picked when it was used is recharged (it is this actor's)
    if (restore?.kind === 'replenish') {
      const target = fromUuidSync(restore.itemUuid ?? '');
      if (target?.actor === actor) {
        const { rechargeItem } = await import('../rolls/triggers.mjs');
        await rechargeItem(target);
        // …and its counters that recharge back to their reset value
        const counters = rechargeableCounters(target);
        if (counters.length) await target.update(Object.fromEntries(counters.map(([key, counter]) => [`system.counters.${key}.value`, counter.reset_value ?? 0])));
      }
      continue;
    }
    // Purge: the effects other consumables copied onto this actor go
    if (restore?.kind === 'purge') {
      await purgeEffectsOf(actor, restore.usedItem);
      continue;
    }
    // Overdose: one more dose in the period; past the free ones, a save (harder each dose if escalating)
    if (restore?.kind === 'overdose') {
      await overdoseDose(actor, restore);
      continue;
    }
    // A rest: the rest dialog for this actor (its owner, or the Referee for actors the user doesn't own)
    if (restore?.kind === 'rest') {
      const { restActor } = await import('./rest.mjs');
      await restActor(actor);
      continue;
    }
    // Cures: remove the actor's own conditions (not those given by its items)
    if (restore?.kind === 'cure' && restore.statuses?.length) {
      const ids = actor.effects.filter(e => [...(e.statuses ?? [])].some(s => restore.statuses.includes(s))).map(e => e.id);
      if (ids.length) await deleteEffects(actor, ids);
      continue;
    }
    // Effects by id (a Referee's next-roll modifier, used by a roll)
    if (restore?.kind === 'deleteEffects' && restore.ids?.length) {
      const ids = restore.ids.filter(id => actor.effects.has(id));
      if (ids.length) await deleteEffects(actor, ids);
      continue;
    }
    // An item's effect copied by a trigger, taken off again (hero dice turned its save around)
    if (restore?.kind === 'uneffect' && restore.usedItem) {
      const ids = actor.effects
        .filter(e => e.getFlag('sdm', 'usedItem') === restore.usedItem && (!restore.name || e.name === restore.name))
        .map(e => e.id);
      if (ids.length) await deleteEffects(actor, ids);
      continue;
    }
    if (restore?.full) {
      await restoreAll(actor, restore.kind, restore.group);
      continue;
    }
    // Harm: life lost by whoever takes it (temporary life first, like damage)
    if (restore?.kind === 'harm' && restore.amount > 0) {
      await actor.applyDamage(restore.amount, 1, false, true, { reason: restore.reason ?? '' });
      continue;
    }
    // Healing (undoing damage applied automatically)
    if (restore?.kind === 'heal' && restore.amount > 0) {
      await actor.applyDamage(restore.amount, -1, false, true, { reason: restore.reason ?? '' });
      continue;
    }
    // Temporary life: an effect for as long as the item's effects last (actors without temporary life get none)
    if (restore?.kind === 'temp_life' && restore.amount > 0) {
      await grantTemporaryLife(actor, restore);
      continue;
    }
    if (restore?.kind === 'life' && restore.amount > 0) {
      await actor.applyDamage(restore.amount, -1, false, true);
    } else if (restore?.kind === 'ability' && restore.amount > 0 && actor.system.abilities?.[restore.ability]) {
      const ability = actor.system.abilities[restore.ability];
      const full = ability.full ?? (ability.base ?? 0) + (ability.bonus ?? 0);
      const current = Math.min((Number(ability.current) || 0) + restore.amount, full);
      await actor.update({ [`system.abilities.${restore.ability}.current`]: current });
    }
  }
  if (effects?.length) await actor.createEmbeddedDocuments('ActiveEffect', effects);
}

/** All missing life (to its maximum), or every ability back to full (only physical / mental with a group). */
export async function restoreAll(actor, kind, group = '') {
  if (kind === 'life') {
    const life = actor.system.life;
    if (life && life.value < life.max) await actor.update({ 'system.life.value': life.max });
    return;
  }
  const update = {};
  for (const [key, ability] of Object.entries(actor.system.abilities ?? {})) {
    if (ABILITY_GROUPS[group] && !ABILITY_GROUPS[group].includes(key)) continue;
    const full = ability.full ?? (ability.base ?? 0) + (ability.bonus ?? 0);
    if ((Number(ability.current) || 0) < full) update[`system.abilities.${key}.current`] = full;
  }
  if (!foundry.utils.isEmpty(update)) await actor.update(update);
}

/**
 * A roll trigger's condition: a status of the Token HUD list put on the user's targeted tokens (or on
 * the one who rolled), like setting it from the HUD; actors that already have it are skipped.
 * Targets the user doesn't own are handled by the active GM.
 */
export async function applyStatusToTargets(
  statusId,
  actor,
  { self = false, remove = false, targets: given = null, rounds = 0, duration = null, save = null, silent = false } = {}
) {
  const status = CONFIG.statusEffects.find(s => s.id === statusId);
  if (!status) return;
  const name = game.i18n.localize(status.name ?? status.label ?? statusId);
  // Apply: those that don't have it yet; remove: those that have it. `given`: these actors instead
  // of the user's targets (a card button names its target)
  const candidates = given
    ? given.filter(Boolean)
    : self
      ? [actor].filter(Boolean)
      : [...new Set([...(game.user.targets ?? [])].map(token => token.actor).filter(Boolean))];
  const targets = candidates.filter(target => !!target.statuses?.has(statusId) === remove);
  if (!targets.length) {
    if (!given && !self && !game.user.targets?.size) ui.notifications.info($fmt('SDM.Trigger.NoTarget', { effect: name }));
    return;
  }
  // A save allowed: each target saves first (see save-against.mjs) and gets it only on a failure
  if (save && !remove) {
    const { saveAgainst } = await import('./save-against.mjs');
    for (const target of targets) {
      await saveAgainst(target, { status: statusId, rounds, duration, source: save.source ?? '', ability: save.ability ?? '', difficulty: save.difficulty ?? '' });
    }
    return;
  }
  const data = remove ? null : (await ActiveEffect.implementation.fromStatusEffect(statusId)).toObject();
  // How long it lasts: a duration given (a trigger's), else a number of rounds (a feature button's)
  const lasts = duration ?? (rounds > 0 ? durationData(rounds, 'rounds') : null);
  if (data && lasts) data.duration = { ...(data.duration ?? {}), ...lasts };
  for (const target of targets) {
    const payload = remove
      ? { actorUuid: target.uuid, restores: [{ kind: 'cure', statuses: [statusId] }], effects: [] }
      : { actorUuid: target.uuid, restores: [], effects: [data] };
    if (target.isOwner) await applyToActor(payload);
    else if (game.users.activeGM) game.socket.emit(CHANNEL, { action: APPLY_ACTION, payload });
    else ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
  }
  if (!silent) await conditionLine(actor, targets, name, remove);
}

/**
 * The chat line for a condition or effect put on / taken off: "Bob: Grabbed" ("Bob: no longer
 * Grabbed"), in the name of the one who got it (the roller's when several did). `silent`: the save
 * card already says it (a failed save, no sacrifice, hero dice).
 */
async function conditionLine(actor, targets, name, remove) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: targets.length === 1 ? targets[0] : actor }),
    content: `<div class="sdm-card"><div class="sdm-card-tag info"><i class="fa-solid fa-bolt"></i> ${$fmt(remove ? 'SDM.Trigger.StatusRemoved' : 'SDM.Trigger.EffectApplied', {
      effect: esc(name),
      targets: targets.map(t => esc(t.name)).join(', ')
    })}</div></div>`
  });
}

/** Delete some of an actor's effects, here when the user owns it, else by the active Referee. */
export async function deleteEffectsOf(actor, ids = []) {
  if (!actor || !ids.length) return;
  const payload = { actorUuid: actor.uuid, restores: [{ kind: 'deleteEffects', ids }], effects: [] };
  if (actor.isOwner) await applyToActor(payload);
  else if (game.users.activeGM) game.socket.emit(CHANNEL, { action: APPLY_ACTION, payload });
}

/**
 * Damage (or healing) on one actor, here when the user owns it, else by the active Referee — for
 * damage applied automatically to the target of a damage roll, and its undo.
 */
export async function changeLifeOf(actor, amount, { heal = false, reason = '' } = {}) {
  const value = Number(amount) || 0;
  if (!actor || value <= 0) return false;
  const payload = { actorUuid: actor.uuid, restores: [{ kind: heal ? 'heal' : 'harm', amount: value, ...(reason ? { reason } : {}) }], effects: [] };
  if (actor.isOwner) await applyToActor(payload);
  else if (game.users.activeGM) game.socket.emit(CHANNEL, { action: APPLY_ACTION, payload });
  else {
    ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
    return false;
  }
  return true;
}

/** Temporary life for an actor (through the Referee when the user doesn't own it): Colonist's night with the hexad. */
export async function giveTemporaryLife(actor, amount, { name = '', img = '' } = {}) {
  const value = Number(amount) || 0;
  if (!actor || value <= 0) return false;
  const payload = { actorUuid: actor.uuid, restores: [{ kind: 'temp_life', amount: value, name, img }], effects: [] };
  if (actor.isOwner) await applyToActor(payload);
  else if (game.users.activeGM) game.socket.emit(CHANNEL, { action: APPLY_ACTION, payload });
  else {
    ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
    return false;
  }
  return true;
}

/** "poisoned, bleeding" */
export function statusNames(ids = []) {
  return ids
    .map(id => CONFIG.statusEffects.find(s => s.id === id))
    .filter(Boolean)
    .map(s => game.i18n.localize(s.name ?? s.label ?? s.id).toLowerCase())
    .join(', ');
}

/**
 * A roll trigger's effect: one of the item's effects (keep it disabled or not applied to the bearer
 * on the item) copied to the user's targeted tokens as a temporary effect, like Use.
 */
export async function applyItemEffectToTargets(item, effectId, actor, { self = false, targets: given = null, save = null, remove = false, silent = false } = {}) {
  const effects = effectsToCopy(item).filter((data, index) => item.effects.contents[index]?.id === effectId);
  if (!effects.length) return;
  // "self": the one who rolled; `given`: these actors; otherwise the user's targeted tokens
  const targets = given
    ? given.filter(Boolean)
    : self
      ? [actor ?? item.actor].filter(Boolean)
      : [...new Set([...(game.user.targets ?? [])].map(token => token.actor).filter(Boolean))];
  if (!targets.length) {
    if (!given) ui.notifications.info($fmt('SDM.Trigger.NoTarget', { effect: effects[0].name }));
    return;
  }
  // A save allowed: each target saves first (see save-against.mjs) and gets it only on a failure
  if (save) {
    const { saveAgainst } = await import('./save-against.mjs');
    const statuses = [...(effects[0].statuses ?? [])];
    for (const target of targets) {
      await saveAgainst(target, {
        effect: { item: item.uuid, id: effectId, name: effects[0].name },
        status: statuses[0] ?? '',
        source: save.source ?? item.name,
        ability: save.ability ?? '',
        difficulty: save.difficulty ?? ''
      });
    }
    return;
  }
  // Taken off again (hero dice turned a failed save into a success)
  if (remove) {
    for (const target of targets) {
      const payload = { actorUuid: target.uuid, restores: [{ kind: 'uneffect', usedItem: item.uuid, name: effects[0].name }], effects: [] };
      if (target.isOwner) await applyToActor(payload);
      else if (game.users.activeGM) game.socket.emit(CHANNEL, { action: APPLY_ACTION, payload });
    }
    if (!silent) await conditionLine(actor, targets, effects[0].name, true);
    return;
  }
  for (const target of targets) {
    const payload = { actorUuid: target.uuid, restores: [], effects };
    if (target.isOwner) await applyToActor(payload);
    else if (game.users.activeGM) game.socket.emit(CHANNEL, { action: APPLY_ACTION, payload });
    else ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
  }
  if (!silent) await conditionLine(actor, targets, effects[0].name, false);
}

/** The item's effects, as temporary effects of the target (removed by hand). */
function effectsToCopy(item) {
  return item.effects.map(effect => {
    const data = effect.toObject();
    delete data._id;
    data.origin = item.uuid;
    data.transfer = false;
    data.disabled = false;
    foundry.utils.setProperty(data, 'flags.sdm.temporary', true);
    foundry.utils.setProperty(data, 'flags.sdm.usedItem', item.uuid);
    return data;
  });
}

/**
 * Tooltip of the Use icon: a short list of what using it does (restores, effects, harm, table).
 * Returns HTML (the tooltip renders it).
 */
export function describeUse(item) {
  const system = item?.system;
  if (!system) return $l10n('SDM.Use.Action');
  const use = system.use ?? {};
  const lines = [];
  if (use.life?.trim()) lines.push(isFullRestore(use.life) ? $l10n('SDM.Use.RestoreAllLife') : $fmt('SDM.Use.RestoreLife', { formula: esc(use.life) }));
  if (use.ability?.trim()) {
    lines.push(
      isFullRestore(use.ability) || ABILITY_GROUPS[use.ability_group]
        ? abilityLabel(use)
        : $fmt('SDM.Use.Tip.RestoreAbility', { formula: esc(use.ability) })
    );
  }
  if (use.temp_life?.trim()) lines.push($fmt('SDM.Use.TempLife', { formula: esc(use.temp_life) }));
  const effects = item.effects?.contents ?? [...(item.effects ?? [])];
  if (effects.length) {
    const lasts = describeDuration(use);
    lines.push($fmt('SDM.Use.Tip.Effects', { effects: effects.map(e => esc(e.name)).join(', ') }) + (lasts ? ` (${lasts})` : ''));
  }
  // Always happen (not options)
  const always = [];
  if (use.harm?.trim()) always.push($fmt('SDM.Use.Tip.Harm', { formula: esc(use.harm) }));
  if (use.cures?.length) always.push($fmt('SDM.Use.ChatCures', { conditions: esc(statusNames(use.cures)) }));
  if (use.rest) always.push($l10n('SDM.Use.ChatRest'));
  if (hasUseActions(use.actions)) always.push($l10n('SDM.Use.Tip.Actions'));
  if (use.purge) always.push($l10n('SDM.Use.ChatPurge'));
  if (use.replenishes) always.push($l10n(`SDM.Use.Replenishes.${use.replenishes}`));
  if (use.overdose?.status || use.overdose?.effect) always.push($l10n('SDM.Use.Tip.Overdose'));
  if (use.for?.trim()) always.push($fmt('SDM.Use.For', { for: esc(use.for.trim()) }));
  if (use.table) {
    const table = fromUuidSync(use.table);
    always.push($fmt('SDM.Use.Tip.Table', { table: esc(table?.name ?? $l10n('SDM.Trigger.Table')) }));
  }
  if (!lines.length && !always.length) lines.push($l10n('SDM.Use.Tip.Nothing'));

  // The title and the bullets: what it does (the dialog says the rest)
  const bullet = line => `<li>${`${line}`.replace(/:\s*$/, '')}</li>`;
  return `<strong>${esc($l10n('SDM.Use.Action'))}</strong><ul style="margin:2px 0 0 1em;padding:0">${[...lines, ...always].map(bullet).join('')}</ul>`;
}

/** Can it be used now? Returns a warning key, or null. */
export function blockedReason(item) {
  const system = item.system;
  if (system.status === 'broken') return 'SDM.Use.Broken';
  if (system.resources === 'run_out') return 'SDM.Use.RunOut';
  const replenish = system.features?.has?.('replenish');
  if (!replenish && getUsesCounter(item)) return usesLeft(item) > 0 ? null : 'SDM.Use.NoUses';
  if (!replenish && system.features?.has?.('charges') && (Number(system.charges?.value) || 0) <= 0) return 'SDM.Use.NoCharges';
  return null;
}

export async function useItem(item) {
  const actor = item?.actor;
  if (!actor || !item.isOwner || !isUsable(item)) return;
  const blocked = blockedReason(item);
  if (blocked) {
    ui.notifications.warn($fmt(blocked, { item: item.name }));
    return;
  }

  // An item with an area: place it first; the tokens inside are the targets (none: nobody)
  let areaTargets = null;
  let placed = null;
  if (itemArea(item) && canvas?.ready && canvas.scene) {
    placed = await placeArea({ actor, item });
    if (!placed) return;
    areaTargets = [...new Set(placed.tokens.map(token => token.actor).filter(Boolean))];
  }
  const targets = areaTargets ?? getTargets(actor);
  // An area resolved by a save: its card asks everyone inside, and the harm and effects follow each save
  const areaSave = !!(areaTargets && itemArea(item)?.save);
  // A lingering area gives the item's effects to whoever stands in it: the Use doesn't copy them too
  const itemEffects = (areaTargets && itemArea(item)?.linger) || areaSave ? [] : effectsToCopy(item);
  const choice = await chooseUse(item.system.use, itemEffects);
  if (!choice) return; // dialog closed
  const use = item.system.use;
  if (choice.askAbility) {
    choice.abilityKey = await chooseAbility(use.ability_group);
    if (!choice.abilityKey) return;
  }
  const restores = [];
  let rollHtml = '';
  const rollFormula = async formula => {
    // Formulas can read counters and other values (@item.counters.doses.value)
    const roll = await new Roll(resolveFormula(formula, { item, actor }), actor.getRollData()).evaluate();
    await showSideDice(roll);
    rollHtml += await roll.render();
    return Math.max(Number(roll.total) || 0, 0);
  };
  for (const kind of ['life', 'ability']) {
    if (!choice[kind]) continue;
    if (isFullRestore(use[kind])) {
      restores.push({ kind, full: true, ability: null, amount: 0, group: kind === 'ability' ? use.ability_group : '' });
      continue;
    }
    restores.push({ kind, ability: kind === 'ability' ? choice.abilityKey : null, amount: await rollFormula(use[kind]) });
  }
  if (choice.tempLife && use.temp_life?.trim()) {
    restores.push({
      kind: 'temp_life',
      amount: await rollFormula(use.temp_life),
      name: item.name,
      img: item.img,
      origin: item.uuid,
      duration: useDuration(use)
    });
  }
  // Harm always happens (not an option)
  if (use.harm?.trim()) restores.push({ kind: 'harm', amount: await rollFormula(use.harm) });
  // Cures always happen too
  const cures = (use.cures ?? []).filter(id => CONFIG.statusEffects.some(s => s.id === id));
  if (cures.length) restores.push({ kind: 'cure', statuses: cures });
  // A rest, every time (after the healing: the dialog then shows what is still missing)
  if (use.rest) restores.push({ kind: 'rest' });
  // Purges other consumables, every time
  if (use.purge) restores.push({ kind: 'purge', usedItem: item.uuid });
  // A replenisher: pick the item it recharges (none that fits: nothing is used up)
  if (use.replenishes) {
    const picked = await pickReplenished(item, use.replenishes, targets);
    if (!picked) return;
    restores.push({ kind: 'replenish', itemUuid: picked.uuid, name: picked.name });
  }
  // Overdose: counted on each target, a save once there are too many doses
  if (use.overdose?.status || use.overdose?.effect) {
    restores.push({ kind: 'overdose', itemUuid: item.uuid, key: getItemIdentifier(item) || item.id, overdose: { ...use.overdose } });
  }

  // Effects last as long as the use says, unless the effect sets its own duration
  const duration = useDuration(use);
  const effects = (choice.effects ? itemEffects : []).map(data =>
    duration && !(Number(data.duration?.value) > 0) ? { ...data, duration: { ...(data.duration ?? {}), ...duration } } : data
  );
  const table = use.table ? await fromUuid(use.table) : null;
  if (!restores.length && !effects.length && !hasUseActions(use.actions) && !(areaSave && lingerEffects(item).length) && table?.documentName !== 'RollTable') {
    ui.notifications.warn($fmt('SDM.Use.Nothing', { item: item.name }));
    return;
  }
  // Chat card: who used what on whom, and what it did (and who it is meant for: a reminder)
  const what = [];
  if (use.for?.trim()) what.push(`<i>${$fmt('SDM.Use.For', { for: esc(use.for.trim()) })}</i>`);
  for (const restore of restores) {
    if (restore.full && restore.kind === 'life') what.push($l10n('SDM.Use.RestoreAllLife'));
    else if (restore.full) what.push(abilityLabel(use));
    else if (restore.kind === 'life') what.push($fmt('SDM.Use.ChatLife', { amount: restore.amount }));
    else if (restore.kind === 'temp_life') what.push($fmt('SDM.Use.ChatTempLife', { amount: restore.amount }));
    else if (restore.kind === 'harm') what.push($fmt('SDM.Use.ChatHarm', { amount: restore.amount }));
    else if (restore.kind === 'cure') what.push($fmt('SDM.Use.ChatCures', { conditions: esc(statusNames(restore.statuses)) }));
    else if (restore.kind === 'rest') what.push($l10n('SDM.Use.ChatRest'));
    else if (restore.kind === 'purge') what.push($l10n('SDM.Use.ChatPurge'));
    else if (restore.kind === 'replenish') what.push($fmt('SDM.Use.ChatReplenish', { item: esc(restore.name) }));
    else if (restore.kind === 'overdose') continue;
    else what.push($fmt('SDM.Use.ChatAbility', { amount: restore.amount, ability: $l10n(CONFIG.SDM.abilities[restore.ability]) }));
  }
  if (effects.length) {
    what.push(
      $fmt('SDM.Use.ChatEffects', { effects: effects.map(e => esc(e.name)).join(', ') }) +
        (duration ? ` (${describeDuration(use)})` : '')
    );
  }
  // Triggers on Use (this item's, and readied gear / traits / burdens watching it): on the card, then
  // their actions on the same targets
  const { itemRollTriggers, renderTriggers, runTriggerActions } = await import('../rolls/triggers.mjs');
  const fired = itemRollTriggers(item, 'use', { total: 0, dice: [] });
  // The Use's own actions (the same list as triggers'), as if a trigger of this item fired
  const useActions = hasUseActions(use.actions) ? [{ item, trigger: { ...use.actions, text: '' } }] : [];
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><i class="fa-solid fa-hand-holding-medical"></i> ${$fmt('SDM.Use.Chat', {
      actor: esc(actor.name),
      item: esc(item.name),
      targets: targets.map(t => esc(t.name)).join(', ')
    })}</p>${what.length ? `<p>${what.join('<br>')}</p>` : ''}${rollHtml}${renderTriggers(fired, { targets })}`
  });

  // A save area: its card, with the harm for each one by their save (buttons) and the effects on a failed one
  const harm = restores.find(r => r.kind === 'harm');
  if (areaSave) {
    const block = areaBlock(areaState({ mode: 'use', actor, item, kind: '', placed, total: harm?.amount ?? 0 }));
    const message = await createChatMessage({
      actor,
      content: cardWrap(cardHeader({ icon: 'fa-solid fa-bullseye', title: item.name }) + block.html, { kind: 'power' }),
      flags: { sdm: { areaCard: block.card } }
    });
    if (message) await requestAreaSaves(message);
  }

  // Applied after the card, so the chat reads: use → healing
  for (const target of targets) {
    // In an area: harm less its reduction (Bystander); a save area's harm is on its card
    const own = areaSave
      ? restores.filter(r => r.kind !== 'harm')
      : areaTargets
        ? restores.map(r => (r.kind === 'harm' ? { ...r, amount: Math.max(r.amount - areaDamageReduction(target), 0) } : r))
        : restores;
    const payload = { actorUuid: target.uuid, restores: own, effects };
    if (target.isOwner) await applyToActor(payload);
    else if (game.users.activeGM) game.socket.emit(CHANNEL, { action: APPLY_ACTION, payload });
    else ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
  }

  // The roll table, every time (strange beliefs, vision dreams…)
  if (table?.documentName === 'RollTable') await table.draw();

  // Before it is spent (the last one deletes the item, whose triggers and effects the actions need)
  if (useActions.length || fired.length) await runTriggerActions([...useActions, ...fired], { actor, targets });

  await spend(item);
}

/**
 * Counters a replenisher gives back (to their reset value): those that recharge (reset each round /
 * turn / rest / day / session, after combat, with a cooldown or a hero die), and those that count down
 * from full (reset value at their maximum) and are not full. Tallies that count up (kills) are left alone.
 */
function rechargeableCounters(item) {
  const usesKey = item.system?.uses?.counter;
  return Object.entries(item.system?.counters ?? {}).filter(([key, counter]) => {
    if (key === usesKey) return false;
    const value = Number(counter.value) || 0;
    const reset = Number(counter.reset_value) || 0;
    if (value === reset) return false;
    if (counter.reset_each || counter.reset_on_combat_end || counter.hero_die || Number(counter.cooldown) > 0) return true;
    const hasMax = counter.max !== null && counter.max !== undefined;
    return hasMax && reset >= Number(counter.max) && value < reset;
  });
}

/** Something to give back: running low or run out, charges spent, its uses counter not full, a counter that recharges. */
function needsRecharge(item) {
  const system = item.system ?? {};
  if (['running_low', 'run_out'].includes(system.resources)) return true;
  if (system.features?.has?.('charges') && !system.features?.has?.('replenish') && (Number(system.charges?.value) || 0) < (Number(system.charges?.max) || 0)) return true;
  if (canRefillUses(item)) return true;
  return rechargeableCounters(item).length > 0;
}

/** Items a replenisher can recharge: something to give back, of its kind. */
function replenishable(item, kind) {
  const system = item.system ?? {};
  if (!needsRecharge(item)) return false;
  if (kind === 'small') {
    const cash = (Number(system.size?.value) || 0) * ({ soaps: 25, stones: 250, sacks: 2500 }[system.size?.unit] ?? 1);
    return cash <= 250;
  }
  if (kind === 'weapon') return system.type === 'weapon' || !!system.features?.has?.('weapon');
  if (kind === 'machine') return item.type === 'vehicle' || !!system.features?.has?.('oldtech');
  return true;
}

/** Which item a replenisher recharges: the targets' items that fit, picked in a dialog (null: none or closed). */
async function pickReplenished(item, kind, targets) {
  const candidates = targets.flatMap(actor => (actor.items?.contents ?? []).filter(other => other !== item && replenishable(other, kind)));
  if (!candidates.length) {
    ui.notifications.warn($fmt('SDM.Use.ReplenishNone', { item: item.name }));
    return null;
  }
  if (candidates.length === 1) return candidates[0];
  const several = new Set(candidates.map(c => c.actor)).size > 1;
  const options = candidates
    .map(c => {
      // What it is short of: run out, running low, its charges, or what needs recharging
      const state =
        c.system.resources === 'run_out'
          ? $l10n('SDM.ItemStatusRunOut')
          : c.system.resources === 'running_low'
            ? $l10n('SDM.ItemStatusRunningLow')
            : c.system.features?.has?.('charges') && (Number(c.system.charges?.value) || 0) < (Number(c.system.charges?.max) || 0)
              ? `${Number(c.system.charges.value) || 0}/${Number(c.system.charges.max) || 0}`
              : $l10n('SDM.Use.ReplenishSpent');
      return `<option value="${esc(c.uuid)}">${esc(several ? `${c.actor.name}: ${c.name}` : c.name)} (${esc(state)})</option>`;
    })
    .join('');
  const uuid = await foundry.applications.api.DialogV2.prompt({
    window: { title: item.name },
    content: `<div class="form-group"><label>${esc($l10n('SDM.Use.ReplenishPick'))}</label><select name="item">${options}</select></div>`,
    ok: { label: 'SDM.Use.ReplenishGo', icon: 'fa-solid fa-battery-full', callback: (event, button) => button.form.elements.item.value },
    rejectClose: false
  });
  return uuid ? candidates.find(c => c.uuid === uuid) ?? null : null;
}

/** Remove from the actor the effects that consumables copied onto it (not those of `except`). */
async function purgeEffectsOf(actor, except = '') {
  const ids = actor.effects
    .filter(e => {
      const used = e.getFlag('sdm', 'usedItem');
      if (!used || used === except) return false;
      const source = fromUuidSync(used);
      // A consumable (or one already used up and gone)
      return !source || isUsable(source);
    })
    .map(e => e.id);
  if (ids.length) await deleteEffects(actor, ids);
}

/** Lower an actor's ability score (a trigger action): here, or by the Referee's game. */
export async function damageAbilityOf(actor, ability, amount, reason = '') {
  if (!actor || !ability || !(amount > 0)) return;
  const payload = { actorUuid: actor.uuid, restores: [{ kind: 'abilityDamage', ability, amount, reason }], effects: [] };
  if (actor.isOwner) await applyToActor(payload);
  else if (game.users.activeGM) game.socket.emit(CHANNEL, { action: APPLY_ACTION, payload });
  else ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
}

/** Purge an actor of consumables (a trigger action): here, or by the Referee's game. */
export async function purgeConsumables(actor, except = '') {
  if (!actor) return;
  const payload = { actorUuid: actor.uuid, restores: [{ kind: 'purge', usedItem: except }], effects: [] };
  if (actor.isOwner) await applyToActor(payload);
  else if (game.users.activeGM) game.socket.emit(CHANNEL, { action: APPLY_ACTION, payload });
  else ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
}

/** A Use's own actions (the trigger action list): any of them set. */
export function hasUseActions(actions) {
  if (!actions) return false;
  return ['status', 'effect', 'wear', 'counter', 'cast', 'use', 'light', 'charges_mode', 'life_mode', 'ability_damage', 'purge', 'roll_formula', 'hero_dice', 'animate', 'table', 'summon']
    .some(key => !!`${actions[key] ?? ''}`.trim());
}

const DIFFICULTY_STEPS = ['veryEasy', 'easy', '', 'hard', 'veryHard'];
const PERIOD_SECONDS = { days: 86400, weeks: 604800 };

/**
 * Count a dose on the actor (flags.sdm.doses.<item>: how many and since when). Once the doses within
 * the period are more than the free ones, the actor saves against the overdose condition (or effect);
 * escalating, each dose beyond moves the difficulty one step up (easy → standard → hard → very hard).
 */
async function overdoseDose(actor, { itemUuid, key, overdose }) {
  const now = game.time?.worldTime ?? 0;
  const span = PERIOD_SECONDS[overdose.period] ?? 0;
  const doses = actor.getFlag('sdm', 'doses')?.[key] ?? { count: 0, since: now };
  const fresh = span && now - (Number(doses.since) || 0) >= span;
  const count = (fresh ? 0 : Number(doses.count) || 0) + 1;
  await actor.update({ [`flags.sdm.doses.${key}`]: { count, since: fresh || !doses.count ? now : doses.since } });

  const beyond = count - (Number(overdose.after) || 0);
  if (beyond < 1) return;
  const start = Math.max(DIFFICULTY_STEPS.indexOf(overdose.difficulty ?? ''), 0);
  const difficulty = DIFFICULTY_STEPS[Math.min(start + (overdose.escalate ? beyond - 1 : 0), DIFFICULTY_STEPS.length - 1)];
  const item = fromUuidSync(itemUuid);
  const save = { ability: overdose.ability ?? '', difficulty, source: item?.name ?? '' };
  if (overdose.effect && item?.effects?.has(overdose.effect)) {
    await applyItemEffectToTargets(item, overdose.effect, actor, { targets: [actor], save });
  } else if (overdose.status) {
    await applyStatusToTargets(overdose.status, actor, { targets: [actor], save });
  }
}

/** "for 2 hours" */
function describeDuration(use) {
  const value = Number(use?.duration?.value) || 0;
  const units = use?.duration?.units;
  if (!value || !units) return '';
  return $fmt('SDM.Use.Duration', { value, units: $l10n(`SDM.Use.DurationUnit.${units}`) });
}

/** Replenish: usage roll (charges untouched). Uses counter: one use. Charges: one charge. Otherwise: one of its quantity. */
async function spend(item) {
  const system = item.system;
  if (system.features?.has?.('replenish')) {
    await item.spendUsage();
    return;
  }
  if (getUsesCounter(item)) {
    const update = spendUsesUpdate(item);
    if (update) await item.update(update);
    return;
  }
  if (system.features?.has?.('charges')) {
    const charges = Math.max((Number(system.charges?.value) || 0) - 1, 0);
    await item.update({
      'system.charges.value': charges,
      ...(charges === 0 ? { 'system.resources': 'run_out' } : lastChargeUpdate(item, charges))
    });
    return;
  }
  const quantity = (Number(system.quantity) || 1) - 1;
  if (quantity > 0) await item.update({ 'system.quantity': quantity });
  else await item.delete();
}

/** Usable items' effects only reach the actor when used, not while carried. */
export function isDormantEffect(effect) {
  return effect?.parent?.documentName === 'Item' && isUsable(effect.parent);
}

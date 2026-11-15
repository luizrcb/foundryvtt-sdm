import { ItemType } from '../helpers/constants.mjs';
import { resolveFormula } from '../helpers/formulas.mjs';
import { lastChargeUpdate } from '../helpers/itemUtils.mjs';
import { getUsesCounter, spendUsesUpdate, usesLeft } from '../helpers/itemUses.mjs';
import { $fmt, $l10n } from '../helpers/globalUtils.mjs';

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
  const content = `<div class="sdm-upgrade">
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
  const value = Number(use?.duration?.value) || 0;
  const units = use?.duration?.units;
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
    if (restore?.full) {
      await restoreAll(actor, restore.kind, restore.group);
      continue;
    }
    // Harm: life lost by whoever takes it (temporary life first, like damage)
    if (restore?.kind === 'harm' && restore.amount > 0) {
      await actor.applyDamage(restore.amount, 1, false, true);
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
 * A roll trigger's effect: one of the item's effects (keep it disabled or not applied to the bearer
 * on the item) copied to the user's targeted tokens as a temporary effect, like Use.
 */
export async function applyItemEffectToTargets(item, effectId, actor, { self = false } = {}) {
  const effects = effectsToCopy(item).filter((data, index) => item.effects.contents[index]?.id === effectId);
  if (!effects.length) return;
  // "self": the one who rolled; otherwise the user's targeted tokens
  const targets = self
    ? [actor ?? item.actor].filter(Boolean)
    : [...new Set([...(game.user.targets ?? [])].map(token => token.actor).filter(Boolean))];
  if (!targets.length) {
    ui.notifications.info($fmt('SDM.Trigger.NoTarget', { effect: effects[0].name }));
    return;
  }
  for (const target of targets) {
    const payload = { actorUuid: target.uuid, restores: [], effects };
    if (target.isOwner) await applyToActor(payload);
    else if (game.users.activeGM) game.socket.emit(CHANNEL, { action: APPLY_ACTION, payload });
    else ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><i class="fa-solid fa-bolt"></i> ${$fmt('SDM.Trigger.EffectApplied', {
      effect: esc(effects[0].name),
      targets: targets.map(t => esc(t.name)).join(', ')
    })}</p>`
  });
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

  const targets = getTargets(actor);
  const itemEffects = effectsToCopy(item);
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

  // Effects last as long as the use says, unless the effect sets its own duration
  const duration = useDuration(use);
  const effects = (choice.effects ? itemEffects : []).map(data =>
    duration && !(Number(data.duration?.value) > 0) ? { ...data, duration: { ...(data.duration ?? {}), ...duration } } : data
  );
  const table = use.table ? await fromUuid(use.table) : null;
  if (!restores.length && !effects.length && table?.documentName !== 'RollTable') {
    ui.notifications.warn($fmt('SDM.Use.Nothing', { item: item.name }));
    return;
  }
  // Chat card: who used what on whom, and what it did
  const what = [];
  for (const restore of restores) {
    if (restore.full && restore.kind === 'life') what.push($l10n('SDM.Use.RestoreAllLife'));
    else if (restore.full) what.push(abilityLabel(use));
    else if (restore.kind === 'life') what.push($fmt('SDM.Use.ChatLife', { amount: restore.amount }));
    else if (restore.kind === 'temp_life') what.push($fmt('SDM.Use.ChatTempLife', { amount: restore.amount }));
    else if (restore.kind === 'harm') what.push($fmt('SDM.Use.ChatHarm', { amount: restore.amount }));
    else what.push($fmt('SDM.Use.ChatAbility', { amount: restore.amount, ability: $l10n(CONFIG.SDM.abilities[restore.ability]) }));
  }
  if (effects.length) {
    what.push(
      $fmt('SDM.Use.ChatEffects', { effects: effects.map(e => esc(e.name)).join(', ') }) +
        (duration ? ` (${describeDuration(use)})` : '')
    );
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><i class="fa-solid fa-hand-holding-medical"></i> ${$fmt('SDM.Use.Chat', {
      actor: esc(actor.name),
      item: esc(item.name),
      targets: targets.map(t => esc(t.name)).join(', ')
    })}</p>${what.length ? `<p>${what.join('<br>')}</p>` : ''}${rollHtml}`
  });

  // Applied after the card, so the chat reads: use → healing
  for (const target of targets) {
    const payload = { actorUuid: target.uuid, restores, effects };
    if (target.isOwner) await applyToActor(payload);
    else if (game.users.activeGM) game.socket.emit(CHANNEL, { action: APPLY_ACTION, payload });
    else ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
  }

  // The roll table, every time (strange beliefs, vision dreams…)
  if (table?.documentName === 'RollTable') await table.draw();

  await spend(item);
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

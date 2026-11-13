import { ItemType } from '../helpers/constants.mjs';
import { lastChargeUpdate } from '../helpers/itemUtils.mjs';
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
}

function getTargets(actor) {
  const fromTokens = tokens => [...new Set([...tokens].map(token => token.actor).filter(Boolean))];
  const targeted = fromTokens(game.user.targets ?? []);
  if (targeted.length) return targeted;
  const selected = fromTokens(canvas?.tokens?.controlled ?? []);
  if (selected.length) return selected;
  return [actor];
}

/**
 * What this use does, picked with checkboxes when there is more than one option: restore life,
 * restore an ability (which one), apply the item's effects (Black Light Lotus: smoke it to heal,
 * apply it for the charisma, or both). Only the first option starts ticked.
 * Returns { life, ability, abilityKey, effects } (booleans), or null when closed.
 */
async function chooseUse(use, effects) {
  const hasLife = !!use.life?.trim();
  const hasAbility = !!use.ability?.trim();
  const hasEffects = effects.length > 0;
  const count = hasLife + hasAbility + hasEffects;
  const abilityFull = isFullRestore(use.ability);
  if (count <= 1) {
    return { life: hasLife, ability: hasAbility, abilityKey: null, effects: hasEffects, askAbility: hasAbility && !abilityFull };
  }

  const first = hasLife ? 'life' : 'ability';
  const box = (kind, label) =>
    `<label class="sdm-upgrade-choice"><input type="checkbox" name="${kind}" ${kind === first ? 'checked' : ''} /> ${label}</label>`;
  const abilities = Object.entries(CONFIG.SDM.abilities)
    .map(([key, label]) => `<option value="${key}">${esc($l10n(label))}</option>`)
    .join('');
  const content = `<div class="sdm-upgrade">
      ${hasLife ? box('life', isFullRestore(use.life) ? $l10n('SDM.Use.RestoreAllLife') : $fmt('SDM.Use.RestoreLife', { formula: esc(use.life) })) : ''}
      ${hasAbility ? (abilityFull ? box('ability', $l10n('SDM.Use.RestoreAllAbilities')) : box('ability', $fmt('SDM.Use.RestoreAbility', { formula: esc(use.ability) })) + `<div class="sdm-upgrade-detail"><select name="abilityKey">${abilities}</select></div>`) : ''}
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
          effects: checked('effects')
        };
      }
    }
  });
}

/** Ask only which ability (single option: restore an ability). */
async function chooseAbility() {
  const abilities = Object.entries(CONFIG.SDM.abilities)
    .map(([key, label]) => `<option value="${key}">${esc($l10n(label))}</option>`)
    .join('');
  return DialogV2.prompt({
    window: { title: $l10n('SDM.Use.Title'), icon: 'fa-solid fa-hand-holding-medical' },
    content: `<div class="sdm-upgrade"><select name="abilityKey">${abilities}</select></div>`,
    rejectClose: false,
    ok: { label: $l10n('SDM.Use.Confirm'), callback: (event, button) => button.form.elements.abilityKey.value }
  });
}

/** Restoration and effects on one actor (here, or by the active Referee for actors the user does not own). */
async function applyToActor({ actorUuid, restores = [], restore, effects }) {
  const actor = await fromUuid(actorUuid);
  if (!actor) return;
  if (restore) restores = [restore]; // older clients
  for (const restore of restores) {
    if (restore?.full) {
      await restoreAll(actor, restore.kind);
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

/** All missing life (to its maximum), or every ability back to full. */
export async function restoreAll(actor, kind) {
  if (kind === 'life') {
    const life = actor.system.life;
    if (life && life.value < life.max) await actor.update({ 'system.life.value': life.max });
    return;
  }
  const update = {};
  for (const [key, ability] of Object.entries(actor.system.abilities ?? {})) {
    const full = ability.full ?? (ability.base ?? 0) + (ability.bonus ?? 0);
    if ((Number(ability.current) || 0) < full) update[`system.abilities.${key}.current`] = full;
  }
  if (!foundry.utils.isEmpty(update)) await actor.update(update);
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

/** Can it be used now? Returns a warning key, or null. */
export function blockedReason(item) {
  const system = item.system;
  if (system.status === 'broken') return 'SDM.Use.Broken';
  if (system.resources === 'run_out') return 'SDM.Use.RunOut';
  const replenish = system.features?.has?.('replenish');
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
  if (choice.askAbility) {
    choice.abilityKey = await chooseAbility();
    if (!choice.abilityKey) return;
  }
  const restores = [];
  let rollHtml = '';
  for (const kind of ['life', 'ability']) {
    if (!choice[kind]) continue;
    if (isFullRestore(item.system.use[kind])) {
      restores.push({ kind, full: true, ability: null, amount: 0 });
      continue;
    }
    const roll = await new Roll(item.system.use[kind], actor.getRollData()).evaluate();
    restores.push({ kind, ability: kind === 'ability' ? choice.abilityKey : null, amount: Math.max(Number(roll.total) || 0, 0) });
    rollHtml += await roll.render();
  }

  const effects = choice.effects ? itemEffects : [];
  if (!restores.length && !effects.length) {
    ui.notifications.warn($fmt('SDM.Use.Nothing', { item: item.name }));
    return;
  }
  // Chat card: who used what on whom, and what it did
  const what = [];
  for (const restore of restores) {
    if (restore.full) what.push($l10n(restore.kind === 'life' ? 'SDM.Use.RestoreAllLife' : 'SDM.Use.RestoreAllAbilities'));
    else if (restore.kind === 'life') what.push($fmt('SDM.Use.ChatLife', { amount: restore.amount }));
    else what.push($fmt('SDM.Use.ChatAbility', { amount: restore.amount, ability: $l10n(CONFIG.SDM.abilities[restore.ability]) }));
  }
  if (effects.length) what.push($fmt('SDM.Use.ChatEffects', { effects: effects.map(e => esc(e.name)).join(', ') }));
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

  await spend(item);
}

/** Replenish: usage roll (charges untouched). Charges: one charge. Otherwise: one of its quantity. */
async function spend(item) {
  const system = item.system;
  if (system.features?.has?.('replenish')) {
    await item.spendUsage();
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

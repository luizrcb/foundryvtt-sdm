import { ActorType, ItemType } from '../helpers/constants.mjs';
import { $fmt, $l10n } from '../helpers/globalUtils.mjs';
import { restoreAll } from './use-item.mjs';
import { resetCountersOnRest } from '../helpers/counters.mjs';
import { deleteEffects } from '../helpers/deleteEffects.mjs';

/**
 * Rest (one week): remove one affliction or insult —
 *   regain all missing life, fully restore one missing ability score, or remove one burden
 *   (the Referee confirms that one: "terms and conditions apply").
 *
 * A week of rest also ends the short-term conditions put on the actor (stunned, poisoned, bleeding…;
 * see REST_CLEARS). Lasting ones stay: dead (relife), mad (treatment), corroded (repair), petrified, and
 * invisible / flying (usually an item or power). Conditions given by a carried item stay with it.
 *
 * Programmatic use: game.sdm.api.rest(actorOrUuid, { choice: 'life' | 'ability' | 'burden', ability, burdenId,
 * clearConditions = true }) opens the dialog when no choice is given.
 */

/** Conditions a week of rest ends. */
export const REST_CLEARS = [
  'stun',
  'confused',
  'nauseated',
  'slowed',
  'weakened',
  'blind',
  'deaf',
  'fear',
  'prone',
  'sleep',
  'unconscious',
  'restrain',
  'bleeding',
  'burning',
  'poison',
  'hidden',
  'surprised'
];

/** The actor's own effects that are only short-term conditions (not those from its items). */
export function restConditions(actor) {
  return (actor?.effects ?? []).filter(effect => {
    const statuses = [...(effect.statuses ?? [])];
    return statuses.length > 0 && statuses.every(id => REST_CLEARS.includes(id));
  });
}

const conditionNames = effects =>
  [...new Set(effects.flatMap(effect => [...effect.statuses]))]
    .map(id => game.i18n.localize(`SDM.Condition.${id}.Name`).toLowerCase())
    .join(', ');

const { DialogV2 } = foundry.applications.api;
const esc = text => foundry.utils.escapeHTML?.(String(text ?? '')) ?? String(text ?? '');
const BURDEN_QUERY = 'sdm.restRemoveBurden';

export function setupRest() {
  CONFIG.queries[BURDEN_QUERY] = confirmBurdenRemoval;
}

function fullOf(ability) {
  return ability.full ?? (Number(ability.base) || 0) + (Number(ability.bonus) || 0);
}

/** What the actor can recover: missing life, abilities below full, burdens. */
export function getRestOptions(actor) {
  const life = actor.system.life ?? {};
  const missingAbilities = Object.entries(actor.system.abilities ?? {})
    .filter(([, ability]) => (Number(ability.current) || 0) < fullOf(ability))
    .map(([key, ability]) => ({ key, current: Number(ability.current) || 0, full: fullOf(ability) }));
  const burdens = actor.items.filter(item => item.type === ItemType.BURDEN);
  return {
    lifeMissing: (Number(life.max) || 0) - (Number(life.value) || 0) > 0,
    life,
    missingAbilities,
    burdens
  };
}

export async function restActor(actorOrUuid, { choice, ability, burdenId, clearConditions = true } = {}) {
  const actor = typeof actorOrUuid === 'string' ? await fromUuid(actorOrUuid) : actorOrUuid;
  if (!actor || ![ActorType.CHARACTER, ActorType.NPC].includes(actor.type)) return null;
  if (!actor.isOwner) {
    ui.notifications.warn($l10n('SDM.Rest.NotOwner'));
    return null;
  }
  const options = getRestOptions(actor);

  let picked = choice ? { choice, ability, burdenId, clearConditions } : await chooseRest(actor, options);
  if (!picked) return null;

  // The week of rest also ends short-term conditions (the dialog's checkbox, ticked by default)
  const endConditions = async () => {
    if (!picked.clearConditions) return '';
    const effects = restConditions(actor);
    if (!effects.length) return '';
    const names = conditionNames(effects);
    await deleteEffects(actor, effects.map(effect => effect.id));
    return `<p>${$fmt('SDM.Rest.ChatConditions', { conditions: esc(names) })}</p>`;
  };

  // Only the conditions (nothing else to recover)
  if (!picked.choice) {
    const cleared = await endConditions();
    if (!cleared) return warnNothing(actor);
    await postRest(actor, '', cleared);
    return picked;
  }

  if (picked.choice === 'life') {
    if (!options.lifeMissing) return warnNothing(actor);
    await restoreAll(actor, 'life');
    await postRest(actor, $l10n('SDM.Rest.ChatLife'), await endConditions());
    return picked;
  }

  if (picked.choice === 'ability') {
    const missing = options.missingAbilities.find(entry => entry.key === picked.ability);
    if (!missing) return warnNothing(actor);
    await actor.update({ [`system.abilities.${missing.key}.current`]: missing.full });
    await postRest(
      actor,
      $fmt('SDM.Rest.ChatAbility', { ability: $l10n(CONFIG.SDM.abilities[missing.key]) }),
      await endConditions()
    );
    return picked;
  }

  if (picked.choice === 'burden') {
    const burden = actor.items.get(picked.burdenId);
    if (!burden || burden.type !== ItemType.BURDEN) return warnNothing(actor);
    let removed = false;
    if (game.user.isGM) {
      await burden.delete();
      removed = true;
    } else {
      const gm = game.users.activeGM;
      if (!gm) {
        ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
        return null;
      }
      ui.notifications.info($fmt('SDM.Rest.BurdenAsked', { burden: burden.name }));
      removed = !!(await gm.query(BURDEN_QUERY, { itemUuid: burden.uuid, userId: game.user.id }, { timeout: 5 * 60 * 1000 }));
    }
    if (!removed) {
      ui.notifications.info($fmt('SDM.Rest.BurdenDenied', { burden: burden.name }));
      return null;
    }
    await postRest(actor, $fmt('SDM.Rest.ChatBurden', { burden: esc(burden.name) }), await endConditions());
    return picked;
  }
  return null;
}

function warnNothing(actor) {
  ui.notifications.warn($fmt('SDM.Rest.Nothing', { actor: actor.name }));
  return null;
}

async function postRest(actor, text, extra = '') {
  await resetCountersOnRest(actor);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><i class="fa-solid fa-bed"></i> ${$fmt('SDM.Rest.Chat', { actor: esc(actor.name) })}</p>${text ? `<p>${text}</p>` : ''}${extra}`
  });
}

/** The Referee confirms removing a burden through rest (runs on the active GM). */
async function confirmBurdenRemoval({ itemUuid, userId }) {
  const item = await fromUuid(itemUuid);
  if (!item || item.type !== ItemType.BURDEN) return false;
  const user = game.users.get(userId);
  const ok = await DialogV2.confirm({
    window: { title: $l10n('SDM.Rest.Title'), icon: 'fa-solid fa-bed' },
    content: `<p>${$fmt('SDM.Rest.BurdenConfirm', {
      user: esc(user?.name ?? ''),
      actor: esc(item.parent?.name ?? ''),
      burden: esc(item.name)
    })}</p>`,
    rejectClose: false
  });
  if (!ok) return false;
  await item.delete();
  return true;
}

/** The rest dialog: one choice. Options with nothing to recover are disabled. */
async function chooseRest(actor, options) {
  const { lifeMissing, life, missingAbilities, burdens } = options;
  const conditions = restConditions(actor);
  const anyChoice = lifeMissing || missingAbilities.length || burdens.length;
  if (!anyChoice && !conditions.length) return warnNothing(actor);

  const first = lifeMissing ? 'life' : missingAbilities.length ? 'ability' : burdens.length ? 'burden' : '';
  const radio = (value, label, enabled) =>
    `<label class="sdm-upgrade-choice${enabled ? '' : ' disabled'}"><input type="radio" name="choice" value="${value}" ${value === first ? 'checked' : ''} ${enabled ? '' : 'disabled'} /> ${label}</label>`;
  const abilityOptions = missingAbilities
    .map(entry => `<option value="${entry.key}">${esc($l10n(CONFIG.SDM.abilities[entry.key]))} (${entry.current}/${entry.full})</option>`)
    .join('');
  const burdenOptions = burdens.map(item => `<option value="${item.id}">${esc(item.name)}</option>`).join('');
  const hasAbilities = actor.system.abilities !== undefined;

  const content = `<div class="sdm-upgrade sdm-rest">
      <p class="hint">${$l10n('SDM.Rest.Hint')}</p>
      ${radio('life', `${$l10n('SDM.Rest.Life')} (${Number(life.value) || 0}/${Number(life.max) || 0})`, lifeMissing)}
      ${
        hasAbilities
          ? radio('ability', $l10n('SDM.Rest.Ability'), missingAbilities.length > 0) +
            (missingAbilities.length ? `<div class="sdm-upgrade-detail"><select name="ability">${abilityOptions}</select></div>` : '')
          : ''
      }
      ${radio('burden', $l10n('SDM.Rest.Burden'), burdens.length > 0)}
      ${burdens.length ? `<div class="sdm-upgrade-detail"><select name="burdenId">${burdenOptions}</select></div>` : ''}
      ${
        conditions.length
          ? `<label class="sdm-rest-conditions"><input type="checkbox" name="clearConditions" checked /> ${$fmt('SDM.Rest.Conditions', { conditions: esc(conditionNames(conditions)) })}</label>`
          : ''
      }
    </div>`;

  return DialogV2.prompt({
    window: { title: `${$l10n('SDM.Rest.Title')}: ${actor.name}`, icon: 'fa-solid fa-bed' },
    content,
    rejectClose: false,
    render: (event, dialog) => {
      // Picking from a list selects its option
      const form = dialog.element.querySelector('form') ?? dialog.element;
      for (const [name, value] of [['ability', 'ability'], ['burdenId', 'burden']]) {
        form.querySelector(`select[name="${name}"]`)?.addEventListener('focus', () => {
          const option = form.querySelector(`input[name="choice"][value="${value}"]`);
          if (option && !option.disabled) option.checked = true;
        });
      }
    },
    ok: {
      label: $l10n('SDM.Rest.Confirm'),
      icon: 'fa-solid fa-bed',
      callback: (event, button) => ({
        choice: button.form.querySelector('input[name="choice"]:checked')?.value,
        ability: button.form.elements.ability?.value,
        burdenId: button.form.elements.burdenId?.value,
        clearConditions: !!button.form.elements.clearConditions?.checked
      })
    }
  });
}

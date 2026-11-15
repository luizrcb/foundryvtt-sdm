import { ActorType, RollMode } from './constants.mjs';

/**
 * WTF conditions. The game has no condition rules of its own: these are the conditions its texts
 * mention — item features (blinding: can't see for a round; confusing: a penalty to its actions for a
 * round; entangling: immobilized; fearsome: morale test; petrifying; slumber; mad; heat: catches fire),
 * the defeat roll (knocked out until the end of the fight; lose the next turn), items, traits, powers —
 * with short summaries (5e-inspired where the texts say nothing). The list and the summaries (Token HUD and effects panel hover) are system
 * rules. The automation (world setting "Automate conditions", off by default) adds:
 *  - start of turn: bleeding loses 1 life, burning 1d4; stunned, paralyzed, unconscious, asleep and
 *    petrified lose the turn; grabbed is reminded to save, frightened to test morale (chat notes);
 *  - stunned, blinded and confused last 1 round; asleep wakes up when hurt; the defeat roll knocks out
 *    (7: until the end of the fight) or stuns (8–11: loses the next turn);
 *  - corroded −1 defense, slowed −2 defense; weakened halves damage dealt (noted on the roll);
 *  - advantage / disadvantage preselected in the roll dialog (see conditionRollMode).
 * Foundry's ids are kept (stun, prone, poison…), so items using them keep working.
 */

const C = (id, img, extra = {}) => ({ id, img, name: `SDM.Condition.${id}.Name`, hint: `SDM.Condition.${id}.Hint`, ...extra });

export const CONDITIONS = [
  C('dead', 'icons/svg/skull.svg'),
  C('unconscious', 'icons/svg/unconscious.svg'),
  C('sleep', 'icons/svg/sleep.svg'),
  C('stun', 'icons/svg/daze.svg'),
  C('paralysis', 'icons/svg/paralysis.svg'),
  C('confused', 'icons/svg/hazard.svg'),
  C('mad', 'icons/svg/mystery-man.svg'),
  C('nauseated', 'icons/svg/biohazard.svg'),
  C('slowed', 'icons/svg/downgrade.svg'),
  C('weakened', 'icons/svg/degen.svg'),
  C('blind', 'icons/svg/blind.svg'),
  C('deaf', 'icons/svg/deaf.svg'),
  C('fear', 'icons/svg/terror.svg'),
  C('prone', 'icons/svg/falling.svg'),
  C('restrain', 'icons/svg/net.svg'),
  C('invisible', 'icons/svg/invisible.svg'),
  C('petrified', 'icons/svg/frozen.svg'),
  C('poison', 'icons/svg/poison.svg'),
  C('bleeding', 'icons/svg/blood.svg'),
  C('burning', 'icons/svg/fire.svg'),
  C('corrode', 'icons/svg/acid.svg'),
  C('fly', 'icons/svg/wing.svg')
];

const automated = () => {
  try {
    return game.settings.get('sdm', 'automateConditions');
  } catch {
    return false;
  }
};

/** Init: the system's condition list replaces Foundry's. */
export function configureConditions() {
  CONFIG.statusEffects = CONDITIONS.map(({ hint, ...status }) => ({ ...status, description: hint }));
}

/** Once translations are loaded: names and summaries in the user's language. */
export function localizeConditions() {
  for (const status of CONFIG.statusEffects) {
    const condition = CONDITIONS.find(c => c.id === status.id);
    if (!condition) continue;
    status.name = game.i18n.localize(condition.name);
    status.description = `<p>${game.i18n.localize(condition.hint)}</p>`;
  }
}

/** Localized "Name: summary" of a condition, for tooltips. */
export function conditionTooltip(id) {
  const condition = CONDITIONS.find(c => c.id === id);
  if (!condition) return '';
  return `<strong>${game.i18n.localize(condition.name)}</strong><br>${game.i18n.localize(condition.hint)}`;
}

const has = (actor, id) => !!actor?.statuses?.has?.(id);

/**
 * The roll mode conditions suggest for a roll: disadvantage when the roller is blind, poisoned,
 * prone, confused or (physical abilities) nauseated; when attacking a target, advantage against a
 * paralyzed, unconscious, stunned or (melee) prone target, disadvantage against an invisible or
 * (ranged) prone one. Advantage and disadvantage cancel out. Returns null without automation.
 */
export function conditionRollMode(actor, { attack = '', ability = '', target = null, isAttack = false, isAbility = false } = {}) {
  if (!automated() || !actor) return null;
  let advantage = false;
  let disadvantage = false;
  if (isAttack || isAbility) {
    if (['blind', 'poison', 'prone', 'confused'].some(id => has(actor, id))) disadvantage = true;
    if (has(actor, 'nauseated') && ['str', 'end', 'agi'].includes(ability)) disadvantage = true;
  }
  if (isAttack && target && target !== actor) {
    if (['paralysis', 'unconscious', 'stun', 'sleep'].some(id => has(target, id))) advantage = true;
    if (has(target, 'prone')) {
      if (attack === 'melee') advantage = true;
      else disadvantage = true;
    }
    if (has(target, 'invisible')) disadvantage = true;
  }
  if (advantage && !disadvantage) return RollMode.ADVANTAGE;
  if (disadvantage && !advantage) return RollMode.DISADVANTAGE;
  return null;
}

/** A base roll mode (e.g. the character's own) combined with the conditions' (they cancel out). */
export function combineRollModes(base, fromConditions) {
  if (!fromConditions) return base || RollMode.NORMAL;
  if (!base || base === RollMode.NORMAL) return fromConditions;
  return base === fromConditions ? base : RollMode.NORMAL;
}

/** Weakened: damage dealt is halved (noted on the roll title; the Referee halves it). */
export function isWeakened(actor) {
  return automated() && has(actor, 'weakened');
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

/** Defense penalties and the stun duration, added when the condition is put on. */
function onPreCreateEffect(effect, data, options, userId) {
  if (userId !== game.user.id || !automated()) return;
  const actor = effect.parent;
  if (!(actor instanceof Actor)) return;
  const statuses = new Set(data.statuses ?? []);
  const defenseKey = actor.type === ActorType.NPC ? 'system.defense' : 'system.defense_bonus';
  const changes = [...(effect.system?.changes ?? [])];
  const add = value => changes.push({ key: defenseKey, value: `${value}`, type: 'add', phase: 'initial', priority: null });
  if (statuses.has('corrode')) add(-1);
  if (statuses.has('slowed')) add(-2);
  const update = {};
  if (changes.length !== (effect.system?.changes ?? []).length) update['system.changes'] = changes;
  // Stunned (loses the next turn), blinded and confused (one round): 1 round unless set otherwise
  if (['stun', 'blind', 'confused'].some(id => statuses.has(id)) && !data.duration?.value) {
    update.duration = { value: 1, units: 'rounds', expiry: 'turnEnd' };
  }
  if (Object.keys(update).length) effect.updateSource(update);
}

async function note(actor, key, data = {}) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p>${foundry.utils.escapeHTML(game.i18n.format(key, { name: actor.name, ...data }))}</p>`
  });
}

/** Start of a combatant's turn: damage over time and reminders. Active Referee only. */
async function onCombatTurn(combat, changed) {
  if (!automated() || game.users.activeGM?.id !== game.user.id) return;
  if (!('turn' in changed) && !('round' in changed)) return;
  const actor = combat.combatant?.actor;
  if (!actor) return;
  if (has(actor, 'bleeding')) {
    await actor.applyDamage(1, 1, false, true);
    await note(actor, 'SDM.Condition.bleeding.Turn');
  }
  if (has(actor, 'burning')) {
    const roll = await new Roll('1d4').evaluate();
    await actor.applyDamage(roll.total, 1, false, true);
    await note(actor, 'SDM.Condition.burning.Turn', { amount: roll.total });
  }
  const lost = ['stun', 'paralysis', 'unconscious', 'sleep', 'petrified'].find(id => has(actor, id));
  if (lost) await note(actor, 'SDM.Condition.LosesTurn', { condition: game.i18n.localize(`SDM.Condition.${lost}.Name`) });
  else {
    if (has(actor, 'restrain')) await note(actor, 'SDM.Condition.restrain.Turn');
    if (has(actor, 'fear')) await note(actor, 'SDM.Condition.fear.Turn');
  }
}

/** The defeat roll: 7 knocks out until the end of the fight, 8–11 lose the next turn. */
export async function applyDefeatCondition(actor, total) {
  if (!automated() || !actor) return;
  if (total === 7 && !has(actor, 'unconscious')) {
    await actor.toggleStatusEffect('unconscious', { active: true });
    const effect = actor.effects.find(e => e.statuses?.has('unconscious'));
    await effect?.setFlag('sdm', 'untilCombatEnd', true);
  } else if (total >= 8 && total <= 11 && !has(actor, 'stun')) {
    await actor.toggleStatusEffect('stun', { active: true });
  }
}

/** Knocked out by the defeat roll: up again when the fight ends. */
async function onCombatEnded(combat) {
  if (!automated() || game.users.activeGM?.id !== game.user.id) return;
  for (const actor of new Set(combat.combatants.map(c => c.actor).filter(Boolean))) {
    const ids = actor.effects.filter(e => e.getFlag('sdm', 'untilCombatEnd')).map(e => e.id);
    if (ids.length) await actor.deleteEmbeddedDocuments('ActiveEffect', ids);
  }
}

/** Asleep: being hurt wakes you up. */
async function onActorHurt(actor, changes, options, userId) {
  if (!automated() || game.users.activeGM?.id !== game.user.id || !has(actor, 'sleep')) return;
  const before = options?.sdmLifeBefore;
  const now = foundry.utils.getProperty(changes, 'system.life.value');
  if (before === undefined || now === undefined || now >= before) return;
  await actor.toggleStatusEffect('sleep', { active: false });
}

function onPreUpdateActor(actor, changes, options) {
  if (foundry.utils.hasProperty(changes, 'system.life.value')) options.sdmLifeBefore = actor.system?.life?.value;
}

/** Token HUD: each condition shows its summary on hover. */
function onRenderTokenHUD(hud, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  root?.querySelectorAll('[data-status-id]').forEach(el => {
    const tooltip = conditionTooltip(el.dataset.statusId);
    if (tooltip) el.dataset.tooltip = tooltip;
  });
}

export function setupConditions() {
  Hooks.on('preCreateActiveEffect', onPreCreateEffect);
  Hooks.on('updateCombat', onCombatTurn);
  Hooks.on('preUpdateActor', onPreUpdateActor);
  Hooks.on('updateActor', onActorHurt);
  Hooks.on('renderTokenHUD', onRenderTokenHUD);
  Hooks.on('deleteCombat', onCombatEnded);
}

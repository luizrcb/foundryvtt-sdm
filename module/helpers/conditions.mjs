import { ActorType, RollMode } from './constants.mjs';
import { showSideDice } from './formulas.mjs';
import { deleteEffects } from './deleteEffects.mjs';
import { perceivesUnseen } from './vision.mjs';

/**
 * WTF conditions. The game has no condition rules of its own: these are the conditions its texts
 * mention — item features (blinding: can't see for a round; confusing: a penalty to its actions for a
 * round; entangling: immobilized; fearsome: morale test; petrifying; slumber; mad; heat: catches fire),
 * the defeat roll (knocked out until the end of the fight; lose the next turn), items, traits, powers —
 * with short summaries (common tabletop conventions where the texts say nothing). The list and the summaries (Token HUD and effects panel hover) are system
 * rules. The automation (world setting "Automate conditions", off by default) adds:
 *  - start of turn: bleeding loses 1 life, burning 1d4; stunned, paralyzed, unconscious, asleep and
 *    petrified lose the turn, and so does surprised (its first turn: then it's over); grabbed is
 *    reminded to save, frightened to test morale (chat notes);
 *  - a hidden attacker is seen once it attacks (hidden comes off);
 *  - stunned, blinded and confused last 1 round; asleep wakes up when hurt; the defeat roll knocks out
 *    (7: until the end of the fight) or stuns (8–11: loses the next turn);
 *  - corroded −1 defense, slowed −2 defense and −1 speed; weakened halves damage dealt (noted on the roll);
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
  C('mad', 'systems/sdm/assets/icons/conditions/mad.svg'),
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
  C('fly', 'icons/svg/wing.svg'),
  // From the compendium texts: stealth (hide, unseen), "can't be surprised", mind control, and what
  // sees through invisibility (Eyes of Akaula, Eerie Sense)
  // Own icon: the core hooded figures are taken (mad) or black, and look alike once darkened on sheets
  C('hidden', 'systems/sdm/assets/icons/conditions/hidden.svg'),
  C('surprised', 'systems/sdm/assets/icons/conditions/surprised.svg'),
  C('controlled', 'icons/svg/aura.svg'),
  C('seeInvisible', 'icons/svg/eye.svg'),
  // Declared actions (the book's Actions): what a combatant is doing until its next turn. They only
  // suggest a bonus or penalty in the roll dialogs (preselected, changeable), with or without the
  // automation; put on during a combat they end at the start of its next turn
  C('charging', 'icons/svg/jump.svg', { tactical: true }),
  C('careless', 'icons/svg/sword.svg', { tactical: true }),
  C('furious', 'icons/svg/lightning.svg', { tactical: true }),
  C('defending', 'icons/svg/shield.svg', { tactical: true }),
  C('cover', 'systems/sdm/assets/icons/conditions/cover.svg', { tactical: true }),
  C('protected', 'systems/sdm/assets/icons/conditions/protected.svg', { tactical: true }),
  C('suppressed', 'icons/svg/target.svg', { tactical: true }),
  C('readyAttack', 'icons/svg/dice-target.svg', { tactical: true }),
  // The Referee's next-roll modifiers (next-roll.mjs): not in the Token HUD list, set from its own button
  C('nextRoll', 'icons/svg/upgrade.svg', { hud: false }),
  C('nextRollAgainst', 'icons/svg/upgrade.svg', { hud: false })
];

/** The declared-action conditions (short, until the combatant's next turn). */
export const TACTICAL_CONDITIONS = CONDITIONS.filter(c => c.tactical).map(c => c.id);

const automated = () => {
  try {
    return game.settings.get('sdm', 'automateConditions');
  } catch {
    return false;
  }
};

/** Init: the system's condition list replaces Foundry's. */
export function configureConditions() {
  CONFIG.statusEffects = CONDITIONS.map(({ hint, tactical, ...status }) => ({ ...status, description: hint }));
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
 * paralyzed, unconscious, stunned, surprised or (melee) prone target, disadvantage against an
 * invisible, hidden or (ranged) prone one — unless the attacker sees invisible (or senses it: vision);
 * an invisible or hidden attacker has advantage, unless the target sees or senses it. Advantage and disadvantage cancel out.
 * Without the automation only the declared actions count (tacticalRollAdvice).
 */
export function conditionRollMode(actor, options = {}) {
  const automatic = automated() ? automatedRollMode(actor, options) : null;
  const tactical = tacticalRollAdvice(actor, options).mode;
  if (!automatic) return tactical;
  if (!tactical) return automatic;
  return automatic === tactical ? automatic : null;
}

/** The automation's part (conditionRollMode). */
function automatedRollMode(actor, { attack = '', ability = '', target = null, isAttack = false, isAbility = false } = {}) {
  if (!actor) return null;
  let advantage = false;
  let disadvantage = false;
  if (isAttack || isAbility) {
    if (['blind', 'poison', 'prone', 'confused'].some(id => has(actor, id))) disadvantage = true;
    if (has(actor, 'nauseated') && ['str', 'end', 'agi'].includes(ability)) disadvantage = true;
  }
  if (isAttack && target && target !== actor) {
    if (['paralysis', 'unconscious', 'stun', 'sleep', 'surprised'].some(id => has(target, id))) advantage = true;
    if (has(target, 'prone')) {
      if (attack === 'melee') advantage = true;
      else disadvantage = true;
    }
    // Unseen: invisible or hidden, unless the other one sees through it (Sees invisible, or a vision
    // sense that perceives the invisible within its range)
    const unseen = actor => has(actor, 'invisible') || has(actor, 'hidden');
    const sees = (viewer, other) => has(viewer, 'seeInvisible') || perceivesUnseen(viewer, other);
    if (unseen(target) && !sees(actor, target)) disadvantage = true;
    if (unseen(actor) && !sees(target, actor)) advantage = true;
  }
  if (advantage && !disadvantage) return RollMode.ADVANTAGE;
  if (disadvantage && !advantage) return RollMode.DISADVANTAGE;
  return null;
}

/**
 * Declared actions (always, not only with the automation): a bonus or penalty they suggest for a roll
 * and why. The book gives no size: advantage / disadvantage is preselected and the bonus / penalty
 * row is there to pick a modifier instead.
 *  - the roller: charging and careless attack with a bonus; suppressed rolls (attacks, ability checks)
 *    with a penalty;
 *  - attacking a target: charging or furious targets give a bonus; defending or protected ones a
 *    penalty, and so does one in cover against a ranged attack; a careless one notes the free
 *    counterattack, a ready one that it strikes first.
 */
export function tacticalRollAdvice(actor, { attack = '', target = null, isAttack = false, isAbility = false } = {}) {
  const notes = [];
  let bonus = 0;
  let penalty = 0;
  const name = id => game.i18n.localize(`SDM.Condition.${id}.Name`);
  const say = (key, data) => notes.push(game.i18n.format(key, data));
  if (!actor) return { mode: null, notes };
  if (isAttack) {
    for (const id of ['charging', 'careless']) {
      if (has(actor, id)) {
        bonus++;
        say('SDM.Tactical.OwnBonus', { condition: name(id) });
      }
    }
    if (has(actor, 'furious')) say('SDM.Tactical.Furious', {});
  }
  if ((isAttack || isAbility) && has(actor, 'suppressed')) {
    penalty++;
    say('SDM.Tactical.OwnPenalty', { condition: name('suppressed') });
  }
  if (isAttack && target && target !== actor) {
    const who = target.name;
    for (const id of ['charging', 'furious']) {
      if (has(target, id)) {
        bonus++;
        say('SDM.Tactical.TargetBonus', { target: who, condition: name(id).toLowerCase() });
      }
    }
    for (const id of ['defending', 'protected']) {
      if (has(target, id)) {
        penalty++;
        say('SDM.Tactical.TargetPenalty', { target: who, condition: name(id).toLowerCase() });
      }
    }
    if (has(target, 'cover') && attack && attack !== 'melee') {
      penalty++;
      say('SDM.Tactical.TargetPenalty', { target: who, condition: name('cover').toLowerCase() });
    }
    if (has(target, 'careless')) say('SDM.Tactical.Counterattack', { target: who });
    if (has(target, 'readyAttack')) say('SDM.Tactical.Ready', { target: who });
  }
  const mode = bonus && !penalty ? RollMode.ADVANTAGE : penalty && !bonus ? RollMode.DISADVANTAGE : null;
  return { mode, notes };
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
/**
 * Conditions an actor can't get: listed on its traits and its readied gear ("Immune to"). The
 * item that grants it, by condition id.
 */
export function immunitySources(actor) {
  const sources = new Map();
  for (const item of actor?.items ?? []) {
    const list = item.system?.immunities;
    if (!list?.length) continue;
    if (item.type === 'gear' && !item.system?.readied) continue;
    if (item.type !== 'gear' && item.type !== 'trait') continue;
    for (const id of list) if (!sources.has(id)) sources.set(id, item);
  }
  return sources;
}

/** Immunities (a rule of the items, not of the automation): the condition isn't put on, with a note. */
function onPreCreateImmune(effect, data, options, userId) {
  const actor = effect.parent;
  if (!(actor instanceof Actor) || options?.sdmIgnoreImmunity) return;
  const statuses = [...(data.statuses ?? effect.statuses ?? [])];
  if (!statuses.length) return;
  const sources = immunitySources(actor);
  const blocked = statuses.filter(id => sources.has(id));
  if (!blocked.length) return;
  if (userId === game.user.id) {
    const name = id => game.i18n.localize(CONFIG.statusEffects.find(s => s.id === id)?.name ?? id);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p><i class="fa-solid fa-shield-halved"></i> ${game.i18n.format('SDM.Immunity.Blocked', {
        actor: foundry.utils.escapeHTML(actor.name),
        condition: foundry.utils.escapeHTML(blocked.map(name).join(', ')),
        item: foundry.utils.escapeHTML(sources.get(blocked[0]).name)
      })}</p>`
    });
  }
  return false;
}

/**
 * Declared actions: during a combat, until the start of the combatant's next turn (unless set). Core
 * Foundry ends it: a duration in rounds with the "turnStart" expiry event is matched against the
 * turn of the actor that holds the effect (1 round: its next turn, not the current one).
 */
function onPreCreateTactical(effect, data, options, userId) {
  if (userId !== game.user.id || !game.combat?.started) return;
  const statuses = [...(data.statuses ?? [])];
  if (!statuses.some(id => TACTICAL_CONDITIONS.includes(id)) || data.duration?.value) return;
  effect.updateSource({ duration: { value: 1, units: 'rounds', expiry: 'turnStart' } });
}

function onPreCreateEffect(effect, data, options, userId) {
  if (userId !== game.user.id || !automated()) return;
  const actor = effect.parent;
  if (!(actor instanceof Actor)) return;
  const statuses = new Set(data.statuses ?? []);
  // The same key for characters and NPCs (NPCs add it to their typed defense)
  const defenseKey = 'system.defense_bonus';
  const changes = [...(effect.system?.changes ?? [])];
  const add = value => changes.push({ key: defenseKey, value: `${value}`, type: 'add', phase: 'initial', priority: null });
  if (statuses.has('corrode')) add(-1);
  if (statuses.has('slowed')) {
    add(-2);
    // Half movement: one step slower on the speed scale (zones per round, see zones.mjs)
    changes.push({ key: 'system.speed', value: '-1', type: 'add', phase: 'initial', priority: null });
  }
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
    await showSideDice(roll);
    await actor.applyDamage(roll.total, 1, false, true);
    await note(actor, 'SDM.Condition.burning.Turn', { amount: roll.total });
  }
  const lost = ['stun', 'paralysis', 'unconscious', 'sleep', 'petrified', 'surprised'].find(id => has(actor, id));
  if (lost) await note(actor, 'SDM.Condition.LosesTurn', { condition: game.i18n.localize(`SDM.Condition.${lost}.Name`) });
  // Surprised: only its first turn is lost
  if (has(actor, 'surprised')) await actor.toggleStatusEffect('surprised', { active: false });
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
    if (ids.length) await deleteEffects(actor, ids);
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

/**
 * Combat tracker: under each combatant's name, chips for what it is doing this round (the declared
 * actions) and the Referee's next-roll modifiers, so nobody forgets the Charge bonus.
 */
function markTacticsInTracker(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0] ?? app?.element;
  const combat = game.combat;
  if (!root?.querySelectorAll || !combat) return;
  for (const element of root.querySelectorAll('li[data-combatant-id], .combatant[data-combatant-id]')) {
    element.querySelector(':scope .sdm-tracker-tactics')?.remove();
    const actor = combat.combatants.get(element.dataset.combatantId)?.actor;
    if (!actor) continue;
    const chips = [];
    for (const id of TACTICAL_CONDITIONS) {
      if (has(actor, id)) chips.push({ text: game.i18n.localize(`SDM.Condition.${id}.Name`), tooltip: conditionTooltip(id) });
    }
    for (const effect of actor.effects ?? []) {
      if (effect.getFlag('sdm', 'nextRoll')) chips.push({ text: effect.name, tooltip: effect.name, referee: true });
    }
    if (!chips.length) continue;
    const box = document.createElement('div');
    box.className = 'sdm-tracker-tactics';
    for (const chip of chips) {
      const span = document.createElement('span');
      span.className = `sdm-tracker-chip${chip.referee ? ' referee' : ''}`;
      span.textContent = chip.text;
      span.dataset.tooltip = chip.tooltip;
      box.append(span);
    }
    const name = element.querySelector('.token-name');
    (name ?? element).append(box);
  }
}

/** An actor in the combat gained or lost a declared action or a next-roll modifier: refresh the tracker. */
function refreshTrackerTactics(effect) {
  const actor = effect?.parent;
  if (!(actor instanceof Actor) || !game.combat?.combatants?.some(c => c.actor === actor)) return;
  const relevant = effect.getFlag?.('sdm', 'nextRoll') || [...(effect.statuses ?? [])].some(id => TACTICAL_CONDITIONS.includes(id));
  if (relevant) ui.combat?.render();
}

/**
 * Core only marks an expired effect (suppressed, kept on the actor), so rewinding the combat brings it
 * back. When the combat ends, the Referee's game deletes the expired conditions of everyone who was
 * in it (declared actions, stunned / blinded / confused for a round, a trigger's condition with a
 * duration); other expired effects are left as core leaves them.
 */
const CONDITION_IDS = new Set(CONDITIONS.map(c => c.id));
async function clearExpiredConditions(combat) {
  if (game.users.activeGM?.id !== game.user.id) return;
  for (const actor of new Set(combat.combatants.map(c => c.actor).filter(Boolean))) {
    const ids = actor.effects
      .filter(e => e.duration?.expired && [...(e.statuses ?? [])].some(id => CONDITION_IDS.has(id)))
      .map(e => e.id);
    if (ids.length) await deleteEffects(actor, ids).catch(() => null);
  }
}

/** Token HUD: each condition shows its summary on hover. */
function onRenderTokenHUD(hud, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  root?.querySelectorAll('[data-status-id]').forEach(el => {
    const tooltip = conditionTooltip(el.dataset.statusId);
    if (tooltip) el.dataset.tooltip = tooltip;
  });
}

/* -------------------------------------------- */
/*  Sees invisible: the token's See Invisibility  */
/* -------------------------------------------- */

const SEE_MODE = 'seeInvisibility';

/** The token's detection modes as { id: { enabled, range } } (array or record, whichever the core keeps). */
function modesOf(token) {
  const modes = token.detectionModes ?? token._source?.detectionModes;
  if (Array.isArray(modes)) return Object.fromEntries(modes.map(m => [m.id, m]));
  return modes ?? {};
}

/**
 * Give or take the token's See Invisibility detection mode, following the actor's Sees invisible
 * status (only what this added is taken away: a mode set by hand stays). Range: as far as the
 * scene goes (the token's sight range is often 0 — it sees only lit areas — which would see nothing).
 */
const SEE_RANGE = 9999;
async function syncSeeInvisibility(token, on) {
  if (!CONFIG.Canvas?.detectionModes?.[SEE_MODE]) return;
  const raw = token._source?.detectionModes;
  const modes = modesOf(token);
  const added = !!token.getFlag?.('sdm', 'seeInvisibility');
  const mode = modes[SEE_MODE];
  // Set by hand: left alone; added by this and already working: nothing to do
  if (on && mode && !added) return;
  if (on && mode?.enabled && mode.range >= SEE_RANGE) return;
  if (!on && (!mode || !added)) return;
  const range = SEE_RANGE;
  let next;
  if (Array.isArray(raw)) {
    const others = raw.filter(m => m.id !== SEE_MODE);
    next = on ? [...others, { id: SEE_MODE, enabled: true, range }] : others;
    await token.update({ detectionModes: next, 'flags.sdm.seeInvisibility': on });
  } else {
    await token.update(
      on
        ? { [`detectionModes.${SEE_MODE}`]: { enabled: true, range }, 'flags.sdm.seeInvisibility': true }
        : { [`detectionModes.-=${SEE_MODE}`]: null, 'flags.sdm.seeInvisibility': false }
    );
  }
}

/** Every token of the actor (linked: all scenes; unlinked: its own token). */
function tokensOf(actor) {
  if (actor?.isToken) return [actor.token].filter(Boolean);
  return game.scenes.contents.flatMap(scene => scene.tokens.filter(t => t.actorLink && t.actorId === actor?.id));
}

async function syncActor(actor) {
  if (!(actor instanceof Actor)) return;
  const on = has(actor, 'seeInvisible');
  for (const token of tokensOf(actor)) await syncSeeInvisibility(token, on);
}

// The status on the actor, or on one of its items (Eerie Sense gives it while the NPC has it)
async function onSeeInvisibleChange(effect) {
  if (game.users.activeGM?.id !== game.user.id || !effect.statuses?.has?.('seeInvisible')) return;
  await syncActor(effect.parent instanceof Actor ? effect.parent : effect.parent?.parent);
}

async function onItemWithSeeInvisible(item) {
  if (game.users.activeGM?.id !== game.user.id) return;
  if (!item.effects?.some?.(e => e.statuses?.has?.('seeInvisible'))) return;
  await syncActor(item.parent);
}

async function onTokenCreated(token) {
  if (game.users.activeGM?.id !== game.user.id) return;
  if (has(token.actor, 'seeInvisible')) await syncSeeInvisibility(token, true);
}

/** A hidden attacker is seen once it attacks (on the attacker's user's game). */
async function onAttackMessage(message, options, userId) {
  if (!automated() || userId !== game.user.id) return;
  const check = message.getFlag?.('sdm', 'triggerCheck');
  if (check?.kind !== 'attack') return;
  const actor = fromUuidSync(check.actor);
  if (has(actor, 'hidden') && actor.isOwner) await actor.toggleStatusEffect('hidden', { active: false });
}

export function setupConditions() {
  Hooks.on('createChatMessage', onAttackMessage);
  // Sees invisible also gives the token Foundry's See Invisibility (invisible tokens show on the map)
  Hooks.on('createActiveEffect', onSeeInvisibleChange);
  Hooks.on('deleteActiveEffect', onSeeInvisibleChange);
  Hooks.on('updateActiveEffect', onSeeInvisibleChange);
  Hooks.on('createToken', onTokenCreated);
  Hooks.on('createItem', onItemWithSeeInvisible);
  Hooks.on('deleteItem', onItemWithSeeInvisible);
  Hooks.on('preCreateActiveEffect', onPreCreateImmune);
  Hooks.on('preCreateActiveEffect', onPreCreateEffect);
  Hooks.on('preCreateActiveEffect', onPreCreateTactical);
  Hooks.on('renderCombatTracker', markTacticsInTracker);
  // Expired (suppressed by core, kept on the actor as core does) or toggled: the chips follow
  Hooks.on('updateActiveEffect', refreshTrackerTactics);
  Hooks.on('createActiveEffect', refreshTrackerTactics);
  Hooks.on('deleteActiveEffect', refreshTrackerTactics);
  Hooks.on('updateCombat', onCombatTurn);
  Hooks.on('preUpdateActor', onPreUpdateActor);
  Hooks.on('updateActor', onActorHurt);
  Hooks.on('renderTokenHUD', onRenderTokenHUD);
  Hooks.on('deleteCombat', onCombatEnded);
  Hooks.on('deleteCombat', clearExpiredConditions);
}

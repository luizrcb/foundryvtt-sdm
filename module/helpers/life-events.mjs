import { eventTriggers, fireEventTriggers } from '../rolls/triggers.mjs';
import { areaAttackHits } from './areas.mjs';
import { ActorType } from './constants.mjs';

/**
 * Life events for roll triggers (the Referee's game does the work):
 *  - **Hit by an attack**: an attack card that hits a target (or an area attack's hits) fires the
 *    target's "Hit by an attack" triggers (Tactical);
 *  - **Death**: an actor with the defeated (dead) status, or an NPC at 0 life (characters roll for
 *    defeat first), fires its "Death" triggers once (Shatter: on everyone next to it);
 *  - **Kill**: the last one who attacked it fires its "Kill" triggers (Death Hunger counts kills).
 * Who attacked whom last is kept on the target (flags.sdm.lastAttacker), from the attack cards.
 */

const DOWN_FLAG = 'down';
const ATTACKER_FLAG = 'lastAttacker';
const isActiveGM = () => game.user.isGM && game.users.activeGM?.isSelf;

/** Dead: the defeated status (anyone), or an NPC at 0 life. */
export function isDead(actor) {
  if (!actor || ![ActorType.CHARACTER, ActorType.NPC].includes(actor.type)) return false;
  const dead = CONFIG.specialStatusEffects?.DEFEATED ?? 'dead';
  if (actor.statuses?.has?.(dead)) return true;
  const life = actor.system?.life;
  return actor.type === ActorType.NPC && (Number(life?.max) || 0) > 0 && (Number(life?.value) || 0) <= 0;
}

const actorOf = uuid => {
  const doc = uuid ? fromUuidSync(uuid) : null;
  return doc?.documentName === 'Actor' ? doc : doc?.actor ?? null;
};

async function rememberAttacker(target, attacker) {
  if (!target || !attacker || target === attacker) return;
  if (target.getFlag('sdm', ATTACKER_FLAG) !== attacker.uuid) await target.setFlag('sdm', ATTACKER_FLAG, attacker.uuid);
}

/** An attack card: who it was against (remembered), and its hits fire their "Hit by an attack" triggers. */
async function onAttackMessage(message) {
  if (!isActiveGM()) return;
  const check = message.getFlag('sdm', 'triggerCheck');
  if (check?.kind === 'attack' && check.targetUuid) {
    const attacker = actorOf(check.actor);
    const target = actorOf(check.targetUuid);
    await rememberAttacker(target, attacker);
    if (check.success === true && target) await fireEventTriggers(eventTriggers(target, 'hit', { attack: check.attack }), target, { targets: attacker ? [attacker] : null });
  }
  const card = message.getFlag('sdm', 'areaCard');
  if (card?.mode === 'attack') {
    const attacker = actorOf(card.actor);
    for (const uuid of card.inside ?? []) await rememberAttacker(actorOf(uuid), attacker);
    const attack = check?.attack ?? '';
    for (const target of areaAttackHits(card)) await fireEventTriggers(eventTriggers(target, 'hit', { attack }), target, { targets: attacker ? [attacker] : null });
  }
}

/** The actors whose tokens are next to the actor's token (within a square of its edge), on its scene. */
function nextTo(actor) {
  const token = actor.getActiveTokens?.(false, true)?.[0];
  const scene = token?.parent;
  if (!token || !scene) return [];
  const size = scene.grid.size;
  const box = t => ({ x: t.x, y: t.y, w: (Number(t.width) || 1) * size, h: (Number(t.height) || 1) * size });
  const a = box(token);
  const near = [];
  for (const other of scene.tokens) {
    if (other === token || !other.actor) continue;
    const b = box(other);
    const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
    const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
    if (Math.max(gapX, gapY) < size) near.push(other.actor);
  }
  return [...new Set(near)];
}

/** Dead now and not before (or alive again): its death and its killer's kill fire once. */
async function checkDeath(actor) {
  if (!isActiveGM() || !actor) return;
  const dead = isDead(actor);
  const was = !!actor.getFlag('sdm', DOWN_FLAG);
  if (dead === was) return;
  if (!dead) return actor.unsetFlag('sdm', DOWN_FLAG);
  await actor.setFlag('sdm', DOWN_FLAG, true);
  await fireEventTriggers(eventTriggers(actor, 'death'), actor, { targets: nextTo(actor) });
  const killer = actorOf(actor.getFlag('sdm', ATTACKER_FLAG));
  if (killer && killer !== actor) await fireEventTriggers(eventTriggers(killer, 'kill'), killer, { targets: [actor] });
}

const deadStatus = () => CONFIG.specialStatusEffects?.DEFEATED ?? 'dead';
function onStatusEffect(effect) {
  if (!effect.statuses?.has?.(deadStatus())) return;
  const actor = effect.parent;
  if (actor instanceof Actor) checkDeath(actor).catch(error => console.error('SDM | Death check failed', error));
}

export function setupLifeEvents() {
  Hooks.on('createChatMessage', message => onAttackMessage(message).catch(error => console.error('SDM | Attack event failed', error)));
  Hooks.on('updateActor', (actor, changes) => {
    if (foundry.utils.hasProperty(changes, 'system.life')) checkDeath(actor).catch(error => console.error('SDM | Death check failed', error));
  });
  Hooks.on('createActiveEffect', onStatusEffect);
  Hooks.on('deleteActiveEffect', onStatusEffect);
  Hooks.on('updateActiveEffect', onStatusEffect);
}

import { $fmt, $l10n } from './globalUtils.mjs';

/**
 * Hero dice on initiative. Every initiative card (a group's roll or one combatant's) remembers its
 * combat, its round and whose initiative it set. Any character can spend hero dice on it (raise or
 * lower it) until the round's first turn ends; the new total goes to everyone that roll set, each
 * keeping its tie-break decimals. The Referee's game makes the change.
 */

const QUERY = 'sdm.initiativeHeroDice';
export const INITIATIVE_HERO_CLASS = 'sdm-initiative-hero';

const esc = text => foundry.utils.escapeHTML(String(text ?? ''));
const twoDecimals = value => Math.round(value * 100) / 100;

/** The initiative a card set ({ combat, round, tokens }): an initiative roll, or a hero dice result on one. */
export function initiativeData(message) {
  return message?.getFlag?.('sdm', 'initiative') ?? message?.getFlag?.('sdm', 'heroFlags')?.sdm?.initiative ?? null;
}

/** Still open: the same round (a roll before the combat started counts for round 1) and its first turn not over. */
export function initiativeOpen(data) {
  const combat = game.combats.get(data?.combat ?? '');
  if (!combat) return false;
  const round = Number(data.round) || 0;
  const sameRound = round === combat.round || (round === 0 && combat.round <= 1);
  return sameRound && (!combat.started || (Number(combat.turn) || 0) === 0);
}

/** A hero dice result was made from this card: hero dice go on the newest one only. */
function superseded(message) {
  return game.messages.contents.some(other => other.getFlag?.('sdm', 'heroOf') === message.id);
}

/** Hero dice can be spent on this initiative card now. */
export function canSpendOnInitiative(message) {
  const data = initiativeData(message);
  return !!data && initiativeOpen(data) && !superseded(message);
}

/** After hero dice changed an initiative roll: its new total for everyone that roll set. */
export async function applyInitiativeHeroDice(data, total) {
  if (!data || !Number.isFinite(Number(total))) return;
  const request = { ...data, total: Number(total), userId: game.user.id };
  if (game.user.isGM) return setInitiative(request);
  const gm = game.users.activeGM;
  if (!gm) return ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
  try {
    await gm.query(QUERY, request, { timeout: 30000 });
  } catch (error) {
    console.error('SDM | Changing the initiative failed', error);
  }
}

async function setInitiative({ combat: combatId, round, tokens = [], total }) {
  const combat = game.combats.get(combatId ?? '');
  if (!combat || !initiativeOpen({ combat: combatId, round })) return false;
  const updates = [];
  const names = [];
  for (const tokenId of tokens) {
    const combatant = combat.combatants.find(c => c.tokenId === tokenId);
    if (!combatant || combatant.initiative === null || combatant.initiative === undefined) continue;
    // Its tie-break decimals stay (9.24 → 12.24): the group's order and the tie-breaks don't change
    const fraction = twoDecimals(combatant.initiative - Math.floor(combatant.initiative));
    updates.push({ _id: combatant.id, initiative: twoDecimals(total + fraction) });
    names.push(combatant.name);
  }
  if (!updates.length) return false;
  // Still the first turn: the order starts again from the top
  await combat.updateEmbeddedDocuments('Combatant', updates, { turnEvents: false, combatTurn: combat.turn ?? 0 });
  await ChatMessage.create({
    content: `<p><i class="fa-solid fa-bolt"></i> ${$fmt('SDM.InitiativeHero.Changed', { total, names: names.map(esc).join(', ') })}</p>`
  });
  return true;
}

/** Every initiative roll is tagged with its combat, round and whose initiative it sets. */
function onPreCreateChatMessage(message) {
  if (!message.getFlag('core', 'initiativeRoll')) return;
  const { scene, token } = message.speaker ?? {};
  if (!token) return;
  const holds = combat => combat.combatants.some(c => c.tokenId === token && (!scene || c.sceneId === scene));
  const combat = (game.combat && holds(game.combat) ? game.combat : null) ?? game.combats.find(holds);
  if (!combat) return;
  // A group roll names its whole group; a single roll, its own token
  const group = message.getFlag('sdm', 'initiativeGroup');
  message.updateSource({
    'flags.sdm.initiative': { combat: combat.id, round: combat.round ?? 0, tokens: Array.isArray(group) && group.length ? group : [token] }
  });
}

/** Past the first turn (or a new round): the hero dice buttons of initiative cards go. */
function onUpdateCombat() {
  document.querySelectorAll(`button.${INITIATIVE_HERO_CLASS}`).forEach(button => {
    const message = game.messages.get(button.dataset.messageId ?? '');
    if (!message || !canSpendOnInitiative(message)) button.remove();
  });
}

export function setupInitiativeHeroDice() {
  CONFIG.queries[QUERY] = setInitiative;
  Hooks.on('preCreateChatMessage', onPreCreateChatMessage);
  Hooks.on('updateCombat', onUpdateCombat);
  Hooks.on('deleteCombat', onUpdateCombat);
  // A newer hero dice result takes over: the card it came from loses its button
  Hooks.on('createChatMessage', message => {
    const source = message.getFlag?.('sdm', 'heroOf');
    if (source) document.querySelectorAll(`button.${INITIATIVE_HERO_CLASS}[data-message-id="${source}"]`).forEach(button => button.remove());
  });
}

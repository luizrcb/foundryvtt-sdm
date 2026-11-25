import { isDown } from './auras.mjs';
import { resolveFormulaReferences } from './effectReferences.mjs';
import { showSideDice } from './formulas.mjs';

/**
 * Healing each turn (regeneration): an effect with *Heal each turn* gives its actor that much life at
 * the start of each of its turns in combat (Regenerates: 1d6), unless the actor has one of the
 * effect's *Not while* conditions (burning, corroded…) or is down (0 life, defeated). The active
 * Referee's game rolls it; the life card names the effect.
 */

const esc = text => foundry.utils.escapeHTML(String(text ?? ''));

/** The actor's effects that heal each turn (on, with a formula). */
function healingEffects(actor) {
  return [...(actor?.allApplicableEffects?.() ?? [])].filter(e => e.active && `${e.system?.turnHeal?.formula ?? ''}`.trim());
}

async function rollHealing(effect, actor) {
  const item = effect.parent?.documentName === 'Item' ? effect.parent : null;
  const formula = resolveFormulaReferences(effect.system.turnHeal.formula, { actor, item });
  try {
    const roll = await new Roll(formula, actor.getRollData()).evaluate();
    await showSideDice(roll);
    return Math.max(Number(roll.total) || 0, 0);
  } catch (error) {
    console.warn(`SDM | ${effect.name}: heal each turn "${formula}" could not be rolled`, error);
    return 0;
  }
}

async function onTurnStart(combat, changed, options) {
  if (!('turn' in (changed ?? {})) && !('round' in (changed ?? {}))) return;
  if (!combat.started || game.users.activeGM?.id !== game.user.id) return;
  if (options?.direction !== undefined && options.direction < 0) return;
  const actor = combat.combatant?.actor;
  if (!actor || isDown(actor)) return;
  for (const effect of healingEffects(actor)) {
    const blocking = (effect.system.turnHeal.blockedBy ?? []).filter(id => actor.statuses?.has?.(id));
    if (blocking.length) {
      const names = blocking.map(id => game.i18n.localize(CONFIG.statusEffects.find(s => s.id === id)?.name ?? id)).join(', ');
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<p>${esc(game.i18n.format('SDM.TurnHeal.Blocked', { effect: effect.name, conditions: names }))}</p>`
      });
      continue;
    }
    const amount = await rollHealing(effect, actor);
    if (amount > 0) await actor.applyDamage(amount, -1, false, true, { reason: effect.name });
  }
}

export function setupTurnHeal() {
  Hooks.on('updateCombat', onTurnStart);
}

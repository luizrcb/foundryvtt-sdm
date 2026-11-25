import { showSideDice } from './formulas.mjs';
import { resolveFormulaReferences } from './effectReferences.mjs';

/**
 * Dice in effect values (Field Glove: +1d6 defense): when an effect with a change like `1d6` lands on
 * an actor (Use, a trigger, an aura's copy, by hand), each such value is rolled once and stored as a
 * number, so the change applies like any other. The roll shows (Dice So Nice too) and a chat line
 * says what came up. Effects that stay on an item (its bearer's effects) are rolled when copied.
 */

// A dice term (1d6, d8, 2d4x…), not a reference such as @actor.level
const HAS_DICE = /(^|[^@\w.])\d*d\d+/i;
const esc = text => foundry.utils.escapeHTML(String(text ?? ''));

function onPreCreateEffect(effect, data, options, userId) {
  if (userId !== game.user.id) return;
  const actor = effect.parent;
  if (!(actor instanceof Actor)) return;
  const changes = foundry.utils.deepClone(effect._source.system?.changes ?? []);
  const rolled = [];
  for (const change of changes) {
    const value = `${change.value ?? ''}`.trim();
    if (!HAS_DICE.test(value)) continue;
    const item = effect.origin ? fromUuidSync(effect.origin) : null;
    const formula = resolveFormulaReferences(value, { actor, item: item?.documentName === 'Item' ? item : null });
    if (!foundry.dice.Roll.validate(formula)) continue;
    try {
      const roll = new Roll(formula, actor.getRollData()).evaluateSync({ strict: false });
      change.value = `${roll.total}`;
      rolled.push({ roll, formula: value, total: roll.total });
    } catch (error) {
      console.warn(`SDM | ${effect.name}: could not roll "${value}"`, error);
    }
  }
  if (!rolled.length) return;
  effect.updateSource({ 'system.changes': changes });
  for (const { roll } of rolled) showSideDice(roll);
  const lines = rolled.map(({ formula, total }) => game.i18n.format('SDM.EffectDice.Rolled', { effect: effect.name, total, formula }));
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: lines.map(line => `<p><i class="fa-solid fa-dice"></i> ${esc(line)}</p>`).join('')
  });
}

export function setupEffectDice() {
  Hooks.on('preCreateActiveEffect', onPreCreateEffect);
}

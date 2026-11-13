import { ItemType } from '../helpers/constants.mjs';
import { $fmt, $l10n } from '../helpers/globalUtils.mjs';

/**
 * Roll triggers of gear, highlighted on chat cards:
 *  - attack: natural N on the d20 (attacks are not tied to a weapon, so the readied items of the
 *    attacker are checked),
 *  - damage (that item's damage roll): total N, any die showing N, all dice at their maximum,
 *    all dice at 1, or two dice matching.
 */

const esc = text => foundry.utils.escapeHTML?.(String(text ?? '')) ?? String(text ?? '');

function activeResults(roll) {
  return (roll?.dice ?? []).flatMap(die => die.results.filter(r => r.active !== false).map(r => ({ value: r.result, faces: die.faces })));
}

function naturalD20(roll) {
  const d20 = (roll?.dice ?? []).find(die => die.faces === 20);
  return d20?.results.find(r => r.active !== false)?.result ?? null;
}

function matches(trigger, roll) {
  const results = activeResults(roll);
  switch (trigger.condition) {
    case 'natural':
      return naturalD20(roll) === trigger.value;
    case 'total':
      return Number(roll.total) === trigger.value;
    case 'die':
      return results.some(r => r.value === trigger.value);
    case 'max':
      return results.length > 0 && results.every(r => r.value === r.faces);
    case 'min':
      return results.length > 0 && results.every(r => r.value === 1);
    case 'matching': {
      const values = results.map(r => r.value);
      return values.length > 1 && new Set(values).size < values.length;
    }
    default:
      return false;
  }
}

/** Triggers of an attack: the readied gear of the attacker with matching "natural" triggers. */
export function attackTriggers(actor, roll) {
  const fired = [];
  for (const item of actor?.items ?? []) {
    if (item.type !== ItemType.GEAR || !item.system.readied) continue;
    for (const trigger of item.system.triggers ?? []) {
      if (trigger.roll === 'attack' && matches(trigger, roll)) fired.push({ item, trigger });
    }
  }
  return fired;
}

/** Triggers of an item's damage roll. */
export function damageTriggers(item, roll) {
  return (item?.system?.triggers ?? [])
    .filter(trigger => trigger.roll === 'damage' && matches(trigger, roll))
    .map(trigger => ({ item, trigger }));
}

export function describeCondition(trigger) {
  return $fmt(`SDM.Trigger.Condition.${trigger.condition}`, { value: trigger.value });
}

export function renderTriggers(fired) {
  if (!fired.length) return '';
  const rows = fired
    .map(
      ({ item, trigger }) =>
        `<li><i class="fa-solid fa-bolt"></i> <b>${esc(item.name)}</b> (${esc(describeCondition(trigger))}): ${esc(trigger.text)}</li>`
    )
    .join('');
  return `<div class="sdm-roll-triggers"><b>${$l10n('SDM.Trigger.Fired')}</b><ul>${rows}</ul></div>`;
}

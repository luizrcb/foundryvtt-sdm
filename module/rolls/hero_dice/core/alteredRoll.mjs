import { RollAnalyzer } from './RollAnalyzer.mjs';

/**
 * The roll as the hero dice left it: a copy of the original roll whose target dice show their new
 * values (and explosions), with the kept dice marked active and the total of the hero dice result.
 * The hero dice result card carries it, so hero dice can be spent again on that result: the next
 * ones act on the dice as they are now.
 * @param {Roll} originalRoll
 * @param {object} result  HeroDiceEngine.process result
 * @returns {Promise<Roll|null>}
 */
export async function alteredRoll(originalRoll, result) {
  if (!originalRoll || !result?.explosiveDice?.length) return null;
  let roll;
  try {
    roll = Roll.fromData(foundry.utils.deepClone(originalRoll.toJSON()));
    const { targetDice } = await new RollAnalyzer(roll).identifyTargetComponents();
    const kept = new Set(result.keptDice ?? []);
    const keptGroups = new Set();
    let k = 0;
    for (const dieTerm of targetDice) {
      const count = (dieTerm.results ?? []).length;
      const explosions = [];
      for (let index = 0; index < count; index++) {
        const die = result.explosiveDice[k++];
        if (!die) return null;
        const res = dieTerm.results[index];
        const isKept = kept.has(die) && !die.removed;
        const inPool = die.groupId !== null && die.groupId !== undefined;
        res.result = die.modifiedValue;
        // In a pool the group is kept or dropped (below); its dice stay active
        res.active = inPool || isKept;
        res.discarded = !res.active;
        if (isKept && inPool) keptGroups.add(die.groupId);
        if (die.newExplosions?.length) {
          res.exploded = true;
          explosions.push(...die.newExplosions.map((value, i, all) => ({
            result: value,
            active: res.active,
            discarded: !res.active,
            exploded: i < all.length - 1
          })));
        }
      }
      if (explosions.length) dieTerm.results.push(...explosions);
    }
    if (k !== result.explosiveDice.length) return null;
    // Pools ({1d20, 1d20}kh): the group kept now
    const visit = terms => {
      for (const term of terms ?? []) {
        if (term instanceof foundry.dice.terms.PoolTerm) {
          (term.results ?? []).forEach((res, group) => {
            const isKept = keptGroups.has(group);
            res.active = isKept;
            res.discarded = !isKept;
          });
          for (const inner of term.rolls ?? []) visit(inner.terms);
        } else if (term instanceof foundry.dice.terms.ParentheticalTerm && term.roll) visit(term.roll.terms);
      }
    };
    visit(roll.terms);
  } catch (error) {
    console.warn('SDM | Could not rebuild the roll after hero dice', error);
    return null;
  }
  roll._evaluated = true;
  roll._total = Number(result.total) || 0;
  return roll;
}

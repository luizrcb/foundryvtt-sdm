// tests/diag/hooks.mjs
import { snapExplosive, snapHeroPool, snapKeep } from './snapshots.mjs';

export function installDiagHooks({ RollAnalyzer, HeroDiceAllocator, ExplosiveDie }, diag) {
  const wrap = (obj, fn, mk) => {
    const o = obj[fn];
    obj[fn] = mk(o);
    obj[fn].__orig = o;
  };

  wrap(
    RollAnalyzer.prototype,
    'identifyTargetComponents',
    orig =>
      async function (...args) {
        const out = await orig.apply(this, args);
        diag.push('analyzer.identifyTargetComponents', {
          shouldExplode: out.shouldExplode,
          targetMultiplier: out.targetMultiplier,
          nonTargetValue: out.nonTargetValue,
          targetDiceCount: out.targetDice?.length || 0
        });
        return out;
      }
  );

  wrap(
    RollAnalyzer.prototype,
    'getKeepRule',
    orig =>
      function (...args) {
        const kr = orig.apply(this, args);
        diag.push('analyzer.getKeepRule', snapKeep(kr));
        return kr;
      }
  );

  wrap(
    HeroDiceAllocator,
    'allocate',
    orig =>
      function (explosiveDice, heroicResults, keepRule, opts = {}) {
        diag.push('allocator.allocate.begin', {
          mode: opts.mode || 'increase',
          keep: snapKeep(keepRule),
          heroes: snapHeroPool(heroicResults),
          dice: (explosiveDice || []).map(snapExplosive)
        });
        const res = orig.apply(this, arguments);
        diag.push('allocator.allocate.end', {
          usedHeroIndexes: res?.usedHeroIndexes || [],
          explosionCount: res?.explosionCount ?? null
        });
        return res;
      }
  );

  if (ExplosiveDie?.prototype?.applyHeroic) {
    wrap(
      ExplosiveDie.prototype,
      'applyHeroic',
      orig =>
        async function (...args) {
          const before = (this.newExplosions || []).length;
          const ret = await orig.apply(this, args);
          const after = (this.newExplosions || []).length;
          if (after > before) {
            diag.push('explosive.exploded', {
              dieIndex: this.dieIndex,
              added: this.newExplosions.slice(before)
            });
          }
          return ret;
        }
    );
  }
}

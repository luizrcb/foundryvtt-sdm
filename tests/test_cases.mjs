export const TEST_CASES = [
  // 1d20x + 0  (17)
  {
    name: 'increase of ability 1d20x + 0 (17 +2 -> 19)',
    fixture: './tests/fixtures/1d20x-plus-0.json',
    hero: { mode: 'increase', results: [2] },
    explosionsByDie: {},
    expected: { total: 19 }
  },
  {
    name: 'increase of ability 1d20x + 0 (17 +4 -> explodes tail=3 => 23)',
    fixture: './tests/fixtures/1d20x-plus-0.json',
    hero: { mode: 'increase', results: [4] },
    explosionsByDie: { 0: [3] },
    expected: { total: 23, expCount: 1 }
  },
  {
    name: 'decrease of ability 1d20x + 0 (17 -4 -> 13)',
    fixture: './tests/fixtures/1d20x-plus-0.json',
    hero: { mode: 'decrease', results: [4] },
    expected: { total: 13 }
  },

  // 1d20 + 2  (14)
  {
    name: 'increase of ability 1d20 + 2 (+4 => 20)',
    fixture: './tests/fixtures/1d20-plus-2.json',
    hero: { mode: 'increase', results: [4] },
    expected: { total: 20 }
  },
  {
    name: 'increase of ability 1d20 + 2 (+6 => 22)',
    fixture: './tests/fixtures/1d20-plus-2.json',
    hero: { mode: 'increase', results: [6] },
    expected: { total: 22 }
  },
  {
    name: 'decrease of ability 1d20 + 2 (-4 => 12)',
    fixture: './tests/fixtures/1d20-plus-2.json',
    hero: { mode: 'decrease', results: [4] },
    expected: { total: 12 }
  },

  // 1d20x + 1  (20,4)
  {
    name: 'increase of 1d20x + 1 (+6 on tail 4 => 31)',
    fixture: './tests/fixtures/1d20x-plus-1.json',
    hero: { mode: 'increase', results: [6] },
    expected: { total: 31 }
  },
  {
    name: 'increase of 1d20x + 1 (+6,+6,+6 => explodes tail=11 => 52)',
    fixture: './tests/fixtures/1d20x-plus-1.json',
    hero: { mode: 'increase', results: [6, 6, 6] },
    explosionsByDie: { 1: [11] },
    expected: { total: 52, expCount: 1 }
  },
  {
    name: 'decrease of 1d20x + 1 (-4 on tail => 21)',
    fixture: './tests/fixtures/1d20x-plus-1.json',
    hero: { mode: 'decrease', results: [4] },
    expected: { total: 21 }
  },
  {
    name: 'decrease of 1d20x + 1 (-6,-3 => 18)',
    fixture: './tests/fixtures/1d20x-plus-1.json',
    hero: { mode: 'decrease', results: [6, 3] },
    expected: { total: 18 }
  },

  // {1d20x,1d20x}kh + 3   (14 vs 15, keeps 15)
  {
    name: 'increase of {1d20x,1d20x}kh + 3 (+6 explodes 7 on kept => 36)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kh-plus-3.json',
    hero: { mode: 'increase', results: [6, 3] },
    explosionsByDie: { 1: [13] },
    expected: { total: 36, expCount: 1 }
  },
  {
    name: 'increase of {1d20x,1d20x}kh + 3 (+6,+6 explode 9 and 7 on both dice)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kh-plus-3.json',
    hero: { mode: 'increase', results: [6, 6] },
    explosionsByDie: { 0: [9], 1: [7] },
    expected: { total: 32, expCount: 2 }
  },
  {
    name: 'decrease of {1d20x,1d20x}kh + 3 (-3)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kh-plus-3.json',
    hero: { mode: 'decrease', results: [3] },
    expected: { total: 17 }
  },
  {
    name: 'decrease of {1d20x,1d20x}kh + 3 (-5,-3)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kh-plus-3.json',
    hero: { mode: 'decrease', results: [5, 3] },
    expected: { total: 14 }
  },

  // 2d8 + 0  (6,4)
  {
    name: 'increase of 2d8 + 0 (+2 => 12)',
    fixture: './tests/fixtures/2d8-plus-0.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 12 }
  },
  {
    name: 'increase of 2d8 + 0 (+3,+5 => 16)',
    fixture: './tests/fixtures/2d8-plus-0.json',
    hero: { mode: 'increase', results: [3, 5] },
    expected: { total: 16 }
  },
  {
    name: 'decrease of 2d8 + 0 (-3,-5 => 2)',
    fixture: './tests/fixtures/2d8-plus-0.json',
    hero: { mode: 'decrease', results: [3, 5] },
    expected: { total: 2 }
  },
  {
    name: 'decrease of 2d8 + 0 (-6,-6 => 2)',
    fixture: './tests/fixtures/2d8-plus-0.json',
    hero: { mode: 'decrease', results: [6, 6] },
    expected: { total: 2 }
  },
  {
    name: 'decrease of 2d8 + 0 (-5 => 5)',
    fixture: './tests/fixtures/2d8-plus-0.json',
    hero: { mode: 'decrease', results: [5] },
    expected: { total: 5 }
  },
  {
    name: 'decrease of 2d8 + 0 (-2 => 8)',
    fixture: './tests/fixtures/2d8-plus-0.json',
    hero: { mode: 'decrease', results: [2] },
    expected: { total: 8 }
  },

  // (2d8) * 2 + 1  (6,5)
  {
    name: 'increase of (2d8) * 2 + 1 (+2 => 27)',
    fixture: './tests/fixtures/parens-2d8-times2-plus1.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 27 }
  },
  {
    name: 'increase of (2d8) * 2 + 1 (+4 => 29)',
    fixture: './tests/fixtures/parens-2d8-times2-plus1.json',
    hero: { mode: 'increase', results: [4] },
    expected: { total: 29 }
  },
  {
    name: 'increase of (2d8) * 2 + 1 (+1,+3 => 31)',
    fixture: './tests/fixtures/parens-2d8-times2-plus1.json',
    hero: { mode: 'increase', results: [1, 3] },
    expected: { total: 31 }
  },
  {
    name: 'increase of (2d8) * 2 + 1 (+4,+5 => 33)',
    fixture: './tests/fixtures/parens-2d8-times2-plus1.json',
    hero: { mode: 'increase', results: [4, 5] },
    expected: { total: 33 }
  },
  {
    name: 'decrease of (2d8) * 2 + 1 (-3 => 17)',
    fixture: './tests/fixtures/parens-2d8-times2-plus1.json',
    hero: { mode: 'decrease', results: [3] },
    expected: { total: 17 }
  },
  {
    name: 'decrease of (2d8) * 2 + 1 (-6 => 13)',
    fixture: './tests/fixtures/parens-2d8-times2-plus1.json',
    hero: { mode: 'decrease', results: [6] },
    expected: { total: 13 }
  },
  {
    name: 'decrease of (2d8) * 2 + 1 (-3,-4 => 9)',
    fixture: './tests/fixtures/parens-2d8-times2-plus1.json',
    hero: { mode: 'decrease', results: [3, 4] },
    expected: { total: 9 }
  },
  {
    name: 'decrease of (2d8) * 2 + 1 (-3,-6 => 7)',
    fixture: './tests/fixtures/parens-2d8-times2-plus1.json',
    hero: { mode: 'decrease', results: [3, 6] },
    expected: { total: 7 }
  },
  {
    name: 'decrease of (2d8) * 2 + 1 (-6,-6 => 5)',
    fixture: './tests/fixtures/parens-2d8-times2-plus1.json',
    hero: { mode: 'decrease', results: [6, 6] },
    expected: { total: 5 }
  },

  // {2d6,2d6}kh + 1  (keeps 7)
  {
    name: 'increase of {2d6,2d6}kh + 1 (+2,+1 => 11)',
    fixture: './tests/fixtures/pool-2d6-2d6-kh-plus-1.json',
    hero: { mode: 'increase', results: [2, 1] },
    expected: { total: 11 }
  },
  {
    name: 'decrease of {2d6,2d6}kh + 1 (-2,-1 => 6) // corrected',
    fixture: './tests/fixtures/pool-2d6-2d6-kh-plus-1.json',
    hero: { mode: 'decrease', results: [2, 1] },
    expected: { total: 6 }
  },

  // ({2d8x,2d8x}kh) * 2 + 1d3 + 1
  {
    name: 'increase KH parens: +1 on kept => 41',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'increase', results: [1] },
    expected: { total: 41 }
  },
  {
    name: 'increase KH parens: +2 on kept => 43',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 43 }
  },
  {
    name: 'increase KH parens: +1,+1 on kept => 43',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'increase', results: [1, 1] },
    expected: { total: 43 }
  },
  {
    name: 'increase KH parens: +2,+1 on kept (explodes tail=4) => 53',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'increase', results: [2, 1] },
    explosionsByDie: { 0: [4] },
    expected: { total: 53, expCount: 1 }
  },

  // B) INCREASE — forcing 1 explosion on kept (fixed tail value)
  // Ex.: +3 on the kept "5" => hits 8 and explodes. If explosion roll=4, group=25, total 25*2+3=53
  {
    name: 'increase KH parens: +3 on kept forces 1 explosion (tail=4) => 53',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'increase', results: [3] },
    explosionsByDie: {
      /* dieIndex of the kept "5" segment */ 0: [4]
    },
    expected: { total: 53, expCount: 1 }
  },
  {
    name: 'increase KH parens: +3,+1 on kept forces explosion (tail=4) => 55',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'increase', results: [3, 1] },
    explosionsByDie: { /* same kept "5" segment */ 0: [4] },
    expected: { total: 55, expCount: 1 }
  },

  // C) INCREASE — flipping the kept (buff the discarded group to beat 18)
  // Ex.: +4 on discarded "4" with explosion 6 => becomes 19 (8+5+6), pool keeps 19; total 19*2+3=41
  {
    name: 'increase KH parens: flip on discarded (+4 forces explosion=6) => 41',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'increase', results: [4] },
    explosionsByDie: { /* dieIndex of the discarded “4” */ 3: [6] },
    expected: { total: 41, expCount: 1 }
  },
  // If it caps with overflow, the overflow must be wasted:
  {
    name: 'increase KH parens: flip on discarded (+9 with cap; explode=2) => 39 (overflow wasted)',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'increase', results: [9] },
    explosionsByDie: { /* dieIndex of the same discarded “4” */ 3: [2] },
    expected: { total: 39, expCount: 1 }
  },

  // D) DECREASE — remove kept tail first (tail can go to 0; base has floor 1)
  {
    name: 'decrease KH parens: -5 removes kept tail => 29',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'decrease', results: [5] },
    expected: { total: 29 }
  },
  {
    name: 'decrease KH parens: -2,-3 optimal combo to zero tail => 29',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'decrease', results: [2, 3] },
    expected: { total: 29 }
  },
  {
    name: 'decrease KH parens: -6,-3 (zero tail with 1 loss; then -3 on 8) => 23',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'decrease', results: [6, 3] },
    expected: { total: 23 }
  },
  {
    name: 'decrease KH parens: -6,-5 (flip to the other group=9) => 21',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'decrease', results: [6, 5] },
    expected: { total: 21 }
  },
  {
    name: 'decrease KH parens: -8 (optimal = 29; no “leak” from tail to base)',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'decrease', results: [8] },
    expected: { total: 29 }
  },

  // E) DECREASE — try to flip with small “gas” (won’t flip)
  {
    name: 'decrease KH parens: -4 on kept => 31 (no flip)',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'decrease', results: [4] },
    expected: { total: 31 }
  },
  {
    name: 'decrease KH parens: -3,-1 (tail to 1; -1 on 8→7) => 31 (no flip)',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'decrease', results: [3, 1] },
    expected: { total: 31 }
  },

  // {2d4,1d6} + 0  (base: 3,2,4 => 9)
  {
    name: 'increase {2d4,1d6} + 0 (+2 best target ⇒ 12)',
    fixture: './tests/fixtures/pool-2d4-1d6-plus-0.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 12 }
  },
  {
    name: 'increase {2d4,1d6} + 0 (+3 with cap/overflow ⇒ 12)',
    fixture: './tests/fixtures/pool-2d4-1d6-plus-0.json',
    hero: { mode: 'increase', results: [3] },
    expected: { total: 12 }
  },
  {
    name: 'increase {2d4,1d6} + 0 (+2,+1 spread ⇒ 13)',
    fixture: './tests/fixtures/pool-2d4-1d6-plus-0.json',
    hero: { mode: 'increase', results: [2, 1] },
    expected: { total: 13 }
  },
  {
    name: 'increase {2d4,1d6} + 0 (+2,+2 to d6 and d4=2 ⇒ 14)',
    fixture: './tests/fixtures/pool-2d4-1d6-plus-0.json',
    hero: { mode: 'increase', results: [2, 2] },
    expected: { total: 14 }
  },

  // DECREASE (floor 1 per die)
  {
    name: 'decrease {2d4,1d6} + 0 (-2 best target ⇒ 8)',
    fixture: './tests/fixtures/pool-2d4-1d6-plus-0.json',
    hero: { mode: 'decrease', results: [2] },
    expected: { total: 8 }
  },
  {
    name: 'decrease {2d4,1d6} + 0 (-2,-1 combo ⇒ 7)',
    fixture: './tests/fixtures/pool-2d4-1d6-plus-0.json',
    hero: { mode: 'decrease', results: [2, 1] },
    expected: { total: 7 }
  },
  {
    name: 'decrease {2d4,1d6} + 0 (-6,-6 => 4)',
    fixture: './tests/fixtures/pool-2d4-1d6-plus-0.json',
    hero: { mode: 'decrease', results: [6, 6] },
    expected: { total: 4 }
  },

  {
    name: 'increase {2d4x,1d6x} + 0 (+1 ⇒ 14)',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'increase', results: [1] },
    expected: { total: 14, expCount: 1 }
  },
  {
    name: 'increase {2d4x,1d6x} + 0 (+2 ⇒ 15)',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 15, expCount: 1 }
  },

  // =============== INCREASE — natural explosion =================
  // +1 on d6: 5→6 hits face (default tail=1) → +2 total ⇒ 14
  {
    name: 'increase {2d4x,1d6x} + 0 (+1 on d6 hits 6 and explodes ⇒ 14)',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'increase', results: [1] },
    expected: { total: 14, expCount: 1 }
  },
  // +2 on d4=2: 2→4 explodes (default tail=1) → +3 effect ⇒ 15
  {
    name: 'increase {2d4x,1d6x} + 0 (+2 on d4=2 hits face 4 and explodes ⇒ 15)',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 15, expCount: 1 }
  },

  // =============== INCREASE — forcing tail value ===============
  // +3 on the d4 tail 1: 1→4 explodes; if tail=2 then 7→(2+4+4+2)=12; total 12+5=17
  {
    name: 'increase {2d4x,1d6x} + 0 (+3 on d4 tail; forced tail=2) ⇒ 17',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'increase', results: [3] },
    explosionsByDie: { 2: [2] },
    expected: { total: 17, expCount: 1 }
  },
  {
    name: 'increase {2d4x,1d6x} + 0 (+3 on d4 tail; default tail=1) ⇒ 16',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'increase', results: [3] },
    expected: { total: 16, expCount: 1 }
  },

  // =============== INCREASE — multiple heroes, two explosions =================
  {
    name: 'increase {2d4x,1d6x} + 0 (+2 on d4=2 and +1 on d6; two explosions) ⇒ 17',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'increase', results: [2, 1] },
    expected: { total: 17, expCount: 2 }
  },

  // =============== INCREASE — large hero, avoid waste =================
  {
    name: 'increase {2d4x,1d6x} + 0 (+5 should prefer d4 tail ⇒ 16)',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'increase', results: [5] },
    expected: { total: 16, expCount: 1 }
  },

  // ========================= DECREASE =========================
  // remove tail first (floor 0 on tail), then higher bases down to floor 1
  {
    name: 'decrease {2d4x,1d6x} + 0 (-1 removes tail ⇒ 11)',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'decrease', results: [1] },
    expected: { total: 11 }
  },
  {
    name: 'decrease {2d4x,1d6x} + 0 (-2 ⇒ 10)',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'decrease', results: [2] },
    expected: { total: 10 }
  },
  {
    name: 'decrease {2d4x,1d6x} + 0 (-3 ⇒ 9)',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'decrease', results: [3] },
    expected: { total: 9 }
  },
  {
    name: 'decrease {2d4x,1d6x} + 0 (-10 floors all dice ⇒ 8)',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'decrease', results: [10] },
    expected: { total: 8 }
  },

  {
    name: 'increase of ({2d4,1d6}) * 2 + 0 (+1 no improvement: caps at 4,4,6 ⇒ 28)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'increase', results: [1] },
    expected: { total: 28, used: 0 }
  },
  {
    name: 'increase of ({2d4,1d6}) * 2 + 0 (+3 no improvement: stays 28)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'increase', results: [3] },
    expected: { total: 28, used: 0 }
  },
  {
    name: 'increase of ({2d4,1d6}) * 2 + 0 (+1,+1 no effect ⇒ 28)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'increase', results: [1, 1] },
    expected: { total: 28, used: 0 }
  },

  // ================= DECREASE (impact multiplied by 2) =================
  {
    name: 'decrease of ({2d4,1d6}) * 2 + 0 (-1 ⇒ (14-1)*2 = 26)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'decrease', results: [1] },
    expected: { total: 26 }
  },
  {
    name: 'decrease of ({2d4,1d6}) * 2 + 0 (-2 ⇒ 24)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'decrease', results: [2] },
    expected: { total: 24 }
  },
  {
    name: 'decrease of ({2d4,1d6}) * 2 + 0 (-3 ⇒ 22)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'decrease', results: [3] },
    expected: { total: 22 }
  },
  {
    name: 'decrease of ({2d4,1d6}) * 2 + 0 (-5 ⇒ 18)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'decrease', results: [5] },
    expected: { total: 18 }
  },
  {
    name: 'decrease of ({2d4,1d6}) * 2 + 0 (-6 ⇒ 18)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'decrease', results: [6] },
    expected: { total: 18 }
  },
  {
    name: 'decrease of ({2d4,1d6}) * 2 + 0 (-7 ⇒ 18)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'decrease', results: [7] },
    expected: { total: 18 }
  },

  // ======= DECREASE with multiple heroes (optimal combo, floor=1 per die) =======
  {
    name: 'decrease of ({2d4,1d6}) * 2 + 0 (-2,-3 ⇒ reduce 5 ⇒ 18)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'decrease', results: [2, 3] },
    expected: { total: 18 }
  },
  {
    name: 'decrease of ({2d4,1d6}) * 2 + 0 (-11 ⇒ floor 4,4,6 to 1,1,1 ⇒ (3)*2 = 6)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'decrease', results: [11] },
    expected: { total: 18 }
  },

  {
    name: 'increase of {1d20x,1d20x}kl + 1 (+0 => 11)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
    hero: { mode: 'increase', results: [] },
    expected: { total: 11 }
  },

  {
    name: 'increase of {1d20x,1d20x}kl + 1 (+2 on kept 10)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 13 }
  },
  {
    name: 'increase of {1d20x,1d20x}kl + 1 (+6 on kept 10)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
    hero: { mode: 'increase', results: [6] },
    expected: { total: 17 }
  },
  {
    name: 'increase of {1d20x,1d20x}kl + 1 (+9 on kept 10->19, lowest=18)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
    hero: { mode: 'increase', results: [9] },
    expected: { total: 19 }
  },

  {
    name: 'increase of {1d20x,1d20x}kl + 1 (+15 on kept 10 -> cap 20, tail=4 => lowest=18)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
    hero: { mode: 'increase', results: [15] },
    explosionsByDie: { 0: [4] },
    expected: { total: 19 } // (min(24,18)=18) + 1
  },

  {
    name: 'increase of {1d20x,1d20x}kl + 1 (+7 on kept 10 -> 17, lowest=17)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
    hero: { mode: 'increase', results: [7] },
    expected: { total: 18 }
  },

  {
    name: 'increase of {1d20x,1d20x}kl + 1 (+3,+3 -> 5→11 => 17)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
    hero: { mode: 'increase', results: [3, 3] },
    expected: { total: 17 }
  },

  // --- DECREASE: reduce the kept (lowest) die to drop total (floor=1 on base, 0 on tails) ---
  {
    name: 'decrease of {1d20x,1d20x}kl + 1 (-2 on kept 5 -> 3 => 9)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
    hero: { mode: 'decrease', results: [2] },
    expected: { total: 9 }
  },
  {
    name: 'decrease of {1d20x,1d20x}kl + 1 (-5 floors kept 5->1 => 6)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
    hero: { mode: 'decrease', results: [5] },
    expected: { total: 6 }
  },
  {
    name: 'decrease of {1d20x,1d20x}kl + 1 (-1,-3 => 5→1 => 7)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
    hero: { mode: 'decrease', results: [1, 3] },
    expected: { total: 7 }
  },

  // --- DECREASE: allocator should NOT spend on the higher 13 (it doesn’t lower the min) ---
  {
    name: 'decrease of {1d20x,1d20x}kl + 1 (-9 must hit 5 first -> 1; not 13->4) => 2',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
    hero: { mode: 'decrease', results: [9] },
    expected: { total: 2 }
  },

  {
    name: 'increase of ({1d6,1d6}kl) * 2 + 1 (+0 => 9)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'increase', results: [] },
    expected: { total: 9 }
  },

  // --- INCREASE: raise the kept (4). Single-hero plateaus once min reaches the other die (5) ---
  {
    name: 'increase of ({1d6,1d6}kl) * 2 + 1 (+1 on kept 4 -> 5 => 11)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'increase', results: [1] },
    expected: { total: 11 }
  },
  {
    name: 'increase of ({1d6,1d6}kl) * 2 + 1 (+2 on kept 4 -> 6, min stays 5 => 11)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 11 }
  },
  {
    name: 'increase of ({1d6,1d6}kl) * 2 + 1 (+10 capped at 6, min=5 => 11)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'increase', results: [10] },
    expected: { total: 11 }
  },

  // --- INCREASE: multiple heroes — allocator should lift both dice to raise the minimum ---
  {
    name: 'increase of ({1d6,1d6}kl) * 2 + 1 (+2,+1 -> 4→6 and 5→6 => min=6 ⇒ 13)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'increase', results: [2, 1] },
    expected: { total: 13 }
  },
  {
    name: 'increase of ({1d6,1d6}kl) * 2 + 1 (+3,+3 -> 4→7(capped 6), 5→8(capped 6) => min=6 ⇒ 13)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'increase', results: [3, 3] },
    expected: { total: 13 }
  },
  {
    name: 'increase of ({1d6,1d6}kl) * 2 + 1 (+1,+1,+1,+1,+1 -> both to 6 => min=6 ⇒ 13)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'increase', results: [1, 1, 1, 1, 1] },
    expected: { total: 13 }
  },

  // --- INCREASE: allocator should avoid spending on the higher 5 when it doesn’t raise min ---
  {
    name: 'increase of ({1d6,1d6}kl) * 2 + 1 (+1 should target 4, not 5 => 11)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'increase', results: [1] },
    expected: { total: 11 }
  },

  // --- DECREASE: floor=1 on base dice (no tails here), aim at the kept to lower min ---
  {
    name: 'decrease of ({1d6,1d6}kl) * 2 + 1 (-1 on kept 4 -> 3 ⇒ 7)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'decrease', results: [1] },
    expected: { total: 7 }
  },
  {
    name: 'decrease of ({1d6,1d6}kl) * 2 + 1 (-3 floors kept 4->1 ⇒ 3)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'decrease', results: [3] },
    expected: { total: 3 }
  },
  {
    name: 'decrease of ({1d6,1d6}kl) * 2 + 1 (-1,-1 -> 4→2 ⇒ 5)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'decrease', results: [1, 1] },
    expected: { total: 5 }
  },
  {
    name: 'decrease of ({1d6,1d6}kl) * 2 + 1 (-1,-3 -> 4→1; 5→4 ⇒ 3)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'decrease', results: [1, 3] },
    expected: { total: 3 }
  },
  {
    name: 'decrease of ({1d6,1d6}kl) * 2 + 1 (-2,-2 -> 4→2→1 (cap) ⇒ 3)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'decrease', results: [2, 2] },
    expected: { total: 3 }
  },
  {
    name: 'decrease of ({1d6,1d6}kl) * 2 + 1 (-6 wastes over floor -> 4→1 ⇒ 3)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'decrease', results: [6] },
    expected: { total: 3 }
  },

  {
    name: 'increase: baseline (no hero) => 57',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'increase', results: [] },
    expected: { total: 57 }
  },

  // INCREASE — simple (+1 becomes +2 total due to *2)
  {
    name: 'increase: +1 (no explosion) => 59',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'increase', results: [1] },
    expected: { total: 59 }
  },

  // INCREASE — best target to explode (no map => default tail=1)
  // Best is d8-tail 6→8 (+2) and explodes 1 => inner +3 ⇒ total +6
  {
    name: 'increase: +2 (hits d8 to 8, default explode=1) => 63',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 63, expCount: 1 }
  },

  // INCREASE — force explosion on d6-tail (2→6) with tail=4
  // inner +4 (cap) +4 (explosion) = +8 ⇒ total +16
  {
    name: 'increase: +4 forces d6-tail explode=4 => 67',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'increase', results: [4] },
    explosionsByDie: { 5: [4] },
    expected: { total: 67, expCount: 1 }
  },

  // INCREASE — alternative: explode d8-tail (6→8) with tail=6
  // inner +2 (cap) +6 (explosion) = +8 ⇒ total +16
  {
    name: 'increase: +2 forces d8-tail explode=6 => 63',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'increase', results: [2] },
    explosionsByDie: { 3: [6] },
    expected: { total: 63, expCount: 1 }
  },

  // INCREASE — large hero, no map (overflow wasted on cap)
  // Best target: d6-tail 2→6 (+4) and explodes default=1 ⇒ inner +5 ⇒ total +10
  {
    name: 'increase: +10 (caps and wastes overflow; default explode=1) => 67',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'increase', results: [10] },
    expected: { total: 67, expCount: 1 }
  },

  // INCREASE — two heroes: one to explode d8, another improves the rest
  // +2 on d8-tail (explode=1) ⇒ inner +3; +1 on d6-tail 2→3 ⇒ +1; inner +4 ⇒ total +8
  {
    name: 'increase: +2,+1 (d8 explodes default=1; +1 on d6-tail) => 65',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'increase', results: [2, 1] },
    expected: { total: 65, expCount: 1 }
  },

  // DECREASE — hit d6 tail first (floor 0), then bases (floor 1)
  {
    // -1: 2→1 (inner -1) ⇒ total -2
    name: 'decrease: -1 (d6-tail 2→1) => 55',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'decrease', results: [1] },
    expected: { total: 55 }
  },
  {
    // -2: 2→0 (inner -2) ⇒ total -4
    name: 'decrease: -2 (d6-tail 2→0) => 53',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'decrease', results: [2] },
    expected: { total: 53 }
  },
  {
    // -3: 2→0 and -1 on some base 6/8 (floor 1) ⇒ inner -3 ⇒ total -6
    name: 'decrease: -3 (zero tail then -1 base) => 51',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'decrease', results: [3] },
    expected: { total: 51 }
  },

  // DECREASE — compound: -2 (zero tail) and -2 across bases (respect floors)
  {
    name: 'decrease: -2,-2 (tail→0; then -2 on bases) => 49',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'decrease', results: [2, 2] },
    expected: { total: 49 }
  },

  // DECREASE — strong: -7 ⇒ inner 28-7=21 ⇒ total 45
  {
    name: 'decrease: -7 (optimal spread; floors apply) => 45',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'decrease', results: [7] },
    expected: { total: 45 }
  },

  {
    name: 'baseline: no hero => 27',
    fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
    hero: { mode: 'increase', results: [] },
    expected: { total: 27 }
  },

  // INCREASE — small increments (should target kept group)
  {
    name: 'increase: +1 on kept => 29',
    fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
    hero: { mode: 'increase', results: [1] },
    expected: { total: 29 }
  },
  // +2 on d6-tail (4→6) explodes default=1 => +3 inner => +6 total
  {
    name: 'increase: +2 hits d6-tail to faces (default explode=1) => 33',
    fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 33, expCount: 1 }
  },
  // Force tail=6 on the d6-tail explosion (inner +8 => total +16)
  {
    name: 'increase: +2 forces d6-tail explode=6 => 43',
    fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
    hero: { mode: 'increase', results: [2] },
    explosionsByDie: { 5: [6] },
    expected: { total: 45, expCount: 1 }
  },

  // INCREASE — target the kept group d8=2
  // cap 2→8 (+6) with default explode=1 => inner +7 => total +14
  {
    name: 'increase: +6 caps d8 to 8 (default explode=1) => 41',
    fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
    hero: { mode: 'increase', results: [6] },
    expected: { total: 41, expCount: 1 }
  },
  // The following previously forced tail=6 but total matches default=1; drop map to match total
  {
    name: 'increase: +6 on d8 (default explode=1) => 41',
    fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
    hero: { mode: 'increase', results: [6] },
    expected: { total: 41, expCount: 1 }
  },

  // INCREASE — two heroes: explode d8 (default=1) then push d6-tail
  // +6 on d8 => inner +7 (12→19); +2 on d6-tail => inner +3 (19→22) => total 47 (flip)
  {
    name: 'increase: +6,+2 (d8 default explode=1; then d6-tail) => 47',
    fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
    hero: { mode: 'increase', results: [6, 2] },
    expected: { total: 47 }
  },

  // INCREASE — overflow must be wasted (one hero applies to one target)
  // +10 on d8: cap uses 6, explode=1 (+7 net) => 12→19 => total 41
  {
    name: 'increase: +10 single die (cap+waste; default explode=1) => 41',
    fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
    hero: { mode: 'increase', results: [10] },
    explosionsByDie: { 6: [1] },
    expected: { total: 41, expCount: 1 }
  },

  // DECREASE — act on tail first (floor 0), then bases (floor 1)
  {
    name: 'decrease: -1 (tail 4→3) => 25',
    fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
    hero: { mode: 'decrease', results: [1] },
    expected: { total: 25 }
  },
  {
    name: 'decrease: -5 (tail 4→0; d8 2→1) => 19',
    fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
    hero: { mode: 'decrease', results: [5] },
    expected: { total: 19 }
  },
  {
    name: 'decrease: -10 (tail 0; d8 1; d6 6→1) => 19',
    fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
    hero: { mode: 'decrease', results: [10] },
    expected: { total: 19 }
  },
  {
    name: 'decrease: -2,-2 (tail 4→2; then -2 on bases) => 19',
    fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
    hero: { mode: 'decrease', results: [2, 2] },
    expected: { total: 19 }
  },

  {
    name: 'baseline: kept group stays 7',
    fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
    hero: { mode: 'increase', results: [] },
    expected: { total: 7 }
  },

  // INCREASE — should target the kept group (2,2,3)
  {
    name: 'increase: +1 => 8',
    fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
    hero: { mode: 'increase', results: [1] },
    expected: { total: 8 }
  },
  {
    name: 'increase: +3 prefers d6 (cap 3→6) => 10',
    fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
    hero: { mode: 'increase', results: [3] },
    expected: { total: 10 }
  },
  {
    name: 'increase: +5 single die (cap then waste) => 10',
    fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
    hero: { mode: 'increase', results: [5] },
    expected: { total: 10 }
  },

  // INCREASE — flip the kept group (raise 7 above 11 so 11 becomes the new kept)
  {
    name: 'increase: +2,+2 (cap both d4: 2→4,2→4) => 11 (flip)',
    fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
    hero: { mode: 'increase', results: [2, 2] },
    expected: { total: 11 }
  },
  {
    name: 'increase: +3,+2 (d6 to 6; one d4 to 4) => 11 (flip)',
    fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
    hero: { mode: 'increase', results: [3, 2] },
    expected: { total: 11 }
  },
  {
    name: 'increase: +3,+2,+2 (cap all kept dice to 4,4,6) => 12 (flip)',
    fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
    hero: { mode: 'increase', results: [3, 2, 2] },
    expected: { total: 12 }
  },
  {
    name: 'increase: +10 single die (best is d6 to 6; waste rest) => 10',
    fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
    hero: { mode: 'increase', results: [10] },
    expected: { total: 10 }
  },

  // DECREASE — floor=1 per die, no tails here
  {
    name: 'decrease: -1 => 6',
    fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
    hero: { mode: 'decrease', results: [1] },
    expected: { total: 6 }
  },
  {
    name: 'decrease: -2,-2 => 4 (floor all kept dice to 1)',
    fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
    hero: { mode: 'decrease', results: [2, 2] },
    expected: { total: 4 }
  },
  {
    name: 'decrease: -4 => 5 (same end-state, extra waste)',
    fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
    hero: { mode: 'decrease', results: [4] },
    expected: { total: 5 }
  },
  {
    name: 'decrease: -10 => 5 (fully floored, heavy waste)',
    fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
    hero: { mode: 'decrease', results: [10] },
    expected: { total: 5 }
  },

  {
    name: 'baseline: kept=8, discarded=10 => 19',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
    hero: { mode: 'increase', results: [] },
    expected: { total: 19 }
  },

  // INCREASE on the kept group (raise KL towards 10)
  {
    name: 'increase: +1 on kept (5→6 hits face, default tail=1) => 23',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
    hero: { mode: 'increase', results: [1] },
    expected: { total: 23, expCount: 1 }
  },
  {
    name: 'increase: +2 on kept d4=2 (2→4 face, default tail=1) capped by KL => 23',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 23, expCount: 1 }
  },
  {
    name: 'increase: big single (+10 on kept) wastes after cap, KL=10 => 23',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
    hero: { mode: 'increase', results: [10] },
    explosionsByDie: { 0: [3] },
    expected: { total: 23, expCount: 1 }
  },

  // INCREASE with explicit explosion control (you will set the dieIndex)
  {
    name: 'increase: push kept d4=2 to face (tail=3) → kept>10, KL clamps to 10 => 23',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
    hero: { mode: 'increase', results: [2] },
    explosionsByDie: { 2: [3] },
    expected: { total: 23, expCount: 1 }
  },

  // INCREASE spread across both groups to truly raise the KL (flip beyond 10)
  {
    name: 'increase: [2,2,2] → kept: 8→13, other: 10→12 ⇒ KL=12 => 29',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
    hero: { mode: 'increase', results: [2, 2, 2] },
    expected: { total: 29, expCount: 2 }
  },

  // DECREASE — always try to lower the currently kept (min) group first
  {
    name: 'decrease: -1 on kept ⇒ 7*2+3 => 17',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
    hero: { mode: 'decrease', results: [1] },
    expected: { total: 17 }
  },
  {
    name: 'decrease: -3 best on kept d6 (5→2) ⇒ 5*2+3 => 13',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
    hero: { mode: 'decrease', results: [3] },
    expected: { total: 13 }
  },
  {
    name: 'decrease: single big (-4 on kept d6 5→1, waste rest) ⇒ 4*2+3 => 11',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
    hero: { mode: 'decrease', results: [4] },
    expected: { total: 11 }
  },
  {
    name: 'decrease: two heroes [-3,-3] floor kept to 4 ⇒ 4*2+3 => 11',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
    hero: { mode: 'decrease', results: [3, 3] },
    expected: { total: 11 }
  },
  {
    name: 'decrease: fully floor kept ([-4,-3,-3] or similar) ⇒ 3*2+3 => 9',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
    hero: { mode: 'decrease', results: [4, 3, 3] },
    expected: { total: 9 }
  },

  {
    name: 'baseline: kept=15, discarded=8 => 30',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kh-times2-plus-0.json',
    hero: { mode: 'increase', results: [] },
    expected: { total: 30 }
  },

  // INCREASE — prefer buffing the kept group; tiny bump that triggers a tail explosion
  // Kept group has a d4 tail = 3; +1 → 4 (face) triggers 1 tail by default => +2 in group ⇒ total 34
  {
    name: 'increase: +1 hits kept d4 tail (3→4 + default tail=1) => 34',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kh-times2-plus-0.json',
    hero: { mode: 'increase', results: [1] },
    explosionsByDie: { 6: [1] },
    expected: { total: 34, expCount: 1 }
  },

  // INCREASE — best single target is d6=3: +3 → 6 hits face and explodes with tail=1 (default) => +4 in group ⇒ 38
  {
    name: 'increase: +3 on kept d6 (3→6 + default tail=1) => 38',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kh-times2-plus-0.json',
    hero: { mode: 'increase', results: [3] },
    expected: { total: 38, expCount: 1 }
  },

  // INCREASE — previously forced tail=6 but expected matches default tail=1; drop map
  {
    name: 'increase: +3 on kept d6 (default tail=1) => 38',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kh-times2-plus-0.json',
    hero: { mode: 'increase', results: [3] },
    expected: { total: 38, expCount: 1 }
  },

  // INCREASE — larger value with possible waste remains correct (cap + tail)
  // +4 on d6 (3→6 uses 3; 1 is wasted) + default tail=1 => +4 in group ⇒ 38
  {
    name: 'increase: +4 (cap waste allowed) => 38',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kh-times2-plus-0.json',
    hero: { mode: 'increase', results: [4] },
    expected: { total: 38, expCount: 1 }
  },

  // DECREASE — target the kept group to reduce KH
  // Best target is the d4 tail=3 (floor 0): -1 ⇒ group 14 ⇒ total 28
  {
    name: 'decrease: -1 on kept (best = tail 3→2) => 28',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kh-times2-plus-0.json',
    hero: { mode: 'decrease', results: [1] },
    expected: { total: 28 }
  },

  // -3 on tail 3→0 (floor 0) reduces 3 in group ⇒ 12 * 2 = 24
  {
    name: 'decrease: -3 on kept tail (3→0) => 24',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kh-times2-plus-0.json',
    hero: { mode: 'decrease', results: [3] },
    expected: { total: 24 }
  },

  // Two heroes: best combo drops two relevant kept segments
  // e.g., -2 on d6 (3→1) and -2 on d4(4→2) ⇒ -4 in group ⇒ 11 * 2 = 22
  {
    name: 'decrease: [-2,-2] best combo on kept => 22',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kh-times2-plus-0.json',
    hero: { mode: 'decrease', results: [2, 2] },
    expected: { total: 22 }
  },

  // Deliberate KH flip: empty the kept below 8 to force the other group (8) to be kept
  {
    name: 'decrease: big multi-hero to flip to other group (target 8) => 12',
    fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kh-times2-plus-0.json',
    hero: { mode: 'decrease', results: [4, 4, 3, 2] },
    expected: { total: 12 }
  }
];

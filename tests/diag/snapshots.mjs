// tests/diag/snapshots.mjs
export const snapExplosive = d => ({
  dieIndex: d.dieIndex,
  groupId: d.groupId ?? null,
  chainId: d.chainId ?? null,
  segmentIndex: d.segmentIndex ?? 0,
  tail: !!d.isExplosionSegment,
  faces: d.faces,
  base: typeof d.getBaseValue === 'function' ? d.getBaseValue() : d.modifiedValue,
  canExplode: !!d.canExplode
});
export const snapHeroPool = heroes => (heroes || []).map(h => ({ idx: h.index, v: h.result }));
export const snapKeep = kr => ({ type: kr?.type, count: kr?.count, scope: kr?.scope || 'die' });

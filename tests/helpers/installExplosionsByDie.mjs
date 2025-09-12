// tests/helpers/installExplosionsByDie.mjs
export function installExplosionsByDie(ExplosiveDie, map = {}) {
  const orig = ExplosiveDie.prototype.applyHeroic;
  ExplosiveDie.prototype.applyHeroic = async function () {
    if (this.modifiedValue === this.faces && this.newExplosions.length) return this;
    if (this.modifiedValue > this.faces) this.modifiedValue = this.faces;

    if (this.canExplode) {
      while (this.modifiedValue >= this.faces) {
        this.modifiedValue = this.faces;
        const q = map[this.dieIndex] || [];
        const next = q.length ? q.shift() : 1;
        this.newExplosions.push(Number(next) || 1);
        if (Number(next) !== Number(this.faces)) break;
      }
    }
    return this;
  };
  return () => {
    ExplosiveDie.prototype.applyHeroic = orig;
  };
}

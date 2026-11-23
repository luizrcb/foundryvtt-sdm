import { ActorType } from '../helpers/constants.mjs';

const TEMP_LIFE_COLOR = 0x5fb3e8;

/** The temporary life a token's actor has (0: none). */
export function tokenTemporaryLife(actor) {
  if (actor?.type !== ActorType.CHARACTER) return 0;
  return Math.max(Number(actor.system?.temporary_life?.value) || 0, 0);
}

/**
 * Tokens: the life bar also shows temporary life, as a segment in another color after life.
 * The bar is scaled to max life + temporary life.
 */
export class SdmToken extends foundry.canvas.placeables.Token {
  /** @override */
  _drawBar(index, bar, data) {
    const temp = data?.attribute === 'life' ? tokenTemporaryLife(this.actor) : 0;
    if (!temp) return super._drawBar(index, bar, data);

    const max = Math.max(Number(data.max) || 0, 0);
    const val = Math.clamp(Number(data.value) || 0, 0, max);
    const total = Math.max(max + temp, 1);

    const { width, height } = this.document.getSize();
    const s = canvas.dimensions.uiScale;
    const bw = width;
    const bh = 8 * (this.document.height >= 2 ? 1.5 : 1) * s;

    // Life in its usual color (by how full life is), then temporary life
    const colors = this._getBarColors(index, data);
    const color = Color.mix(colors.empty, colors.full, max ? val / max : 0);
    const lifeWidth = (val / total) * bw;
    const tempWidth = (temp / total) * bw;

    bar.clear();
    bar.lineStyle(s, 0x000000, 1.0);
    bar.beginFill(0x000000, 0.5).drawRoundedRect(0, 0, bw, bh, 3 * s);
    if (lifeWidth > 0) bar.beginFill(color, 1.0).drawRoundedRect(0, 0, lifeWidth, bh, 2 * s);
    bar.beginFill(TEMP_LIFE_COLOR, 1.0).drawRoundedRect(lifeWidth, 0, tempWidth, bh, 2 * s);

    const posY = index === 0 ? height - bh : 0;
    bar.position.set(0, posY);
  }
}

/** Redraw the bars when temporary life changes (core only follows the bar's own attribute). */
function onActorUpdated(actor, changed) {
  if (changed?.system?.temporary_life === undefined) return;
  for (const token of actor.getActiveTokens()) token.renderFlags.set({ refreshBars: true });
  if (actor.inCombat) ui.combat?.render();
}

/** Combat tracker: a character's temporary life next to its life ("12 +3"). */
function onRenderCombatTracker(app, html) {
  const combat = app.viewed;
  if (!combat) return;
  for (const row of html.querySelectorAll('.combatant[data-combatant-id]')) {
    const combatant = combat.combatants.get(row.dataset.combatantId);
    const temp = tokenTemporaryLife(combatant?.actor);
    const resource = row.querySelector('.token-resource .resource');
    if (!temp || !resource || resource.querySelector('.sdm-temp-life')) continue;
    const tag = document.createElement('span');
    tag.className = 'sdm-temp-life';
    tag.dataset.tooltip = game.i18n.localize('SDM.TemporaryLife');
    tag.textContent = ` +${temp}`;
    resource.append(tag);
  }
}

export function setupTokenLifeBar() {
  CONFIG.Token.objectClass = SdmToken;
  Hooks.on('updateActor', onActorUpdated);
  Hooks.on('renderCombatTracker', onRenderCombatTracker);
}

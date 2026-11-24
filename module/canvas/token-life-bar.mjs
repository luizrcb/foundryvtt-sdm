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

/** The actor can have temporary life (enabled, or some now / a maximum). */
function hasTemporaryLife(actor) {
  if (actor?.type !== ActorType.CHARACTER) return false;
  const temp = actor.system?.temporary_life;
  return !!temp && (temp.enabled || Number(temp.value) > 0 || Number(temp.max) > 0);
}

/**
 * Token HUD: an input for temporary life next to the life bar's (when the bar shows life).
 * "4" sets it, "+2" / "-2" changes it.
 */
function onRenderTokenHUD(hud, html) {
  const actor = hud.document?.actor;
  if (!hasTemporaryLife(actor)) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  for (const barKey of ['bar1', 'bar2']) {
    if (hud.document.getBarAttribute(barKey)?.attribute !== 'life') continue;
    const container = root?.querySelector(`.attribute.${barKey}`);
    if (!container || container.querySelector('.sdm-temp-life-input')) continue;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sdm-temp-life-input';
    input.value = String(Number(actor.system.temporary_life.value) || 0);
    input.dataset.tooltip = game.i18n.localize('SDM.TemporaryLife');
    input.disabled = !actor.isOwner;
    // Not part of the HUD's form: its own change, so core never reads it
    for (const type of ['change', 'input', 'keydown']) input.addEventListener(type, event => event.stopPropagation());
    input.addEventListener('focus', () => input.select());
    input.addEventListener('change', async event => {
      event.preventDefault();
      const text = input.value.trim();
      const current = Number(actor.system.temporary_life.value) || 0;
      const number = Number(text);
      if (text === '' || !Number.isFinite(number)) {
        input.value = String(current);
        return;
      }
      const next = Math.max(/^[+-]/.test(text) ? current + number : number, 0);
      await actor.update({ 'system.temporary_life.value': next });
    });
    container.classList.add('sdm-has-temp-life');
    container.append(input);
  }
}

export function setupTokenLifeBar() {
  Hooks.on('renderTokenHUD', onRenderTokenHUD);
  CONFIG.Token.objectClass = SdmToken;
  Hooks.on('updateActor', onActorUpdated);
  Hooks.on('renderCombatTracker', onRenderCombatTracker);
}

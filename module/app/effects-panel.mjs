import { conditionTooltip } from '../helpers/conditions.mjs';
import { auraSourceName, isAura, isAuraCopy, listedEffects } from '../helpers/auras.mjs';
import { templatePath } from '../helpers/templates.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const EXCERPT_LENGTH = 140;

/** The first characters of a description, as plain text (escaped), "…" when cut. */
function excerpt(html) {
  const div = document.createElement('div');
  div.innerHTML = `${html ?? ''}`;
  const text = div.textContent.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const cut = text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH).replace(/\s+\S*$/, '')}…` : text;
  return `<em>${foundry.utils.escapeHTML(cut)}</em>`;
}

/**
 * A small HUD next to the sidebar listing the temporary effects and conditions of the
 * controlled token's actor (or the user's assigned character), with their remaining duration, and
 * its auras: those it radiates (marked) and those it receives ("Aura from …"). The Referee removes an
 * effect with a right-click (not a received aura: it comes back while the token is inside).
 */
export default class SdmEffectsPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'sdm-effects-panel',
    classes: ['sdm-effects-panel'],
    tag: 'aside',
    window: { frame: false, positioned: false },
    actions: {
      openEffect: SdmEffectsPanel.#onOpenEffect
    }
  };

  static PARTS = {
    panel: { template: templatePath('app/effects-panel/panel') }
  };

  /** Debounced re-render, shared by every hook that can change the panel contents. */
  refresh = foundry.utils.debounce(() => this.render({ force: true }), 100);

  /** The actor whose effects are displayed. */
  get actor() {
    const controlled = canvas?.tokens?.controlled ?? [];
    if (controlled.length) return controlled[0].actor ?? null;
    return game.user.character ?? null;
  }

  /** Whether an effect belongs in the panel. */
  static isDisplayed(effect) {
    if (effect.disabled) return false;
    return (
      isAura(effect) ||
      isAuraCopy(effect) ||
      effect.isTemporary ||
      !!effect.getFlag?.('sdm', 'temporary') ||
      effect.statuses?.size > 0 ||
      !!effect.duration?.expired
    );
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    context.actor = actor;
    context.effects = [];
    if (!actor || !game.settings.get('sdm', 'showEffectsPanel')) return context;

    // Its own auras too (they don't apply to it, so allApplicableEffects leaves them out)
    for (const effect of listedEffects(actor)) {
      if (!SdmEffectsPanel.isDisplayed(effect)) continue;
      const duration = effect.duration ?? {};
      const expired = !!duration.expired;
      const remaining = expired
        ? game.i18n.localize('SDM.Effect.Expired')
        : Number.isFinite(duration.remaining) && duration.label
          ? duration.label
          : '';
      // Conditions show their summary
      const status = [...(effect.statuses ?? [])].map(id => conditionTooltip(id)).find(Boolean);
      // A received aura says where from; its own aura says it's an aura
      const copy = isAuraCopy(effect);
      const from = copy ? game.i18n.format('SDM.Aura.From', { name: auraSourceName(effect) }) : isAura(effect) ? game.i18n.localize('SDM.Aura.Title') : '';
      // An aura: the start of its description too, on its own line
      const about = from ? excerpt(effect.description) : '';
      const tooltip = status
        ? [status, from, remaining, about].filter(Boolean).join('<br>')
        : [
            [effect.name, from, remaining, !copy && effect.sourceName && effect.parent !== actor ? effect.sourceName : ''].filter(Boolean).join(' — '),
            about
          ]
            .filter(Boolean)
            .join('<br>');
      context.effects.push({
        uuid: effect.uuid,
        name: effect.name,
        img: effect.img || 'icons/svg/aura.svg',
        remaining,
        expired,
        tooltip,
        aura: isAura(effect) && !copy,
        // The Referee's right-click: effects stored on the actor, not received auras
        canDelete: game.user.isGM && effect.parent === actor && !copy
      });
    }
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.classList.toggle('empty', !context.effects.length);
    this.setPosition();

    // Right-click removes the effect (the Referee; only effects stored directly on the actor)
    for (const li of this.element.querySelectorAll('[data-uuid][data-can-delete]')) {
      li.addEventListener('contextmenu', async event => {
        event.preventDefault();
        const effect = await fromUuid(li.dataset.uuid);
        await effect?.delete();
      });
    }
  }

  /** Keep the panel just to the left of the sidebar. Returns the sidebar's left edge. */
  setPosition() {
    const sidebar = document.getElementById('sidebar');
    const left = sidebar?.getBoundingClientRect().left ?? window.innerWidth;
    if (this.element) this.element.style.right = `${Math.max(window.innerWidth - left + 8, 8)}px`;
    return left;
  }

  /**
   * Follow the sidebar while it moves (expanding / collapsing animates its width): reposition every
   * frame until its edge has stayed put for a few frames, so the panel slides along with it.
   */
  follow() {
    this._followUntil = performance.now() + 1500;
    if (this._following) return;
    this._following = true;
    let last = null;
    let still = 0;
    const step = () => {
      const left = this.setPosition();
      still = left === last ? still + 1 : 0;
      last = left;
      if (still < 8 && performance.now() < this._followUntil) requestAnimationFrame(step);
      else this._following = false;
    };
    requestAnimationFrame(step);
  }

  static async #onOpenEffect(event, target) {
    const effect = await fromUuid(target.closest('[data-uuid]')?.dataset.uuid);
    if (effect?.isOwner) effect.sheet.render(true);
  }

  /** Create the panel and register the hooks that keep it up to date. */
  static initialize() {
    const panel = new SdmEffectsPanel();
    game.sdm.effectsPanel = panel;
    const refresh = () => panel.refresh();
    const refreshIfRelevant = doc => {
      const actor = panel.actor;
      if (!actor) return;
      const owner = doc?.parent instanceof Item ? doc.parent.parent : doc?.parent;
      if (owner === actor) refresh();
    };

    for (const hook of ['controlToken', 'canvasReady', 'updateCombat', 'deleteCombat', 'updateWorldTime']) {
      Hooks.on(hook, refresh);
    }
    for (const hook of ['createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect']) {
      Hooks.on(hook, refreshIfRelevant);
    }
    Hooks.on('updateItem', item => {
      if (item.parent === panel.actor && item.effects.size) refresh();
    });
    Hooks.on('updateUser', (user, changes) => {
      if (user.isSelf && 'character' in changes) refresh();
    });
    // Slide along with the sidebar: on collapse / expand, on any of its transitions, and whenever its
    // size changes (resizing the sidebar, the window, popping tabs in and out)
    Hooks.on('collapseSidebar', () => panel.follow());
    Hooks.on('changeSidebarTab', () => panel.follow());
    window.addEventListener('resize', () => panel.follow());
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.addEventListener('transitionrun', () => panel.follow());
      sidebar.addEventListener('transitionend', () => panel.follow());
      new ResizeObserver(() => panel.follow()).observe(sidebar);
    }

    panel.render({ force: true });
  }
}

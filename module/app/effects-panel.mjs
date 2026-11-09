import { templatePath } from '../helpers/templates.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A small HUD next to the sidebar listing the temporary effects and conditions of the
 * controlled token's actor (or the user's assigned character), with their remaining duration.
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
    return effect.isTemporary || effect.statuses?.size > 0 || !!effect.duration?.expired;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    context.actor = actor;
    context.effects = [];
    if (!actor || !game.settings.get('sdm', 'showEffectsPanel')) return context;

    for (const effect of actor.allApplicableEffects()) {
      if (!SdmEffectsPanel.isDisplayed(effect)) continue;
      const duration = effect.duration ?? {};
      const expired = !!duration.expired;
      const remaining = expired
        ? game.i18n.localize('SDM.Effect.Expired')
        : Number.isFinite(duration.remaining) && duration.label
          ? duration.label
          : '';
      const tooltip = [effect.name, remaining, effect.sourceName && effect.parent !== actor ? effect.sourceName : '']
        .filter(Boolean)
        .join(' — ');
      context.effects.push({
        uuid: effect.uuid,
        name: effect.name,
        img: effect.img || 'icons/svg/aura.svg',
        remaining,
        expired,
        tooltip,
        canDelete: effect.parent === actor && effect.isOwner
      });
    }
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.classList.toggle('empty', !context.effects.length);
    this.setPosition();

    // Right-click removes the effect (only effects stored directly on the actor)
    for (const li of this.element.querySelectorAll('[data-uuid][data-can-delete]')) {
      li.addEventListener('contextmenu', async event => {
        event.preventDefault();
        const effect = await fromUuid(li.dataset.uuid);
        await effect?.delete();
      });
    }
  }

  /** Keep the panel just to the left of the sidebar. */
  setPosition() {
    if (!this.element) return;
    const sidebar = document.getElementById('sidebar');
    const left = sidebar?.getBoundingClientRect().left ?? window.innerWidth;
    this.element.style.right = `${Math.max(window.innerWidth - left + 8, 8)}px`;
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
    Hooks.on('collapseSidebar', () => panel.setPosition());
    window.addEventListener('resize', () => panel.setPosition());

    panel.render({ force: true });
  }
}

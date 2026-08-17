import { addCompendiumItemToActor } from '../../helpers/actorUtils.mjs';
import { ActorType } from '../../helpers/constants.mjs';
import { $fmt, $l10n } from '../../helpers/globalUtils.mjs';
import { templatePath } from '../../helpers/templates.mjs';
import { buildTableList, rollTypeLabel } from './GroupCheckHelpers.mjs';
import { GroupCheckRollService } from './GroupCheckRollService.mjs';
import { GroupCheckSocket } from './GroupCheckSocket.mjs';
import { GroupCheckState } from './GroupCheckState.mjs';

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

export class GroupCheckDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'group-check-dialog',
    classes: ['sdm', 'group-check'],
    tag: 'form',
    window: {
      title: 'SDM.GroupCheck',
      resizable: true
    },

    position: { width: 750, height: 600 },
    actions: {
      refreshActors: GroupCheckDialog.#onRefreshActors,
      toggleAllActors: GroupCheckDialog.#onToggleAllActors,
      startCheck: GroupCheckDialog.#onStartCheck,
      rollActor: GroupCheckDialog.#onRollActor,
      reRollActor: GroupCheckDialog.#onReRollActor,
      useHeroDice: GroupCheckDialog.#onUseHeroDice,
      forceAll: GroupCheckDialog.#onForceAll,
      postResults: GroupCheckDialog.#onPostResults,
      notifyPlayers: GroupCheckDialog.#onNotifyPlayers,
      resetCheck: GroupCheckDialog.#onResetCheck,
      makeEasier: GroupCheckDialog.#onMakeEasier,
      makeHarder: GroupCheckDialog.#onMakeHarder,
      toggleHideDC: GroupCheckDialog.#onToggleHideDC
    }
  };

  static PARTS = {
    dialog: {
      template: templatePath('group-check/dialog')
    }
  };

  /**
   * @this {GroupCheckDialog}
   */
  static async #onRefreshActors(event, target) {
    const app = /** @type {GroupCheckDialog} */ (this);
    if (!game.user.isGM) return;
    await app._refreshActors();
  }

  /**
   * @this {GroupCheckDialog}
   */
  static #onToggleAllActors(event, target) {
    const app = /** @type {GroupCheckDialog} */ (this);
    if (!game.user.isGM) return;
    const selectAll = target.dataset.selectAll === 'true';
    const updated = app.groupState.actors.map(a => ({ ...a, selected: selectAll }));
    app.groupState.setActors(updated);
  }

  /**
   * @this {GroupCheckDialog}
   */
  static #onStartCheck(event, target) {
    const app = /** @type {GroupCheckDialog} */ (this);
    if (!game.user.isGM) return;

    const form = app.element;
    if (!form) return;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const selectedIds = [];
    const checkboxes = form.querySelectorAll('input[type="checkbox"][name^="actor-"]');
    for (const cb of checkboxes) {
      if (cb.checked) {
        const actorId = cb.dataset.actorId;
        if (actorId) selectedIds.push(actorId);
      }
    }

    const selectedActors = app.groupState.actors.filter(a => selectedIds.includes(a.id));
    if (selectedActors.length === 0) {
      ui.notifications.warn($l10n('SDM.SelectOneActor'));
      return;
    }

    const resetActors = selectedActors.map(a => ({
      ...a,
      status: 'pending',
      result: null,
      success: null,
      outcome: null,
      outcomeLabel: null,
      tableResult: null,
      lastRoll: null,
      hasUsedHeroDice: false
    }));
    app.groupState.setActors(resetActors);
    app.groupState.setRollType(data.rollType || 'ability');
    app.groupState.setAbilityKey(data.abilityKey || 'str');
    app.groupState.setRollMode(data.rollMode || 'normal');
    app.groupState.setUseHeroDice(!!data.useHeroDice);
    app.groupState.setDc(parseInt(data.dc, 10) || 0);
    app.groupState.setModifier(parseInt(data.modifier, 10) || 0);
    app.groupState.setCustomFormula(data.customFormula || '2d6');
    app.groupState.setTableUuid(data.tableUuid || '');
    app.groupState.setProvokeConflict(!!data.provokeConflict);
    app.groupState.setDescription(data.description || '');
    app.groupState.setHideDC(!!data.hideDC);
    app.groupState.startCheck(game.user.id);
    app.socket.sendOpenDialog(app.groupState.data);
  }

  /**
   * @this {GroupCheckDialog}
   */
  static #onNotifyPlayers(event, target) {
    const app = /** @type {GroupCheckDialog} */ (this);
    if (!game.user.isGM) return;
    app.socket.sendOpenDialog(app.groupState.data);
    ui.notifications.info($l10n('SDM.PlayerNotificationSent'));
  }

  /**
   * @this {GroupCheckDialog}
   */
  static async #onResetCheck(event, target) {
    const app = /** @type {GroupCheckDialog} */ (this);
    if (!game.user.isGM) return;

    const proceed = await DialogV2.confirm({
      content: `<b>${$fmt('SDM.GenericConfirmation')}</b>`,
      modal: true,
      rejectClose: false,
      yes: { label: $l10n('SDM.ButtonYes') },
      no: { label: $l10n('SDM.ButtonNo') }
    });
    if (!proceed) return;

    app.socket.sendReset();
    app.socket.sendClose();

    app.groupState.setRollType('ability');
    app.groupState.setAbilityKey('str');
    app.groupState.setDc(0);
    app.groupState.setModifier(0);
    app.groupState.setCustomFormula('2d6');
    app.groupState.setTableUuid('');
    app.groupState.setProvokeConflict(false);
    app.groupState.setDescription('');
    app.groupState.setRollMode('normal');
    app.groupState.setUseHeroDice(false);
    app.groupState.setHideDC(false);
    app.groupState.data.started = false;
    app.groupState.data.gmId = null;
    app.groupState.data.active = false;

    await app._refreshActors();
  }

  /**
   * @this {GroupCheckDialog}
   */
  static #onToggleHideDC(event, target) {
    const app = /** @type {GroupCheckDialog} */ (this);
    if (!game.user.isGM) return;
    app.groupState.setHideDC(target.checked);
  }

  /**
   * @this {GroupCheckDialog}
   */
  static #onMakeEasier(event, target) {
    const app = /** @type {GroupCheckDialog} */ (this);
    if (!game.user.isGM) return;
    app.groupState.setDc(Math.max(0, app.groupState.dc - 2));
  }

  /**
   * @this {GroupCheckDialog}
   */
  static #onMakeHarder(event, target) {
    const app = /** @type {GroupCheckDialog} */ (this);
    if (!game.user.isGM) return;
    app.groupState.setDc(Math.min(99, app.groupState.dc + 2));
  }

  /**
   * @this {GroupCheckDialog}
   */
  static #onRollActor(event, target) {
    const app = /** @type {GroupCheckDialog} */ (this);
    const actorId = target.dataset.actorId;
    if (!actorId) return;
    const actor = fromUuidSync(actorId);
    if (!game.user.isGM && (!actor || !actor.isOwner)) {
      ui.notifications.warn('Permission denied.');
      return;
    }
    app.rollService.rollForActor(actorId);
  }

  /**
   * @this {GroupCheckDialog}
   */
  static #onReRollActor(event, target) {
    const app = /** @type {GroupCheckDialog} */ (this);
    if (!game.user.isGM) return;
    const actorId = target.dataset.actorId;
    app.rollService.rollForActor(actorId, true);
  }

  /**
   * @this {GroupCheckDialog}
   */
  static #onUseHeroDice(event, target) {
    const app = /** @type {GroupCheckDialog} */ (this);
    const actorId = target.dataset.actorId;
    if (!actorId) return;
    const actor = fromUuidSync(actorId);
    if (!game.user.isGM && (!actor || !actor.isOwner)) {
      ui.notifications.warn('Permission denied.');
      return;
    }
    app.rollService.applyHeroDice(actorId);
  }

  /**
   * @this {GroupCheckDialog}
   */
  static #onForceAll(event, target) {
    const app = /** @type {GroupCheckDialog} */ (this);
    if (!game.user.isGM) return;
    const pending = app.groupState.actors.filter(a => a.status === 'pending');
    if (!pending.length) {
      ui.notifications.info($l10n('SDM.AllActorsHaveRolled'));
      return;
    }
    (async () => {
      for (const actorData of pending) {
        await app.rollService.rollForActor(actorData.id);
      }
    })();
  }

  /**
   * @this {GroupCheckDialog}
   */
  static #onPostResults(event, target) {
    const app = /** @type {GroupCheckDialog} */ (this);
    if (!game.user.isGM) return;
    app._postResults();
  }

  constructor(options = {}) {
    super(options);
    GroupCheckDialog._instance = this;
    this.groupState = GroupCheckState.getInstance();
    this.rollService = GroupCheckRollService.getInstance();
    this.socket = GroupCheckSocket.getInstance();
    this._renderBound = this.render.bind(this);
    this.groupState.onChange(this._renderBound);
    this._rollTypeHandler = null;
    this._formChangeListener = null;
  }

  async _onClose(options) {
    if (GroupCheckDialog._instance === this) {
      GroupCheckDialog._instance = null;
    }
    this.groupState.offChange(this._renderBound);

    if (this._formChangeListener) {
      const form = this.element;
      if (form) {
        form.removeEventListener('change', this._formChangeListener);
      }
      this._formChangeListener = null;
    }

    if (this._rollTypeHandler) {
      const form = this.element;
      if (form) {
        const select = form.querySelector('[name="rollType"]');
        if (select) select.removeEventListener('change', this._rollTypeHandler);
      }
      this._rollTypeHandler = null;
    }

    if (game.user.isGM) {
      this.socket.sendReset();
      this.socket.sendClose();
      this.groupState.setRollType('ability');
      this.groupState.setAbilityKey('str');
      this.groupState.setDc(0);
      this.groupState.setModifier(0);
      this.groupState.setCustomFormula('2d6');
      this.groupState.setTableUuid('');
      this.groupState.setProvokeConflict(false);
      this.groupState.setDescription('');
      this.groupState.setRollMode('normal');
      this.groupState.setUseHeroDice(false);
      this.groupState.setHideDC(false);
      this.groupState.data.started = false;
      this.groupState.data.gmId = null;
      this.groupState.data.active = false;
      await this._refreshActors();
    }

    await super._onClose(options);
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    if (game.user.isGM) {
      await this._refreshActors();
    }
  }

  _bindFormChanges() {
    const form = this.element;
    if (!form) return;

    if (this._formChangeListener) {
      form.removeEventListener('change', this._formChangeListener);
    }

    const state = this.groupState;

    this._formChangeListener = event => {
      const target = event.target;
      if (!target || !target.name) return;

      const name = target.name;

      if (name.startsWith('actor-')) {
        const actorId = target.dataset.actorId;
        const checked = target.checked;
        const actors = state.actors.map(a => {
          if (a.id === actorId) {
            return { ...a, selected: checked };
          }
          return a;
        });
        state.setActors(actors);
        return;
      }

      switch (name) {
        case 'modifier':
          state.setModifier(parseInt(target.value, 10) || 0);
          break;
        case 'abilityKey':
          state.setAbilityKey(target.value);
          break;
        case 'customFormula':
          state.setCustomFormula(target.value);
          break;
        case 'tableUuid':
          state.setTableUuid(target.value);
          break;
        case 'rollMode':
          state.setRollMode(target.value);
          break;
        case 'description':
          state.setDescription(target.value);
          break;
        case 'hideDC':
          state.setHideDC(target.checked);
          break;
        case 'useHeroDice':
          state.setUseHeroDice(target.checked);
          break;
        case 'provokeConflict':
          state.setProvokeConflict(target.checked);
          break;
      }
    };

    form.addEventListener('change', this._formChangeListener);
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const form = this.element;
    if (!form) return;

    const select = form.querySelector('[name="rollType"]');
    if (select) {
      if (this._rollTypeHandler) select.removeEventListener('change', this._rollTypeHandler);
      this._rollTypeHandler = e => {
        const newType = e.target.value;
        this.groupState.setRollType(newType);
        const defaultDCs = { ability: 0, saving: 13, table: 0, custom: 11 };
        this.groupState.setDc(defaultDCs[newType] || 0);
      };
      select.addEventListener('change', this._rollTypeHandler);
    }

    this._bindFormChanges();
  }

  async _prepareContext(options) {
    const isGM = game.user.isGM;
    const state = this.groupState.data;

    const showDCInDialog = (isGM || !state.hideDC) && state.dc > 0;

    let filteredActors = state.actors;
    if (!isGM) {
      filteredActors = filteredActors.filter(a => {
        const actor = fromUuidSync(a.id);
        return actor && actor.isOwner;
      });
    }

    const actorsWithPermissions = filteredActors.map(a => {
      const actor = fromUuidSync(a.id);
      const canRoll = a.status !== 'rolled' && (isGM || (actor && actor.isOwner));
      const hasHeroDice = actor
        ? actor.system.hero_dice?.value > 0 ||
          (actor.system.tourist_dice?.enabled && actor.system.tourist_dice?.value > 0)
        : false;
      return { ...a, canRoll, hasHeroDice };
    });

    const rollModeOptions = Object.entries(CONFIG.SDM.rollMode).map(([key, label]) => ({
      value: key,
      label: $l10n(label)
    }));

    const language = game.i18n.lang;
    const abilities = CONFIG.SDM.getOrderedAbilities(language);
    const abilityKeys = Object.keys(abilities);
    const tables = await buildTableList();

    let selectedTableLabel = '';
    if (state.tableUuid) {
      const found = tables.find(t => t.uuid === state.tableUuid);
      if (found) selectedTableLabel = found.label;
    }

    return {
      ...state,
      isGM,
      actors: actorsWithPermissions,
      abilities,
      abilityKeys,
      rollTypeOptions: [
        { value: 'ability', label: $l10n('SDM.Ability') },
        { value: 'saving', label: $l10n('SDM.FieldSaveTarget') },
        { value: 'custom', label: $l10n('SDM.Custom') },
        { value: 'table', label: $l10n('SDM.Table') }
      ],
      rollModeOptions,
      tables,
      selectedTableLabel,
      hasActors: actorsWithPermissions.length > 0,
      allRolled: actorsWithPermissions.every(a => a.status === 'rolled'),
      canPost: state.started && actorsWithPermissions.every(a => a.status === 'rolled'),
      showIndividualRolls: game.settings.get('sdm', 'groupCheckShowIndividualRolls'),
      _rollTypeLabel: rollTypeLabel,
      showDCInDialog,
      hideDC: state.hideDC
    };
  }

  async _refreshActors() {
    const actorSet = new Set();
    const actors = [];

    const isOwnedByPlayer = actor => {
      if (!actor) return false;
      for (const user of game.users) {
        if (user.isGM) continue;
        if (actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) {
          return true;
        }
      }
      return false;
    };

    const controlledTokens = canvas.tokens?.controlled || [];
    const selectedActorIds = new Set();
    for (const token of controlledTokens) {
      if (token.actor) {
        selectedActorIds.add(token.actor.uuid);
      }
    }

    const addActor = actor => {
      if (!actor) return;
      if (actorSet.has(actor.uuid)) return;
      actorSet.add(actor.uuid);
      actors.push({
        id: actor.uuid,
        name: actor.name,
        img: actor.img || 'icons/svg/mystery-man.svg',
        status: 'pending',
        result: null,
        success: null,
        outcome: null,
        outcomeLabel: null,
        tableResult: null,
        selected: true,
        lastRoll: null,
        hasUsedHeroDice: false
      });
    };

    for (const actor of game.actors.filter(a => a.type === ActorType.CHARACTER)) {
      addActor(actor);
    }

    for (const caravan of game.actors.filter(a => a.type === ActorType.CARAVAN)) {
      const isSelected = selectedActorIds.has(caravan.uuid);
      const isOwned = isOwnedByPlayer(caravan);
      if (isSelected || isOwned) {
        selectedActorIds.delete(caravan.uuid);

        const crew = caravan.system?.crew || {};
        for (const entry of Object.values(crew)) {
          const actorUuid = entry.id;
          if (!actorUuid) continue;
          try {
            const doc = await fromUuid(actorUuid);
            if (doc) {
              addActor(doc);
            }
          } catch {}
        }
      }
    }

    for (const actorId of selectedActorIds) {
      try {
        const actor = await fromUuid(actorId);
        if (actor && !actorSet.has(actorId)) {
          addActor(actor);
        }
      } catch {}
    }

    if (actors.length === 0) {
      ui.notifications.warn(
        $l10n('SDM.GroupRollNoActor')
      );
      return;
    }

    this.groupState.setActors(actors);
    this.groupState.data.started = false;
    this.groupState._emitChange();
  }

  async _postResults() {
    const state = this.groupState.data;
    const rolled = state.actors.filter(a => a.status === 'rolled');
    if (!rolled.length) {
      return;
    }

    if (state.rollType === 'table') {
      const promises = [];
      for (const actorData of rolled) {
        const roll = actorData.lastRoll;
        if (!roll) continue;
        const firstResult = roll.results?.[0];
        if (!firstResult) continue;
        const docUuid = firstResult.documentUuid;
        if (!docUuid) continue;

        try {
          const actor = await fromUuid(actorData.id);
          if (actor) {
            promises.push(addCompendiumItemToActor(actor, docUuid));
          }
        } catch (err) {
          console.warn(`Error adding item to ${actorData.name}:`, err);
        }
      }
      Promise.allSettled(promises).catch(() => {});
    }

    let content = ``;
    if (state.description) content += `<p><em>${state.description}</em></p>`;
    content += `<p><strong>${$l10n('SDM.ButtonRoll')}:</strong> ${rollTypeLabel(state.rollType)}`;
    if (state.rollType === 'ability' || state.rollType === 'saving') {
      const abilityLabel = CONFIG.SDM.abilities?.[state.abilityKey] || state.abilityKey;
      content += ` (${$l10n(abilityLabel)})`;
    }
    if (state.rollType === 'custom') {
      content += ` (${state.customFormula})`;
    }
    if (state.dc > 0) content += `, <strong>${$l10n('SDM.Target')}:</strong> ${state.dc}`;
    if (state.modifier) {
      const sign = state.modifier > 0 ? '+' : '';
      content += `, <strong>${$l10n('SDM.RollModifier')}:</strong> ${sign}${state.modifier}`;
    }

    if (state.rollType === 'table') {
      const table = await fromUuid(state.tableUuid);
      if (table) content += ` (${table.name})`;
    }
    content += `</p>`;

    content += `<table class="chat-results-table">
  <tr><th>${$l10n('SDM.Actor')}</th>
  ${`<th>${$l10n('SDM.PowerRollFormulaAbbr')}</th>`}
  ${state.dc > 0 ? `<th>${$l10n('SDM.Result')}</th>` : ''}</tr>`;

    for (const a of rolled) {
      content += `<tr><td>${a.name}</td>`;
      if (state.rollType === 'table') {
        content += `<td class="result-number">${a.tableResult || a.result || '—'}</td>`;
      } else {
        content += `<td class="result-number">${a.result ?? '—'}</td>`;
        if (state.dc > 0) {
          let cls = 'failure';
          let label = a.outcomeLabel || $l10n('SDM.SavingThrowDoom');
          if (a.outcome === 'success') {
            cls = 'success';
            label = $l10n('SDM.SavingThrowSave');
          } else if (a.outcome === 'sacrifice') {
            cls = 'sacrifice';
            label = $l10n('SDM.SavingThrowSacrifice');
          }
          content += `<td class="outcome-cell ${cls}">${label}</td>`;
        }
      }
      content += `</tr>`;
    }
    content += `</table>`;

    const rollMode = game.settings.get('core', 'rollMode');
    let chatData = {
      content: `<div class="group-check-chat-results">${content}</div>`,
      speaker: ChatMessage.getSpeaker({ user: game.user }),
      flavor: `[${$l10n('SDM.GroupCheck')}]`
    };
    chatData = ChatMessage.applyRollMode(chatData, rollMode);
    await ChatMessage.create(chatData);
    this.socket.sendClose();
    this.close();
  }
}

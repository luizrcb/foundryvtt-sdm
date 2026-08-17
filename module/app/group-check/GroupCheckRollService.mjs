import { GroupCheckState } from './GroupCheckState.mjs';
import { GroupCheckSocket } from './GroupCheckSocket.mjs';
import SDMRoll from '../../rolls/sdmRoll.mjs';
import { getOutcome, enrichTableResult } from './GroupCheckHelpers.mjs';
import { HeroDiceUI } from '../../rolls/hero_dice/ui/HeroDiceUi.mjs';
import { $fmt, $l10n } from '../../helpers/globalUtils.mjs';
import { ActorType } from '../../helpers/constants.mjs';

export class GroupCheckRollService {
  static #instance = null;

  static getInstance() {
    if (!this.#instance) this.#instance = new GroupCheckRollService();
    return this.#instance;
  }

  constructor() {
    this.groupState = GroupCheckState.getInstance();
    this.socket = GroupCheckSocket.getInstance();
    this._pendingRolls = new Map();
    this._dsnHookRegistered = false;
    this._registerDSNHook();
  }

  _registerDSNHook() {
    if (this._dsnHookRegistered) return;
    Hooks.on('diceSoNiceRollComplete', messageId => {
      const message = game.messages.get(messageId);
      if (!message) return;
      const rollId = message.flags?.sdm?.groupCheckRollId;
      if (!rollId) return;
      const pending = this._pendingRolls.get(rollId);
      if (pending) {
        clearTimeout(pending.timeout);
        this._pendingRolls.delete(rollId);
        pending.resolve();
      }
    });
    this._dsnHookRegistered = true;
  }

  _waitForDSN(rollId, timeoutMs = 10000) {
    return new Promise(resolve => {
      if (!game.dice3d) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        this._pendingRolls.delete(rollId);
        resolve();
      }, timeoutMs);
      this._pendingRolls.set(rollId, { resolve, timeout });
    });
  }

  async _doTableRoll(actor, actorData) {
    const state = this.groupState.data;
    const table = await fromUuid(state.tableUuid);
    if (!table) {
      ui.notifications.error('Table not found.');
      return;
    }
    const roll = await table.roll();
    const enriched = await enrichTableResult(roll, game.user.isGM);
    const updates = {
      status: 'rolled',
      result: roll.total || 0,
      success: null,
      outcome: null,
      outcomeLabel: null,
      tableResult: enriched,
      lastRoll: roll
    };
    this.groupState.updateActor(actorData.id, updates);
    if (!game.user.isGM) {
      this.socket.sendRollResult(actorData.id, {
        total: updates.result,
        success: null,
        outcome: null,
        outcomeLabel: null,
        tableResult: enriched,
        lastRoll: roll
      });
    }
  }

  async rollForActor(actorId, isReRoll = false) {
    const actorData = this.groupState.actors.find(a => a.id === actorId);
    if (!actorData) {
      ui.notifications.error('Actor not found in group check.');
      return;
    }
    const actor = await fromUuid(actorId);
    if (!actor) {
      ui.notifications.error('Actor not found.');
      return;
    }
    const state = this.groupState.data;

    if (state.rollType === 'table') {
      await this._doTableRoll(actor, actorData);
      return;
    }

    const rollId = foundry.utils.randomID();
    const waitPromise = this._waitForDSN(rollId);

    let rollType =
      state.rollType === 'ability' ? 'ability' : state.rollType === 'saving' ? 'save' : 'custom';
    let from = '';
    const abilityKey = state.abilityKey || 'str';

    switch (state.rollType) {
      case 'ability':
        from = $l10n(CONFIG.SDM.abilities?.[abilityKey]) || abilityKey;
        break;
      case 'saving':
        from = $fmt('SDM.SavingThrowRoll', {
          ability: $l10n(CONFIG.SDM.abilities?.[abilityKey]) || abilityKey
        });
        break;
      case 'custom':
        from = `(${state.customFormula})`;
        break;
    }

    const rollData = {
      type: rollType,
      actor,
      from,
      ability: abilityKey,
      mode: state.rollMode,
      modifier: state.modifier || 0,
      formula: state.rollType === 'custom' ? state.customFormula : undefined,
      targetActor: null,
      attackTarget: 'physical',
      isCtrl: false,
      skipModal: true,
      extraFlags: {
        sdm: {
          groupCheckRollId: rollId,
          noHeroDice: true
        }
      },
      explodingDice: state.rollType !== 'custom'
    };

    const sdmRoll = new SDMRoll(rollData);
    await sdmRoll.evaluate();

    const total = sdmRoll.roll.total;
    const outcomeData = getOutcome(total, state.dc);

    await waitPromise;

    const updates = {
      status: 'rolled',
      result: total,
      success:
        outcomeData.outcome === 'success' ? true : outcomeData.outcome === 'failure' ? false : null,
      outcome: outcomeData.outcome,
      outcomeLabel: outcomeData.label,
      tableResult: null,
      lastRoll: sdmRoll.roll
    };

    this.groupState.updateActor(actorData.id, updates);

    if (!game.user.isGM) {
      this.socket.sendRollResult(actorId, {
        total,
        success: updates.success,
        outcome: updates.outcome,
        outcomeLabel: updates.outcomeLabel,
        tableResult: null,
        lastRoll: sdmRoll.roll
      });
    }
  }

  async applyHeroDice(actorId) {
    const actorData = this.groupState.actors.find(a => a.id === actorId);
    if (!actorData) return;
    const actor = await fromUuid(actorId);
    if (!actor) {
      ui.notifications.error('Actor not found.');
      return;
    }
    const roll = actorData.lastRoll;
    if (!roll) {
      ui.notifications.warn('No roll to apply hero dice to.');
      return;
    }
    let HeroDiceEngine, _promptHeroOptions;
    try {
      const heroCore = await import('../../rolls/hero_dice/core/HeroDiceEngine.mjs');
      HeroDiceEngine = heroCore.HeroDiceEngine;
      const heroIndex = await import('../../rolls/hero_dice/index.mjs');
      _promptHeroOptions = heroIndex._promptHeroOptions;
    } catch (e) {
      console.error('Failed to import hero dice modules:', e);
      ui.notifications.error('Hero dice module not found.');
      return;
    }
    const touristDice = actor.system.tourist_dice?.enabled ? actor.system.tourist_dice.value : 0;
    const maxDice = actor.system.hero_dice.value + touristDice;
    const bonusHDPool = game.settings.get('sdm', 'bonusHeroDicePool');
    if (maxDice < 1 && bonusHDPool < 1) {
      ui.notifications.error($fmt('SDM.ErrorActorNoHeroDice', { actor: actor.name }));
      return;
    }
    const options = await _promptHeroOptions(actor, bonusHDPool);
    if (!options) return;
    const { heroicQty = 0, heroMode = 'increase' } = options;
    const heroicDiceQty = parseInt(heroicQty || 0, 10);
    if (heroicDiceQty > maxDice) return;
    const result = await HeroDiceEngine.process(roll, heroicDiceQty, bonusHDPool, actor, {
      mode: heroMode
    });
    if (bonusHDPool > 0) {
      const { requestSettingUpdate } = await import('../../settingsSocket.mjs');
      await requestSettingUpdate('bonusHeroDicePool', 0);
    }

    await HeroDiceUI.renderResultToChat(result, actor, {}, bonusHDPool, heroMode);

    const newTotal = result.total;
    const outcomeData = getOutcome(newTotal, this.groupState.dc);
    const updates = {
      status: 'rolled',
      result: newTotal,
      success:
        outcomeData.outcome === 'success' ? true : outcomeData.outcome === 'failure' ? false : null,
      outcome: outcomeData.outcome,
      outcomeLabel: outcomeData.label,
      tableResult: null,
      lastRoll: result.roll,
      hasUsedHeroDice: true
    };
    this.groupState.updateActor(actorId, updates);
    if (!game.user.isGM) {
      this.socket.sendHeroDiceResult(actorId, {
        total: newTotal,
        success: updates.success,
        outcome: updates.outcome,
        outcomeLabel: updates.outcomeLabel,
        tableResult: null,
        lastRoll: result.roll,
        hasUsedHeroDice: true
      });
    }
  }

  processPlayerRoll(actorId, rollData) {
    const actorData = this.groupState.actors.find(a => a.id === actorId);
    if (actorData) {
      const updates = {
        status: 'rolled',
        result: rollData.total,
        success: rollData.success,
        outcome: rollData.outcome,
        outcomeLabel: rollData.outcomeLabel,
        tableResult: rollData.tableResult || null,
        lastRoll: rollData.lastRoll
      };
      this.groupState.updateActor(actorId, updates);
    }
  }

  processHeroDiceResult(actorId, rollData) {
    const actorData = this.groupState.actors.find(a => a.id === actorId);
    if (actorData) {
      const updates = {
        status: 'rolled',
        result: rollData.total,
        success: rollData.success,
        outcome: rollData.outcome,
        outcomeLabel: rollData.outcomeLabel,
        tableResult: rollData.tableResult || null,
        lastRoll: rollData.lastRoll
      };
      this.groupState.updateActor(actorId, updates);
    }
  }

  _calculateSaveBonus(actor, abilityKey) {
    if (!actor) return 0;

    const abilityData =
      actor.type === ActorType.NPC
        ? { current: actor.system.bonus || 0 }
        : actor.system.abilities?.[abilityKey] || { current: 0 };

    const finalAbility = abilityData.current || 0;

    const ward = actor.system?.ward || 0;
    const burdenPenalty = actor.system?.burden_penalty || 0;
    const saveBonus = abilityData?.save_bonus || 0;
    const allSaveBonus = actor.system?.all_save_bonus || 0;

    let total = finalAbility + ward + saveBonus + allSaveBonus - burdenPenalty;

    const useHardLimitRule = game.settings.get('sdm', 'useHardLimitRule');
    if (useHardLimitRule) {
      const defaultHardLimitValue = game.settings.get('sdm', 'defaultHardLimitValue') || 13;
      total = Math.min(total, defaultHardLimitValue);
    }

    return total;
  }
}

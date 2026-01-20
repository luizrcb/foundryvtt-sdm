// Each class defines a single-section AppV2 using your BaseSettingsConfig.
import BaseSettingsConfig from './base-settings.mjs';

class GroupBase extends BaseSettingsConfig {
  static PARTS = {
    config: { template: 'systems/sdm/templates/settings/base-config.hbs' },
    footer: { template: 'templates/generic/form-footer.hbs' }
  };

  static get ALL_KEYS() {
    return this.KEYS;
  }

  async _preparePartContext(partId, context, options) {
    context = (await super._preparePartContext?.(partId, context, options)) ?? {};
    if (partId !== 'config') return context;

    context.fields = this.constructor.KEYS.map(k => this.createSettingField(k));
    // Legend defaults to title; override per class if you want a different legend
    const legendKey = this.constructor.LEGEND ?? this.constructor.DEFAULT_OPTIONS?.window?.title;
    context.legend = game.i18n.has(legendKey) ? game.i18n.localize(legendKey) : legendKey;
    return context;
  }
}

export class SDMClientSettingsConfig extends GroupBase {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    window: {
      ...super.DEFAULT_OPTIONS.window,
      title: 'SDM.Menu.Client.Label',
      icon: 'fa-solid fa-user'
    }
  };
  static LEGEND = 'SDM.Menu.Client.Name';
  static KEYS = [
    'chromatype',
    'diceSoNiceChromatype',
    'reverseShiftKey',
    'shouldPlayLevelUpSoundFx'
  ];
}

export class SDMCalendarSettingsConfig extends GroupBase {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    window: {
      ...super.DEFAULT_OPTIONS.window,
      title: 'SDM.Menu.Calendar.Label',
      icon: 'fa-solid fa-calendar'
    }
  };
  static LEGEND = 'SDM.Menu.Calendar.Name';
  static KEYS = [
    'seasonsStarsIntegration',
  ];
}

/* 1) Combat & Initiative */
export class SDMCombatSettingsConfig extends GroupBase {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    window: {
      ...super.DEFAULT_OPTIONS.window,
      title: 'SDM.Menu.Combat.Label',
      icon: 'fa-solid fa-hand-fist'
    }
  };
  static LEGEND = 'SDM.Menu.Combat.Name';
  static KEYS = [
    'groupPlayersToFriendlyTokens',
    'rerollInitiativeEveryRound',
    'initiativeFormula',
    'npcInitiativeFormula'
  ];
}

/* 2) Core Rules (Limits & Hero Dice) */
export class SDMCoreRulesSettingsConfig extends GroupBase {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    window: {
      ...super.DEFAULT_OPTIONS.window,
      title: 'SDM.Menu.CoreRules.Label',
      icon: 'fa-solid fa-book'
    }
  };
  static LEGEND = 'SDM.Menu.CoreRules.Name';
  static KEYS = [
    'luckySevenRule',
    'defaultMaxPowers',
    'useHardLimitRule',
    'defaultHardLimitValue',
    'defaultHeroDiceType',
    'healingHouseRule',
  ];
}

/* 3) Skills & Advancement */
export class SDMSkillsSettingsConfig extends GroupBase {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    window: {
      ...super.DEFAULT_OPTIONS.window,
      title: 'SDM.Menu.Skills.Label',
      icon: 'fa-solid fa-layer-group'
    }
  };
  static LEGEND = 'SDM.Menu.Skills.Name';
  static KEYS = ['skillModifierStep', 'extendedSkillRanks'];
}

/* 4) System Baselines (Defs, Saves, Slots) */
export class SDMBaselinesSettingsConfig extends GroupBase {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    window: {
      ...super.DEFAULT_OPTIONS.window,
      title: 'SDM.Menu.Baselines.Label',
      icon: 'fa-solid fa-sliders'
    }
  };
  static LEGEND = 'SDM.Menu.Baselines.Name';
  static KEYS = [
    'defaultSaveValue',
    'baseDefense',
    'baseMentalDefense',
    'baseSocialDefense',
    'baseItemSlots',
    'baseTraitSlots',
    'baseBurdenSlots'
  ];
}

/* 5) NPC Behavior (Morale & Reaction) */
export class SDMNPCBehaviorSettingsConfig extends GroupBase {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    window: {
      ...super.DEFAULT_OPTIONS.window,
      title: 'SDM.Menu.NPC.Label',
      icon: 'fa-solid fa-masks-theater'
    }
  };
  static LEGEND = 'SDM.Menu.NPC.Name';
  static KEYS = ['baseMoraleFormula', 'baseReactionFormula', 'npcInitiativeFormula'];
}

/* 6) Economy & Currency */
export class SDMEconomySettingsConfig extends GroupBase {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    window: {
      ...super.DEFAULT_OPTIONS.window,
      title: 'SDM.Menu.Economy.Label',
      icon: 'fa-solid fa-coins'
    }
  };
  static LEGEND = 'SDM.Menu.Economy.Name';
  static KEYS = ['currencyName', 'currencyImage'];
}

/* 7) Audio (GM Assets) */
export class SDMAudioGMSettingsConfig extends GroupBase {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    window: {
      ...super.DEFAULT_OPTIONS.window,
      title: 'SDM.Menu.AudioGM.Label',
      icon: 'fa-solid fa-music'
    }
  };
  static LEGEND = 'SDM.Menu.AudioGM.Name';
  static KEYS = ['levelUpSoundFx'];
}

// Each class defines a single-section AppV2 using your BaseSettingsConfig.
import BaseSettingsConfig from './base-settings.mjs';
import { getLightPreset, LIGHT_PRESET_KEYS } from '../helpers/lights.mjs';

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
    'reverseShiftKey',
    'showEffectsPanel',
    'chromatype',
    'diceSoNiceChromatype',
    'hero_dice_style',
    'blood_dice_style',
    'tourist_dice_style',
    'oracle_dice_style',
    'shouldPlayLevelUpSoundFx'
  ];
}

export class SDMCaravanSettingsConfig extends GroupBase {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    window: {
      ...super.DEFAULT_OPTIONS.window,
      title: 'SDM.Menu.Caravan.Label',
      icon: 'fa-solid fa-truck-monster'
    }
  };
  static LEGEND = 'SDM.Menu.Caravan.Name';
  static KEYS = ['countCrewWeight', 'seasonsStarsIntegration', 'automateCaravanTransport'];
}

export class SDMPlayerPermissionsSettingsConfig extends GroupBase {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    window: {
      ...super.DEFAULT_OPTIONS.window,
      title: 'SDM.Menu.PlayerPermissions.Label',
      icon: 'fa-solid fa-user-lock'
    }
  };
  static LEGEND = 'SDM.Menu.PlayerPermissions.Name';
  static KEYS = ['canPlayerRerollCharacter', 'canPlayerDropPetOnCanvas'];
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
    'initiativeTieBreak',
    'groupPlayersToFriendlyTokens',
    'rerollInitiativeEveryRound',
    'effectExpiryAction',
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
    'healingHouseRule'
  ];
  // Second section: automations the GM can turn off
  static OPTIONAL_KEYS = ['automatePowerCost', 'enableTriggers', 'enableCounters', 'enableDamageBoost', 'enableItemLights'];
  static PARTS = {
    config: { template: 'systems/sdm/templates/settings/base-config.hbs' },
    optional: { template: 'systems/sdm/templates/settings/optional-config.hbs' },
    footer: { template: 'templates/generic/form-footer.hbs' }
  };
  static get ALL_KEYS() {
    return [...this.KEYS, ...this.OPTIONAL_KEYS];
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId !== 'optional') return context;
    context.optionalFields = this.constructor.OPTIONAL_KEYS.map(k => this.createSettingField(k));
    context.optionalLegend = game.i18n.localize('SDM.Menu.CoreRules.Optional');
    return context;
  }
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
  static PARTS = {
    config: { template: 'systems/sdm/templates/settings/base-config.hbs' },
    lights: { template: 'systems/sdm/templates/settings/light-presets.hbs' },
    footer: { template: 'templates/generic/form-footer.hbs' }
  };
  // Saved with the rest of the form (as an object); reset with "Reset" too
  static get ALL_KEYS() {
    return [...this.KEYS, 'lightPresets'];
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId !== 'lights') return context;
    context.presets = LIGHT_PRESET_KEYS.map(key => ({
      key,
      label: game.i18n.localize(`SDM.Light.Preset.${key}`),
      ...getLightPreset(key)
    }));
    context.animations = {
      '': 'SDM.Light.NoAnimation',
      ...Object.fromEntries(Object.entries(CONFIG.Canvas.lightAnimations ?? {}).map(([key, cfg]) => [key, cfg.label]))
    };
    return context;
  }

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
  static KEYS = ['currencyName', 'currencyImage', 'currencyWeight'];
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

/* 8) System DEV Setting */
export class SDMSystemDevSettingsConfig extends GroupBase {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    window: {
      ...super.DEFAULT_OPTIONS.window,
      title: 'SDM.Menu.SystemDev.Label',
      icon: 'fa-solid fa-lock'
    }
  };
  static LEGEND = 'SDM.Menu.SystemDev.Name';
  static KEYS = ['displayItemCategoriesTab'];
}

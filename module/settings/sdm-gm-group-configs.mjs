// Each class defines a single-section AppV2 using your BaseSettingsConfig.
import BaseSettingsConfig from './base-settings.mjs';
import { getLightPreset, LIGHT_PRESET_KEYS } from '../helpers/lights.mjs';
import { getZoneScale, worldUnit, ZONE_SCALE_KEYS } from '../helpers/zones.mjs';
import { bindingLabel, currentBinding, KEYBINDING_SETTINGS, setBinding } from '../helpers/keybindingSettings.mjs';

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
    'shouldPlayLevelUpSoundFx',
    'zoneHoldKeyBinding',
    'compendiumBrowserKeyBinding'
  ];

  /** Key fields (Show zones, Compendium Browser): press the key combination in the box (Backspace: no key). */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    const esc = foundry.utils.escapeHTML;
    for (const field of context.fields ?? []) {
      const action = KEYBINDING_SETTINGS[field.key];
      if (!action) continue;
      const value = currentBinding(action);
      field.inputHTML =
        `<input type="hidden" name="${field.key}" value="${esc(value)}">` +
        `<input type="text" class="sdm-key-capture" data-for="${field.key}" readonly value="${esc(bindingLabel(value))}" placeholder="${esc(game.i18n.localize('SDM.Zones.HoldKeyPress'))}">`;
    }
    return context;
  }

  /** Saved: each key goes to Configure Controls even if its setting itself didn't change. */
  async _onCommitChanges(event, form, formData) {
    await super._onCommitChanges(event, form, formData);
    if (event?.submitter?.dataset?.action === 'cancel') return;
    for (const [setting, action] of Object.entries(KEYBINDING_SETTINGS)) {
      const value = form?.querySelector?.(`input[name="${setting}"]`)?.value;
      if (value !== undefined && value !== currentBinding(action)) await setBinding(action, value);
    }
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const modifierKeys = ['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'];
    this.element.querySelectorAll('.sdm-key-capture').forEach(box => {
      const hidden = this.element.querySelector(`input[name="${box.dataset.for}"]`);
      if (!hidden) return;
      box.addEventListener('keydown', event => {
        if (event.key === 'Tab') return;
        event.preventDefault();
        event.stopPropagation();
        if (event.code === 'Backspace' || event.code === 'Delete') {
          hidden.value = '';
          box.value = '';
          return;
        }
        // A modifier alone is not a key yet; Cmd on a Mac counts as Control (as Foundry reads it)
        if (modifierKeys.includes(event.code)) return;
        const modifiers = [(event.ctrlKey || event.metaKey) && 'Control', event.shiftKey && 'Shift', event.altKey && 'Alt'].filter(Boolean);
        hidden.value = [...modifiers, event.code].join('+');
        box.value = bindingLabel(hidden.value);
      });
    });
  }
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

/* Movement & range zones: the scales (table), the world default and the optional helpers */
export class SDMZonesSettingsConfig extends GroupBase {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    window: {
      ...super.DEFAULT_OPTIONS.window,
      title: 'SDM.Menu.Zones.Label',
      icon: 'fa-solid fa-ruler-combined'
    }
  };
  static LEGEND = 'SDM.Menu.Zones.Name';
  static KEYS = ['distanceUnit', 'defaultZoneScale', 'zoneRangeCheck', 'freeAttackRulerWarning', 'freeAttackReminder', 'zoneRuler', 'zoneHighlight'];
  static PARTS = {
    config: { template: 'systems/sdm/templates/settings/base-config.hbs' },
    scales: { template: 'systems/sdm/templates/settings/zone-scales.hbs' },
    footer: { template: 'templates/generic/form-footer.hbs' }
  };
  // Saved with the rest of the form (as an object); reset with "Reset" too
  static get ALL_KEYS() {
    return [...this.KEYS, 'zoneScales'];
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId !== 'scales') return context;
    context.unit = worldUnit();
    context.scales = ZONE_SCALE_KEYS.map(key => ({
      key,
      label: game.i18n.localize(`SDM.Zones.Scale.${key}`),
      ...getZoneScale(key)
    }));
    return context;
  }

  // Changing the unit converts the scales table itself: don't save the numbers typed in the old unit
  async _onCommitChanges(event, form, formData) {
    const unit = formData?.object?.distanceUnit;
    if (unit && unit !== worldUnit()) {
      for (const key of Object.keys(formData.object)) if (key.startsWith('zoneScales')) delete formData.object[key];
    }
    return super._onCommitChanges(event, form, formData);
  }
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
  static OPTIONAL_KEYS = [
    'automatePowerCost',
    'enableTriggers',
    'enableCounters',
    'enableDamageBoost',
    'enableItemLights',
    'enableAuras',
    'npcVariability',
    'npcTokenVariability',
    'npcTokenArchetype',
    'enableNpcExtras',
    'automateConditions',
    'autoApplyDamage',
    'npcNaturalLight'
  ];
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
  static KEYS = [
    'baseMoraleFormula',
    'baseReactionFormula',
    'npcInitiativeFormula',
    'npcExtraAttacksTable',
    'npcExtraOdditiesTable',
    'npcExtraPowersTable',
    'npcExtraPossessionsTable'
  ];
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

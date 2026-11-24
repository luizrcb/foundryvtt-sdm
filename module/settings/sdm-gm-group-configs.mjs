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

/**
 * Referee: every world setting in one window, by tab. Each tab lists its sections (a legend and the
 * setting keys); Combat ends with the zone scales table and Systems with the light presets table.
 * Setting keys are the same as before, so worlds keep their values.
 */
const WORLD_TABS = [
  {
    id: 'rules',
    icon: 'fa-solid fa-book',
    sections: [
      { legend: 'SDM.Menu.CoreRules.Name', keys: ['luckySevenRule', 'heroDieOnNat20', 'defaultHeroDiceType', 'useHardLimitRule', 'defaultHardLimitValue', 'healingHouseRule', 'defaultMaxPowers'] },
      { legend: 'SDM.Menu.Skills.Name', keys: ['skillModifierStep', 'extendedSkillRanks'] }
    ]
  },
  {
    id: 'characters',
    icon: 'fa-solid fa-user',
    sections: [
      { legend: 'SDM.Menu.Baselines.Name', keys: ['defaultSaveValue', 'baseDefense', 'baseMentalDefense', 'baseSocialDefense', 'baseItemSlots', 'baseTraitSlots', 'baseBurdenSlots'] },
      { legend: 'SDM.Menu.PlayerPermissions.Name', keys: ['canPlayerRerollCharacter', 'canPlayerDropPetOnCanvas'] },
      { legend: 'SDM.Menu.AudioGM.Name', keys: ['levelUpSoundFx'] }
    ]
  },
  {
    id: 'combat',
    icon: 'fa-solid fa-crosshairs',
    sections: [
      { legend: 'SDM.Menu.Combat.Name', keys: ['initiativeTieBreak', 'groupPlayersToFriendlyTokens', 'rerollInitiativeEveryRound', 'initiativeFormula', 'effectExpiryAction', 'automateConditions', 'autoApplyDamage'] },
      { legend: 'SDM.Menu.Zones.Name', keys: ['distanceUnit', 'defaultZoneScale', 'zoneRangeCheck', 'freeAttackRulerWarning', 'freeAttackReminder', 'zoneRuler', 'zoneHighlight'] }
    ]
  },
  {
    id: 'npcs',
    icon: 'fa-solid fa-masks-theater',
    sections: [
      { legend: 'SDM.Menu.NPC.Name', keys: ['baseMoraleFormula', 'baseReactionFormula', 'npcInitiativeFormula', 'npcExtraAttacksTable', 'npcExtraOdditiesTable', 'npcExtraPowersTable', 'npcExtraPossessionsTable'] },
      { legend: 'SDM.Menu.World.NpcGenerator', keys: ['npcVariability', 'npcTokenVariability', 'npcTokenArchetype', 'enableNpcExtras', 'npcNaturalLight'] }
    ]
  },
  {
    id: 'systems',
    icon: 'fa-solid fa-toggle-on',
    sections: [
      { legend: 'SDM.Menu.CoreRules.Optional', keys: ['automatePowerCost', 'enableTriggers', 'enableCounters', 'enableDamageBoost', 'enableItemLights', 'enableAuras'] }
    ]
  },
  {
    id: 'caravan',
    icon: 'fa-solid fa-caravan',
    sections: [
      { legend: 'SDM.Menu.Caravan.Name', keys: ['countCrewWeight', 'seasonsStarsIntegration', 'automateCaravanTransport'] },
      { legend: 'SDM.Menu.Economy.Name', keys: ['currencyName', 'currencyImage', 'currencyWeight'] }
    ]
  },
  {
    id: 'advanced',
    icon: 'fa-solid fa-lock',
    sections: [{ legend: 'SDM.Menu.SystemDev.Name', keys: ['displayItemCategoriesTab'] }]
  }
];

/** Settings shown in a tab as tables (saved and reset with that tab). */
const TAB_TABLE_KEYS = { combat: ['zoneScales'], systems: ['lightPresets'] };

const registered = key => game.settings.settings.has(`sdm.${key}`);
const tabKeys = tab => [...tab.sections.flatMap(section => section.keys), ...(TAB_TABLE_KEYS[tab.id] ?? [])].filter(registered);

export class SDMWorldSettingsConfig extends BaseSettingsConfig {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: [...super.DEFAULT_OPTIONS.classes, 'sdm-world-settings'],
    window: {
      ...super.DEFAULT_OPTIONS.window,
      title: 'SDM.Menu.World.Name',
      icon: 'fa-solid fa-gears'
    },
    position: { width: 960, height: 760 }
  };

  static TABS = {
    primary: {
      tabs: WORLD_TABS.map(tab => ({ id: tab.id, icon: tab.icon, label: `SDM.Menu.World.Tab.${tab.id}` })),
      initial: 'rules'
    }
  };

  static PARTS = {
    tabs: { template: 'templates/generic/tab-navigation.hbs' },
    ...Object.fromEntries(
      WORLD_TABS.map(tab => [tab.id, { template: 'systems/sdm/templates/settings/world-tab.hbs', scrollable: [''] }])
    ),
    zoneScales: { template: 'systems/sdm/templates/settings/zone-scales.hbs' },
    lightPresets: { template: 'systems/sdm/templates/settings/light-presets.hbs' },
    footer: { template: 'templates/generic/form-footer.hbs' }
  };

  static get ALL_KEYS() {
    return WORLD_TABS.flatMap(tabKeys);
  }

  /** Reset: only the tab in view. */
  get resetKeys() {
    const tab = WORLD_TABS.find(t => t.id === this.tabGroups.primary) ?? WORLD_TABS[0];
    return tabKeys(tab);
  }

  async _preparePartContext(partId, context, options) {
    context = (await super._preparePartContext(partId, context, options)) ?? {};
    const tab = WORLD_TABS.find(t => t.id === partId);
    if (tab) {
      context.tab = context.tabs?.[partId];
      context.sections = tab.sections
        .map(section => ({
          legend: game.i18n.localize(section.legend),
          fields: section.keys.filter(registered).map(key => this.createSettingField(key))
        }))
        .filter(section => section.fields.length);
    } else if (partId === 'zoneScales') {
      context.tab = context.tabs?.combat;
      context.unit = worldUnit();
      context.scales = ZONE_SCALE_KEYS.map(key => ({
        key,
        label: game.i18n.localize(`SDM.Zones.Scale.${key}`),
        ...getZoneScale(key)
      }));
    } else if (partId === 'lightPresets') {
      context.tab = context.tabs?.systems;
      context.presets = LIGHT_PRESET_KEYS.map(key => ({
        key,
        label: game.i18n.localize(`SDM.Light.Preset.${key}`),
        ...getLightPreset(key)
      }));
      context.animations = {
        '': 'SDM.Light.NoAnimation',
        ...Object.fromEntries(Object.entries(CONFIG.Canvas.lightAnimations ?? {}).map(([key, cfg]) => [key, cfg.label]))
      };
    }
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

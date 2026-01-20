import { $fmt, $l10n } from '../helpers/globalUtils.mjs';
import {
  SDMClientSettingsConfig,
  SDMCalendarSettingsConfig,
  SDMCombatSettingsConfig,
  SDMCoreRulesSettingsConfig,
  SDMSkillsSettingsConfig,
  SDMBaselinesSettingsConfig,
  SDMNPCBehaviorSettingsConfig,
  SDMEconomySettingsConfig,
  SDMAudioGMSettingsConfig
} from './sdm-gm-group-configs.mjs';

export function registerSDMGMSettingMenus() {
  game.settings.registerMenu('sdm', '00-client', {
    name: 'SDM.Menu.Client.Name',
    hint: 'SDM.Menu.Client.Hint',
    label: 'SDM.Menu.Client.Label',
    icon: 'fa-solid fa-user',
    type: SDMClientSettingsConfig,
    restricted: false
  });

  game.settings.registerMenu('sdm', '01-calendar', {
    name: 'SDM.Menu.Calendar.Name',
    hint: 'SDM.Menu.Calendar.Hint',
    label: 'SDM.Menu.Calendar.Label',
    icon: 'fa-solid fa-calendar',
    type: SDMCalendarSettingsConfig,
    restricted: true
  });

  game.settings.registerMenu('sdm', '02-combat', {
    name: 'SDM.Menu.Combat.Name',
    hint: 'SDM.Menu.Combat.Hint',
    label: 'SDM.Menu.Combat.Label',
    icon: 'fa-solid fa-hand-fist',
    type: SDMCombatSettingsConfig,
    restricted: true
  });

  game.settings.registerMenu('sdm', '03-coreRules', {
    name: 'SDM.Menu.CoreRules.Name',
    hint: 'SDM.Menu.CoreRules.Hint',
    label: 'SDM.Menu.CoreRules.Label',
    icon: 'fa-solid fa-book',
    type: SDMCoreRulesSettingsConfig,
    restricted: true
  });

  game.settings.registerMenu('sdm', '04-skills', {
    name: 'SDM.Menu.Skills.Name',
    hint: 'SDM.Menu.Skills.Hint',
    label: 'SDM.Menu.Skills.Label',
    icon: 'fa-solid fa-layer-group',
    type: SDMSkillsSettingsConfig,
    restricted: true
  });

  game.settings.registerMenu('sdm', '05-baselines', {
    name: 'SDM.Menu.Baselines.Name',
    hint: 'SDM.Menu.Baselines.Hint',
    label: 'SDM.Menu.Baselines.Label',
    icon: 'fa-solid fa-sliders',
    type: SDMBaselinesSettingsConfig,
    restricted: true
  });

  game.settings.registerMenu('sdm', '06-npc', {
    name: 'SDM.Menu.NPC.Name',
    hint: 'SDM.Menu.NPC.Hint',
    label: 'SDM.Menu.NPC.Label',
    icon: 'fa-solid fa-masks-theater',
    type: SDMNPCBehaviorSettingsConfig,
    restricted: true
  });

  game.settings.registerMenu('sdm', '07-economy', {
    name: 'SDM.Menu.Economy.Name',
    hint: 'SDM.Menu.Economy.Hint',
    label: 'SDM.Menu.Economy.Label',
    icon: 'fa-solid fa-coins',
    type: SDMEconomySettingsConfig,
    restricted: true
  });

  game.settings.registerMenu('sdm', '08-audioGM', {
    name: 'SDM.Menu.AudioGM.Name',
    hint: 'SDM.Menu.AudioGM.Hint',
    label: 'SDM.Menu.AudioGM.Label',
    icon: 'fa-solid fa-music',
    type: SDMAudioGMSettingsConfig,
    restricted: true
  });
}

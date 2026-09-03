import {
  SDMClientSettingsConfig,
  SDMCaravanSettingsConfig,
  SDMCombatSettingsConfig,
  SDMCoreRulesSettingsConfig,
  SDMSkillsSettingsConfig,
  SDMBaselinesSettingsConfig,
  SDMNPCBehaviorSettingsConfig,
  SDMEconomySettingsConfig,
  SDMAudioGMSettingsConfig,
  SDMPlayerPermissionsSettingsConfig,
  SDMSystemDevSettingsConfig
} from './sdm-gm-group-configs.mjs';

export function registerSDMGMSettingMenus() {
  game.settings.registerMenu('sdm', '00-client', {
    name: 'SDM.Menu.Client.Name',
    hint: 'SDM.Menu.Client.Hint',
    label: 'SDM.Menu.Client.Label',
    icon: 'fa-solid fa-user rust',
    type: SDMClientSettingsConfig,
    restricted: false
  });

  game.settings.registerMenu('sdm', '01-playerPermissions', {
    name: 'SDM.Menu.PlayerPermissions.Name',
    hint: 'SDM.Menu.PlayerPermissions.Hint',
    label: 'SDM.Menu.PlayerPermissions.Label',
    icon: 'fa-solid fa-user-lock pumpkin',
    type: SDMPlayerPermissionsSettingsConfig,
    restricted: true
  });

  game.settings.registerMenu('sdm', '02-caravan', {
    name: 'SDM.Menu.Caravan.Name',
    hint: 'SDM.Menu.Caravan.Hint',
    label: 'SDM.Menu.Caravan.Label',
    icon: 'fa-solid fa-truck-monster amber',
    type: SDMCaravanSettingsConfig,
    restricted: true
  });

  game.settings.registerMenu('sdm', '03-combat', {
    name: 'SDM.Menu.Combat.Name',
    hint: 'SDM.Menu.Combat.Hint',
    label: 'SDM.Menu.Combat.Label',
    icon: 'fa-solid fa-hand-fist lime',
    type: SDMCombatSettingsConfig,
    restricted: true
  });

  game.settings.registerMenu('sdm', '04-coreRules', {
    name: 'SDM.Menu.CoreRules.Name',
    hint: 'SDM.Menu.CoreRules.Hint',
    label: 'SDM.Menu.CoreRules.Label',
    icon: 'fa-solid fa-book pine',
    type: SDMCoreRulesSettingsConfig,
    restricted: true
  });

  game.settings.registerMenu('sdm', '05-skills', {
    name: 'SDM.Menu.Skills.Name',
    hint: 'SDM.Menu.Skills.Hint',
    label: 'SDM.Menu.Skills.Label',
    icon: 'fa-solid fa-layer-group sky',
    type: SDMSkillsSettingsConfig,
    restricted: true
  });

  game.settings.registerMenu('sdm', '06-baselines', {
    name: 'SDM.Menu.Baselines.Name',
    hint: 'SDM.Menu.Baselines.Hint',
    label: 'SDM.Menu.Baselines.Label',
    icon: 'fa-solid fa-sliders azure',
    type: SDMBaselinesSettingsConfig,
    restricted: true
  });

  game.settings.registerMenu('sdm', '07-npc', {
    name: 'SDM.Menu.NPC.Name',
    hint: 'SDM.Menu.NPC.Hint',
    label: 'SDM.Menu.NPC.Label',
    icon: 'fa-solid fa-masks-theater royal',
    type: SDMNPCBehaviorSettingsConfig,
    restricted: true
  });

  game.settings.registerMenu('sdm', '08-economy', {
    name: 'SDM.Menu.Economy.Name',
    hint: 'SDM.Menu.Economy.Hint',
    label: 'SDM.Menu.Economy.Label',
    icon: 'fa-solid fa-coins heart',
    type: SDMEconomySettingsConfig,
    restricted: true
  });

  game.settings.registerMenu('sdm', '09-audioGM', {
    name: 'SDM.Menu.AudioGM.Name',
    hint: 'SDM.Menu.AudioGM.Hint',
    label: 'SDM.Menu.AudioGM.Label',
    icon: 'fa-solid fa-music plum',
    type: SDMAudioGMSettingsConfig,
    restricted: true
  });

  game.settings.registerMenu('sdm', '10-systemDev', {
    name: 'SDM.Menu.SystemDev.Name',
    hint: 'SDM.Menu.SystemDev.Hint',
    label: 'SDM.Menu.SystemDev.Label',
    icon: 'fa-solid fa-lock violet',
    type: SDMSystemDevSettingsConfig,
    restricted: true
  })
}

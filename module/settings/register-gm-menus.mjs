import {
  SDMClientSettingsConfig,
  SDMWorldSettingsConfig
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

  game.settings.registerMenu('sdm', '01-world', {
    name: 'SDM.Menu.World.Name',
    label: 'SDM.Menu.World.Label',
    icon: 'fa-solid fa-gears',
    type: SDMWorldSettingsConfig,
    restricted: true
  });
}

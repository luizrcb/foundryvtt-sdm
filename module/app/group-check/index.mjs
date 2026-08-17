import { GroupCheckDialog } from './GroupCheckDialog.mjs';
import { GroupCheckSocket } from './GroupCheckSocket.mjs';

export function setupGroupCheckSocket() {
  GroupCheckSocket.getInstance(); // registers listeners
}

export function registerGroupCheckSettings() {
  if (!game.settings.settings.get('sdm.groupCheckShowIndividualRolls')) {
    game.settings.register('sdm', 'groupCheckShowIndividualRolls', {
      name: 'SDM.ShowIndividualRolls',
      hint: 'SDM.ShowIndividualRollsHint',
      scope: 'world',
      type: Boolean,
      default: true
    });
  }
}

export { GroupCheckDialog };

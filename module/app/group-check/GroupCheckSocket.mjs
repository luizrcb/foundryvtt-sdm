import { GroupCheckState } from './GroupCheckState.mjs';

const CHANNEL = 'system.sdm';

export class GroupCheckSocket {
  static #instance = null;

  static getInstance() {
    if (!this.#instance) this.#instance = new GroupCheckSocket();
    return this.#instance;
  }

  constructor() {
    this.groupState = GroupCheckState.getInstance();
    this._boundOnStateChange = this._onStateChange.bind(this);
    this._boundOnSocketMessage = this._onSocketMessage.bind(this);

    this.groupState.onChange(this._boundOnStateChange);
    game.socket.on(CHANNEL, this._boundOnSocketMessage);
  }

  _broadcast(payload) {
    game.socket.emit(CHANNEL, payload);
  }

  _onStateChange() {
    if (game.user.isGM && this.groupState.started) {
      this._broadcast({ action: 'groupCheckSync', state: this.groupState.data });
    }
  }

  _onSocketMessage(msg) {
    const { action, state, actorId, rollData } = msg;
    switch (action) {
      case 'groupCheckSync':
        if (!game.user.isGM) {
          this.groupState.replaceState(state);
        }
        break;
      case 'groupCheckClose':
        import('./GroupCheckDialog.mjs').then(({ GroupCheckDialog }) => {
          if (GroupCheckDialog._instance) {
            GroupCheckDialog._instance.close();
          }
        });
        break;
      case 'groupCheckOpen':
        if (!game.user.isGM) {
          this.groupState.replaceState(state);

          const hasOwnActor = this.groupState.actors.some(a => {
            const actor = fromUuidSync(a.id);
            return actor && actor.isOwner;
          });

          if (hasOwnActor) {
            import('./GroupCheckDialog.mjs').then(({ GroupCheckDialog }) => {
              if (!GroupCheckDialog._instance) {
                new GroupCheckDialog().render(true);
              } else {
                GroupCheckDialog._instance.render(true);
              }
            });
          }
        }
        break;
      case 'groupCheckRoll':
        if (game.user.isGM) {
          import('./GroupCheckRollService.mjs').then(({ GroupCheckRollService }) => {
            const rollService = GroupCheckRollService.getInstance();
            rollService.processPlayerRoll(actorId, rollData);
          });
        }
        break;
      case 'groupCheckHeroDice':
        if (game.user.isGM) {
          import('./GroupCheckRollService.mjs').then(({ GroupCheckRollService }) => {
            const rollService = GroupCheckRollService.getInstance();
            rollService.processHeroDiceResult(actorId, rollData);
          });
        }
        break;
      case 'groupCheckReset':
        this.groupState.reset();
        break;
      default:
        console.warn('Unknown group check socket action:', action);
    }
  }

  sendOpenDialog(state) {
    this._broadcast({ action: 'groupCheckOpen', state });
  }

  sendReset() {
    this._broadcast({ action: 'groupCheckReset' });
  }

  sendClose() {
    this._broadcast({ action: 'groupCheckClose' });
  }

  sendRollResult(actorId, rollData) {
    this._broadcast({ action: 'groupCheckRoll', actorId, rollData });
  }

  sendHeroDiceResult(actorId, rollData) {
    this._broadcast({ action: 'groupCheckHeroDice', actorId, rollData });
  }
}

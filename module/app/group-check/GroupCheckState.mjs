/**
 * Singleton state manager – uses a simple listener array.
 */
export class GroupCheckState {
  static #instance = null;

  static getInstance() {
    if (!this.#instance) this.#instance = new GroupCheckState();
    return this.#instance;
  }

  constructor() {
    this.data = {
      actors: [],
      rollType: 'ability',
      abilityKey: 'str',
      dc: 0,
      modifier: 0,
      customFormula: '2d6',
      tableUuid: '',
      provokeConflict: false,
      description: '',
      started: false,
      gmId: null,
      active: false,
      rollMode: 'normal',
      useHeroDice: false,
      hideDC: false
    };
    this._listeners = [];
  }

  // ---- Listeners ----
  onChange(callback) {
    this._listeners.push(callback);
  }

  offChange(callback) {
    const idx = this._listeners.indexOf(callback);
    if (idx !== -1) this._listeners.splice(idx, 1);
  }

  _emitChange() {
    for (const cb of this._listeners) cb();
  }

  // ---- Getters ----
  get actors() { return this.data.actors; }
  get started() { return this.data.started; }
  get rollType() { return this.data.rollType; }
  get dc() { return this.data.dc; }
  get modifier() { return this.data.modifier; }
  get abilityKey() { return this.data.abilityKey; }
  get customFormula() { return this.data.customFormula; }
  get tableUuid() { return this.data.tableUuid; }
  get provokeConflict() { return this.data.provokeConflict; }
  get description() { return this.data.description; }
  get gmId() { return this.data.gmId; }
  get active() { return this.data.active; }
  get rollMode() { return this.data.rollMode; }
  get useHeroDice() { return this.data.useHeroDice; }
  get hideDC() { return this.data.hideDC; } // NEW

  // ---- Setters ----
  setActors(actors) {
    this.data.actors = actors.map(a => ({ ...a }));
    this._emitChange();
  }

  updateActor(actorId, updates) {

    const actor = this.data.actors.find(a => a.id === actorId);
    if (actor) {
      Object.assign(actor, updates);
      this._emitChange();
    }
  }

  setRollType(val) {
    this.data.rollType = val;
    this._emitChange();
  }

  setAbilityKey(val) {
    this.data.abilityKey = val;
    this._emitChange();
  }

  setDc(val) {
    this.data.dc = Math.max(0, parseInt(val, 10) || 0);
    this._emitChange();
  }

  setModifier(val) {
    this.data.modifier = parseInt(val, 10) || 0;
    this._emitChange();
  }

  setCustomFormula(val) {
    this.data.customFormula = val || '2d6';
    this._emitChange();
  }

  setTableUuid(val) {
    this.data.tableUuid = val || '';
    this._emitChange();
  }

  setProvokeConflict(val) {
    this.data.provokeConflict = !!val;
    this._emitChange();
  }

  setDescription(val) {
    this.data.description = val || '';
    this._emitChange();
  }

  setRollMode(val) {
    this.data.rollMode = val || 'normal';
    this._emitChange();
  }

  setUseHeroDice(val) {
    this.data.useHeroDice = !!val;
    this._emitChange();
  }

  setHideDC(val) { // NEW
    this.data.hideDC = !!val;
    this._emitChange();
  }

  startCheck(gmId) {
    this.data.started = true;
    this.data.gmId = gmId || game.user.id;
    this.data.active = true;
    this._emitChange();
  }

  reset() {
    this.data = {
      actors: [],
      rollType: 'ability',
      abilityKey: 'str',
      dc: 0,
      modifier: 0,
      customFormula: '2d6',
      tableUuid: '',
      provokeConflict: false,
      description: '',
      started: false,
      gmId: null,
      active: false,
      rollMode: 'normal',
      useHeroDice: false,
      hideDC: false
    };
    this._emitChange();
  }

  replaceState(newState) {
    this.data = { ...this.data, ...newState };
    this._emitChange();
  }
}

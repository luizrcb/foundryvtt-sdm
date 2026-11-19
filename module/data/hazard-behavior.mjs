/**
 * Hazard: a region behavior (type "sdm.hazard") that hurts and/or puts a condition on the tokens in a
 * region when they enter it, start their turn in it or are in it when a round starts — traps, poison
 * gas, burning ground. The Referee adds it to any region (Regions layer); lingering areas of items
 * with damage or a condition each round get one too (helpers/areas.mjs). With a save, each one saves
 * first (NPCs at once, characters on their request card): a passed save avoids it, halves the damage
 * or shortens the condition (1 round). A token is hit at most once per round in combat.
 *
 * What isn't edited on the sheet lives in flags.sdm.hazard: the actor and item of an item's area
 * (formula references, its affects), the placer's disposition, an exact save target, and uses spent.
 */
export default class HazardBehaviorData extends foundry.data.regionBehaviors.RegionBehaviorType {
  static LOCALIZATION_PREFIXES = ['SDM.Hazard', 'BEHAVIOR.TYPES.base'];

  static defineSchema() {
    const fields = foundry.data.fields;
    const E = CONST.REGION_EVENTS;
    const statuses = () =>
      Object.fromEntries([
        ['', ''],
        ...CONFIG.statusEffects
          .map(status => [status.id, game.i18n.localize(status.name ?? status.label ?? status.id)])
          .sort((a, b) => a[1].localeCompare(b[1], game.i18n.lang))
      ]);
    return {
      events: this._createEventsField({ events: [E.TOKEN_ENTER, E.TOKEN_TURN_START, E.TOKEN_ROUND_START], initial: [E.TOKEN_ENTER] }),
      damage: new fields.StringField({ required: true, blank: true, initial: '' }),
      condition: new fields.StringField({ required: true, blank: true, initial: '', choices: statuses }),
      conditionRounds: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 1 }),
      save: new fields.BooleanField({ initial: false }),
      saveAbility: new fields.StringField({
        required: true,
        blank: true,
        initial: '',
        choices: () => ({ '': 'SDM.AreaSaveAbilityAny', ...CONFIG.SDM.abilities })
      }),
      saveDifficulty: new fields.StringField({
        required: true,
        blank: true,
        initial: '',
        choices: () => ({
          '': 'SDM.SaveDifficulty.standard',
          veryEasy: 'SDM.SaveDifficulty.veryEasy',
          easy: 'SDM.SaveDifficulty.easy',
          hard: 'SDM.SaveDifficulty.hard',
          veryHard: 'SDM.SaveDifficulty.veryHard'
        })
      }),
      savePass: new fields.StringField({ required: true, blank: false, initial: 'avoid', choices: () => CONFIG.SDM.areaSavePass }),
      affects: new fields.StringField({
        required: true,
        blank: false,
        initial: 'everyone',
        choices: {
          everyone: 'SDM.Hazard.Affects.everyone',
          hostile: 'SDM.Hazard.Affects.hostile',
          friendly: 'SDM.Hazard.Affects.friendly',
          neutral: 'SDM.Hazard.Affects.neutral',
          enemies: 'SDM.Hazard.Affects.enemies',
          allies: 'SDM.Hazard.Affects.allies'
        }
      }),
      uses: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 })
    };
  }

  /** Always heard (not one of its events): a token leaving the region. */
  static events = {
    [CONST.REGION_EVENTS.TOKEN_EXIT]: async function (event) {
      if (!game.users.activeGM?.isSelf || !event.data?.token) return;
      const { hazardExit } = await import('../helpers/areas.mjs');
      await hazardExit(this.behavior, event.data.token);
    }
  };

  /** @override */
  async _handleRegionEvent(event) {
    // The Referee's game resolves it (once, whoever moved the token)
    if (!game.users.activeGM?.isSelf) return;
    const token = event.data?.token;
    if (!token?.actor) return;
    const { hazardEvent } = await import('../helpers/areas.mjs');
    await hazardEvent(this.behavior, token, event.name);
  }
}

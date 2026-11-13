/**
 * Optional systems the GM can turn off (Core Rules settings, all on by default):
 * roll triggers, counters and damage boost. Off hides their sections and skips their automation;
 * the data stays on items and actors and comes back when turned on again.
 */
export const FEATURE_SETTINGS = {
  triggers: 'enableTriggers',
  counters: 'enableCounters',
  boost: 'enableDamageBoost'
};

export function featureEnabled(name) {
  const key = FEATURE_SETTINGS[name];
  if (!key) return true;
  try {
    return game.settings.get('sdm', key) !== false;
  } catch {
    return true;
  }
}

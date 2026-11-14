/**
 * Compact mode of the character and caravan sheets, kept per client (this browser), so two people
 * can look at the same sheet one compact and one expanded. Starts from the actor's old shared flag
 * (worlds before 1.11.0) or the sheet's default.
 */
const storageKey = actor => `sdm.compactMode.${actor?.uuid}`;

export function getCompactMode(actor, fallback = true) {
  try {
    const stored = globalThis.localStorage?.getItem(storageKey(actor));
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
    // Storage blocked: use the default
  }
  return actor?.getFlag?.('sdm', 'compactMode') ?? fallback;
}

export function setCompactMode(actor, value) {
  try {
    globalThis.localStorage?.setItem(storageKey(actor), value ? 'true' : 'false');
  } catch {
    // Storage blocked: the choice lasts until the sheet re-renders
  }
}

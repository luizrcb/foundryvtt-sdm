/**
 * Keybindings that can also be set from the Client Settings menu. Each has a client setting with the
 * binding as text ("Control+Shift+KeyB"; blank: no key, off); Configure Controls stays the source:
 * the menu shows the binding as it is now and writes it there.
 * Foundry reads Control as Cmd on a Mac.
 */

/** Client setting → keybinding action (namespace sdm). */
export const KEYBINDING_SETTINGS = {
  zoneHoldKeyBinding: 'showZonesHold',
  compendiumBrowserKeyBinding: 'openCompendiumBrowser'
};

/** { key: 'KeyB', modifiers: ['Control', 'Shift'] } → "Control+Shift+KeyB" */
export function bindingText(binding) {
  return binding?.key ? [...(binding.modifiers ?? []), binding.key].join('+') : '';
}

/** The action's binding as it is now. */
export function currentBinding(action) {
  return bindingText(game.keybindings.get('sdm', action)?.[0]);
}

/** "Control+Shift+KeyB" → "Ctrl + Shift + B" (⌘ on a Mac) */
export function bindingLabel(text) {
  const mac = navigator?.platform?.toLowerCase?.().includes('mac');
  return `${text ?? ''}`
    .split('+')
    .filter(Boolean)
    .map(part =>
      part
        .replace(/^Key/, '')
        .replace(/^Digit/, '')
        .replace(/^Control$/, mac ? '⌘' : 'Ctrl')
    )
    .join(' + ');
}

/** Write the binding to Configure Controls ("" removes the key). */
export async function setBinding(action, text) {
  const parts = `${text ?? ''}`.split('+').filter(Boolean);
  const key = parts.pop();
  try {
    await game.keybindings.set('sdm', action, key ? [{ key, modifiers: parts }] : []);
  } catch (error) {
    console.warn(`SDM | ${action} key not set`, error);
  }
}

/** The client setting of one of these keys (registered with its keybinding). */
export function registerKeybindingSetting(setting, { name, hint, default: initial }) {
  game.settings.register('sdm', setting, {
    name,
    hint,
    scope: 'client',
    config: false,
    type: String,
    default: initial,
    onChange: value => setBinding(KEYBINDING_SETTINGS[setting], value)
  });
}

import { $fmt, $l10n } from "./helpers/globalUtils.mjs";

const CHANNEL = 'system.sdm';

// Whitelisted settings that players are allowed to request updates for
const ALLOWED_SETTINGS = {
  bonusHeroDicePool: {
    type: 'number',
    min: 0,
    max: 999,
    scope: 'world',
    notifyAll: true
  }
};

// Simple rate limit (per user)
const RATE_LIMIT_MS = 800;
const _lastRequestAt = new Map(); // userId -> timestamp

function _rateLimited(userId) {
  const now = Date.now();
  const last = _lastRequestAt.get(userId) ?? 0;
  if (now - last < RATE_LIMIT_MS) return true;
  _lastRequestAt.set(userId, now);
  return false;
}

function coerceAndValidate(value, spec) {
  if (spec.type === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error('SDM.ErrorSettingNotNumber');
    if (spec.min != null && n < spec.min) throw new Error('SDM.ErrorSettingOutOfRange');
    if (spec.max != null && n > spec.max) throw new Error('SDM.ErrorSettingOutOfRange');
    return n;
  }
  if (spec.type === 'boolean') {
    return value === true || value === 'true' || value === 1 || value === '1';
  }
  if (spec.type === 'string') {
    return String(value ?? '');
  }
  return value;
}

function assertRegisteredSetting(namespace, key, spec) {
  const reg = game.settings.settings.get(`${namespace}.${key}`);
  if (!reg) throw new Error('SDM.ErrorSettingUnknown');
  if (reg.scope !== (spec.scope ?? 'world')) throw new Error('SDM.ErrorSettingInvalidScope');
  if (reg.requiresReload) throw new Error('SDM.ErrorSettingRequiresReload');
}

/**
 * Setup socket listener for settings update requests
 */
export function setupSettingsSocket() {
  game.socket.on(CHANNEL, async ({ action, payload, userId }) => {
    // GM handles requests
    if (action === 'settingUpdateRequest' && game.user.isGM) {
      try {
        if (_rateLimited(userId)) throw new Error('SDM.ErrorTooManyRequests');

        const { namespace = 'sdm', key, value } = payload;
        const spec = ALLOWED_SETTINGS[key];
        if (!spec) throw new Error('SDM.ErrorSettingNotAllowed');

        assertRegisteredSetting(namespace, key, spec);
        const finalValue = coerceAndValidate(value, spec);

        await game.settings.set(namespace, key, finalValue);

        // Respond to the requester
        game.socket.emit(CHANNEL, {
          action: 'settingUpdateResult',
          userId,
          payload: { success: true, key, value: finalValue }
        });

        // Notify all players if desired
        if (spec.notifyAll) {
          ui.notifications.info(
            $fmt('SDM.SettingUpdatedBroadcast', { key: $l10n('SDM.BonusHeroDicePool'), value: String(finalValue) })
          );
        }
      } catch (error) {
        game.socket.emit(CHANNEL, {
          action: 'settingUpdateResult',
          userId,
          payload: { success: false, message: error.message }
        });
      }
    }

    // Client receives result
    if (action === 'settingUpdateResult' && userId === game.user.id) {
      const { success, message, key, value } = payload ?? {};
      if (success) {
        ui.notifications.info(
          $fmt('SDM.SettingUpdated', { key: $l10n('SDM.BonusHeroDicePool'), value: String(value) })
        );
      } else {
        ui.notifications.error(
          message || $l10n('SDM.ErrorSettingUpdateFailedGeneric')
        );
      }
    }
  });
}

/**
 * Utility for players to request a setting update via GM socket
 */
export async function requestSettingUpdate(key, value, namespace = 'sdm') {
  if (game.user.isGM) {
    try {
      await game.settings.set(namespace, key, value);
      ui.notifications.info($fmt('SDM.SettingUpdated', { key: $l10n('SDM.BonusHeroDicePool'), value: String(value) }));
      return { success: true };
    } catch (err) {
      ui.notifications.error(err.message);
      return { success: false, message: err.message };
    }
  }

  if (!game.users.activeGM) {
    ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
    return { success: false, message: 'No active Referee' };
  }

  return new Promise(resolve => {
    const handler = ({ action, userId, payload }) => {
      if (action !== 'settingUpdateResult') return;
      if (userId !== game.user.id) return;
      game.socket.off(CHANNEL, handler);
      resolve(payload ?? { success: false, message: 'Unknown error' });
    };
    game.socket.on(CHANNEL, handler);

    game.socket.emit(CHANNEL, {
      action: 'settingUpdateRequest',
      userId: game.user.id,
      payload: { namespace, key, value }
    });
  });
}

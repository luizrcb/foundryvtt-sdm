/**
 * Pure caravan transport math. No `game.*`, no `foundry.*`, no Document methods.
 *
 * Rule: an assigned mount contributes nothing to the caravan directly; it only helps its
 * vehicle become "hauled". A hauled vehicle contributes its full capacity. An under-hauled
 * vehicle contributes 0, and so do its assigned mounts. Only unassigned mounts (or mounts
 * pointing at a vehicle that no longer exists) contribute their own capacity, 1×.
 */

const PULL_MULTIPLIERS = Object.freeze({
  carting: 3,
  dragging: 2
});

const toInt = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const pullMultiplier = pullMode => PULL_MULTIPLIERS[pullMode] ?? 0;

const hasFeature = (features, key) =>
  features instanceof Set
    ? features.has(key)
    : Array.isArray(features)
      ? features.includes(key)
      : false;

/**
 * Pull mode forced by a vehicle's features: Cart → carting (×3), Sled → dragging (×2).
 * Cart wins when both are present. Returns null when neither is set, in which case each
 * mount's own pull_mode is used (fallback).
 * @param {{system: object}} vehicle
 * @returns {string|null}
 */
export const vehiclePullMode = vehicle => {
  const features = vehicle?.system?.features;
  if (hasFeature(features, 'cart')) return 'carting';
  if (hasFeature(features, 'sled')) return 'dragging';
  return null;
};

/**
 * Effective pull mode of a mount: the vehicle's forced mode, else the mount's own.
 * @returns {string}
 */
export const effectivePullMode = (mount, vehicle) =>
  vehiclePullMode(vehicle) ?? mount?.system?.pull_mode ?? '';

/**
 * @param {object} params
 * @param {Array<{id: string, name: string, system: object}>} params.mounts
 * @param {Array<{id: string, name: string, system: object}>} params.vehicles
 * @returns {{
 *   capacity: number,
 *   speedRaw: number,
 *   underHauled: string[],
 *   breakdown: {
 *     vehicles: Array<{id: string, name: string, need: number, pullPower: number, hauled: boolean, automatic: boolean}>,
 *     unassignedMounts: Array<{id: string, name: string, capacity: number}>,
 *     speedParts: Array<{id: string, name: string, vehicleSpeed: number|null, mountSpeed: number|null, value: number, group: 'vehicle'|'mount'}>,
 *     speedVehicles: number|null,
 *     speedMounts: number|null
 *   }
 * }}
 */
export function computeCaravanTransport({ mounts = [], vehicles = [] } = {}) {
  let capacity = 0;
  const underHauled = [];
  const vehicleBreakdown = [];
  const unassignedMounts = [];
  const vehicleIds = new Set(vehicles.map(v => v.id));

  for (const v of vehicles) {
    const need = toInt(v.system?.capacity);

    // Step A — automatic (self-propelled) vehicles always contribute their full capacity
    if (v.system?.automatic) {
      capacity += need;
      vehicleBreakdown.push({
        id: v.id,
        name: v.name,
        need,
        pullPower: 0,
        hauled: true,
        automatic: true
      });
      continue;
    }

    // Step B — non-automatic vehicles must be fully hauled by their assigned mounts
    const pullPower = mounts
      .filter(m => m.system?.pull_vehicle_id === v.id)
      .reduce(
        (sum, m) => sum + toInt(m.system?.capacity) * pullMultiplier(effectivePullMode(m, v)),
        0
      );

    const hauled = pullPower >= need;
    if (hauled) {
      capacity += need;
    } else {
      underHauled.push(v.id);
    }

    vehicleBreakdown.push({
      id: v.id,
      name: v.name,
      need,
      pullPower,
      hauled,
      automatic: false,
      pullMode: vehiclePullMode(v)
    });
  }

  // Step C — unassigned mounts (or orphaned pointers) carry on their backs, 1×
  for (const m of mounts) {
    const target = m.system?.pull_vehicle_id || '';
    if (!target || !vehicleIds.has(target)) {
      const mountCapacity = toInt(m.system?.capacity);
      capacity += mountCapacity;
      unassignedMounts.push({ id: m.id, name: m.name, capacity: mountCapacity });
    }
  }

  // Speed (uncapped; the caller adds bonuses):
  //  - automatic vehicle: its own speed
  //  - hauled vehicle: vehicle speed + slowest assigned mount (a team is as fast as its slowest member)
  //  - under-hauled vehicle and its mounts: nothing
  //  - vehicles pace = slowest vehicle; unassigned mounts pace = slowest unassigned mount
  //    (many +1 mounts still count as a single +1)
  //  - caravan speed = vehicles pace + unassigned mounts pace (a missing group counts as 0)
  const speedParts = [];
  for (const v of vehicles) {
    const vehicleSpeed = toInt(v.system?.speed);
    if (v.system?.automatic) {
      speedParts.push({
        id: v.id,
        name: v.name,
        vehicleSpeed,
        mountSpeed: null,
        value: vehicleSpeed,
        group: 'vehicle'
      });
      continue;
    }
    if (underHauled.includes(v.id)) continue;
    const mountSpeeds = mounts
      .filter(m => m.system?.pull_vehicle_id === v.id)
      .map(m => toInt(m.system?.speed));
    const mountSpeed = mountSpeeds.length ? Math.min(...mountSpeeds) : 0;
    speedParts.push({
      id: v.id,
      name: v.name,
      vehicleSpeed,
      mountSpeed,
      value: vehicleSpeed + mountSpeed,
      group: 'vehicle'
    });
  }
  for (const m of unassignedMounts) {
    const source = mounts.find(x => x.id === m.id);
    const value = toInt(source?.system?.speed);
    speedParts.push({
      id: m.id,
      name: m.name,
      vehicleSpeed: null,
      mountSpeed: value,
      value,
      group: 'mount'
    });
  }
  const slowest = group => {
    const values = speedParts.filter(p => p.group === group).map(p => p.value);
    return values.length ? Math.min(...values) : null;
  };
  const speedVehicles = slowest('vehicle');
  const speedMounts = slowest('mount');
  const speedRaw = (speedVehicles ?? 0) + (speedMounts ?? 0);

  return {
    capacity,
    speedRaw,
    underHauled,
    breakdown: {
      vehicles: vehicleBreakdown,
      unassignedMounts,
      speedParts,
      speedVehicles,
      speedMounts
    }
  };
}

import { GearType, ItemType, SizeUnit } from './constants.mjs';
import { $l10n } from './globalUtils.mjs';
import { canRefillUses, refillUsesUpdate } from './itemUses.mjs';
import {
  animateItem,
  deanimateItem,
  isAnimatable,
  isAnimationBlocked,
  isRideItem,
  requestAnimation,
  requestDeanimation
} from './animatedItems.mjs';
import { heroDieCounters, rechargeWithHeroDie } from './onceAbilities.mjs';
import { isLit } from './lights.mjs';
import { dismissForm, itemFormOn, itemForms, takeItemForm } from './forms.mjs';

/**
 * Item actions besides rolling and Use, as the inventory's right-click menu offers them, for
 * modules (Token Action HUD WTF): `game.sdm.api.items.actions(item)` → [{ id, label, icon, run }].
 */
export function itemActions(item) {
  if (!item?.actor || !item.isOwner) return [];
  const system = item.system ?? {};
  const features = system.features;
  const has = feature => !!features?.has?.(feature);
  const gm = game.user.isGM;
  const actions = [];
  const add = (id, label, icon, run) => actions.push({ id, label: $l10n(label), icon, run: () => run(item) });

  // Usage roll (replenish)
  if (has('replenish') && system.resources !== 'run_out') {
    add('usageRoll', 'SDM.Item.UsageRoll', 'fa-solid fa-arrow-rotate-right', i => i.usageRoll(i.system.replenish.value, { applyResult: true }));
  }
  // Charges: +1, −1
  const max = Number(system.charges?.max) || 0;
  const value = Number(system.charges?.value) || 0;
  if (has('charges') && max > 0 && value < max) add('addCharge', 'SDM.Item.AddOneCharge', 'fa-solid fa-circle-plus', i => i.updateCurrentCharges(1));
  if (has('charges') && max > 0 && value > 0) add('removeCharge', 'SDM.Item.RemoveOneCharge', 'fa-solid fa-circle-minus', i => i.updateCurrentCharges(-1));
  // Recharge: resources back, charges full, uses back
  const gear = item.type === ItemType.GEAR && system.size?.unit !== SizeUnit.CASH &&
    ![GearType.CORRUPTION, GearType.AFFLICTION, GearType.PET, GearType.CONTAINER].includes(system.type);
  const refillsCharges = has('charges') && !has('replenish') && max > 0 && value < max;
  if (gear && (system.resources !== '' || refillsCharges || canRefillUses(item))) {
    add('recharge', 'SDM.Item.Recharge', 'fa-solid fa-battery-full', i =>
      i.update({
        'system.resources': '',
        ...(has('charges') && !has('replenish') ? { 'system.charges.value': max } : {}),
        ...refillUsesUpdate(i)
      })
    );
  }
  // Counters recharged with a hero die (Second Chance, Recast…)
  if (heroDieCounters(item).length) add('heroDieRecharge', 'SDM.Once.Recharge', 'fa-solid fa-dice', rechargeWithHeroDie);
  // Animated items and rides: animate (or ask), turn back (or ask)
  if (isAnimatable(item)) {
    const ride = isRideItem(item);
    const active = !!system.animation?.active;
    if (!active && !isAnimationBlocked(item)) {
      if (gm) add('animate', ride ? 'SDM.Ride.Deploy' : 'SDM.Animation.Animate', ride ? 'fa-solid fa-flag' : 'fa-solid fa-ghost', animateItem);
      else add('animate', ride ? 'SDM.Ride.Request' : 'SDM.Animation.Request', 'fa-solid fa-hand', requestAnimation);
    }
    if (active) {
      if (gm) add('deanimate', ride ? 'SDM.Ride.Deanimate' : 'SDM.Animation.Deanimate', ride ? 'fa-solid fa-house-flag' : 'fa-solid fa-box', deanimateItem);
      else add('deanimate', ride ? 'SDM.Ride.DeanimateRequest' : 'SDM.Animation.DeanimateRequest', ride ? 'fa-solid fa-house-flag' : 'fa-solid fa-box', requestDeanimation);
    }
  }
  // Forms it gives its bearer (a shapeshifter's trait, a hide): take one, or end the one in use
  if (itemForms(item).length) {
    if (itemForms(item).some(effect => effect.disabled)) add('takeForm', 'SDM.Form.Take', 'fa-solid fa-paw', takeItemForm);
    if (itemFormOn(item)) add('endForm', 'SDM.Form.End', 'fa-solid fa-person-walking-arrow-loop-left', i => dismissForm(i.actor));
  }
  // A hallmark's level-up upgrade waiting to be chosen
  if (system.is_hallmark && (Number(system.hallmark?.pending_upgrades) || 0) > 0) {
    add('upgrade', 'SDM.Upgrade.Confirm', 'fa-solid fa-star', async i => {
      const { openHallmarkUpgradeDialog } = await import('../app/level-upgrades.mjs');
      return openHallmarkUpgradeDialog(i);
    });
  }
  return actions;
}

/** What an inventory row marks on an item: single use, lit, a hallmark upgrade waiting. */
export function itemMarkers(item) {
  const system = item?.system ?? {};
  return {
    singleUse: !!system.power?.single_use || (system.powers ?? []).some(power => power?.single_use),
    lit: isLit(item),
    upgrade: !!system.is_hallmark && (Number(system.hallmark?.pending_upgrades) || 0) > 0,
    form: itemFormOn(item)
  };
}

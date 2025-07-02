import { PullMode, SizeUnit } from "../helpers/constants.mjs";
import { convertToCash, getSlotsTaken } from "../helpers/itemUtils.mjs";

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class SdmItem extends Item {

  // /** @override */
  // async _onCreate(data, options, userId) {
  //   // item creation method
  //   await super._onCreate(data, options, userId);
  // }

  // /** @override */
  // async _onUpdate(changed, options, userId) {
  //   await super._onUpdate(changed, options, userId);
  // }

  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();
  }

  getCarryCapacity() {
    let carryWeight= 0;

    switch (this.type) {
      case 'mount':
        let mountCapacity = this.system.capacity; //in sacks
        const { motorId = '', mode = '' } = this.system.pulledLoad;
        const motor = fromUuidSync(motorId);

        if (!motorId || !motor) {
          carryWeight = Math.max(mountCapacity - this.system.riders.length, 0)
          break;
        }

        break;
      case 'motor':
        const motorCapacity = this.system.capacity; //in sacks

        if (this.system.selfPulled) {
          carryWeight = motorCapacity;
          break;
        }

        let mountsCapacity = 0;
        const pulledBy = this.system.pulledBy;

        for (let pullMount of pulledBy) {
          const mountActor = fromUuidSync(pullMount);
          if (!mountActor) continue;
          const { mode = '' } = mountActor.system.pulledLoad;
          let pullModeMultiplier = 1;

          if (mode === PullMode.DRAGGING) {
            pullModeMultiplier = 2;
          } else if (mode === PullMode.CARTING) {
            pullModeMultiplier = 3;
          }
          mountsCapacity += (mountActor.system.capacity * pullModeMultiplier);
        }

        if (mountsCapacity >= motorCapacity) {
          carryWeight = motorCapacity;
        }

        break;
      default:
        break;
    }

    return convertToCash(carryWeight, SizeUnit.SACKS);
  }

  getItemSlots() {
    return getSlotsTaken(this.system);
  }

  /**
   * Prepare a data object which defines the data schema used by dice roll commands against this Item
   * @override
   */
  getRollData() {
    // Starts off by populating the roll data with a shallow copy of `this.system`
    const rollData = { ...this.system };

    // Quit early if there's no parent actor
    if (!this.actor) return rollData;

    // If present, add the actor's roll data
    rollData.actor = this.actor.getRollData();

    return rollData;
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async roll(event, damageMode = '') {
    const item = this;

    // Initialize chat data.
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');
    const itemTypeLabel = game.i18n.localize(`TYPES.Item.${item.type}`);
    let label = `[${itemTypeLabel}] ${item.name}`;

    // Retrieve roll data.
    const rollData = this.getRollData();
    const { formula = '', damage, actor, versatile } = rollData;
    let finalRoll;

    if (formula) {
      finalRoll = formula
    } else {
      finalRoll = damage?.base || '';
      if (versatile && damageMode === 'versatile' && damage.versatile) {
        finalRoll = damage.versatile;
        label += ` (${game.i18n.localize('SDM.FeatureVersatile')})`
      }
    }

    // Invoke the roll and submit it to chat.
    const roll = new Roll(finalRoll, actor);
    await roll.evaluate();
    // If you need to store the value first, uncomment the next line.

    await roll.toMessage({
      speaker: speaker,
      rollMode: rollMode,
      flavor: label,
    });
  }
}

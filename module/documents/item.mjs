import { createChatMessage } from '../helpers/chatUtils.mjs';
import {
  ActorType,
  GearType,
  ItemStatusType,
  ItemType,
  SizeUnit,
  TraitType
} from '../helpers/constants.mjs';
import { $fmt, $l10n, capitalizeFirstLetter, safeEvaluate } from '../helpers/globalUtils.mjs';
import { getSlotsTaken } from '../helpers/itemUtils.mjs';
import { templatePath } from '../helpers/templates.mjs';

const { renderTemplate } = foundry.applications.handlebars;

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class SdmItem extends Item {
  async _onUpdate(changed, options, userId) {
    await super._onUpdate(changed, options, userId);

    if (changed?.system?.hallmark?.experience !== undefined) {
      let value = safeEvaluate(`${changed.system.hallmark.experience}`.trim());
      value = parseInt(value, 10) || 0;
      await this.update({
        'system.hallmark.experience': `${value}`
      });
    }

    if (changed?.system?.max_powers !== undefined) {
      if (changed.system?.max_powers < this.system.powers.length) {
        await this.update({
          'system.max_powers': this.system.powers.length
        });
      }
    }

    if (changed?.system?.type !== undefined) {
      if (this.type === ItemType.TRAIT && changed.system.type !== GearType.POWER) {
        await this.update({
          'system.is_hallmark': false
        });
      }
    }

    if (changed?.system?.size && changed?.system?.size?.unit === SizeUnit.CASH) {
      await this.update({
        'system.is_hallmark': false
      });
    }
  }

  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();
  }

  getCostTitle(addParentheses = true) {
    if (this.system.cost) {
      const costFrequency = this.system.cost_frequency;
      const costValue = (this.system.cost || 0) * (this.system.quantity || 1);
      const frequencyLabel = costFrequency
        ? `/${$l10n(`SDM.Frequency${capitalizeFirstLetter(costFrequency)}`)}`
        : '';
      const costTitle = `${$l10n('SDM.CashSymbol')}${costValue}${frequencyLabel}`;
      if (!addParentheses) return ` ${costTitle}`;
      return ` (${costTitle})`;
    }
    return '';
  }

  getSizeTitle() {
    //this.system?.size?.unit === SizeUnit.CASH
  }

  getSlotsTaken() {
    return getSlotsTaken(this.system);
  }

  getNameTitle() {
    const status = this.system.status;
    const statusTitle = status
      ? `(${$l10n(`SDM.ItemStatus${capitalizeFirstLetter(status)}`)})`
      : '';

    return `${statusTitle} ${this.name}`;
  }

  getArmorTitle() {
    const armorData = this.system?.armor;
    const armorValueLabel = `${$l10n('SDM.ArmorValue')}: ${armorData?.value}`;
    const armorTypeLabel = `${$l10n('SDM.ArmorType')}: ${
      $l10n(CONFIG.SDM.armorType[armorData?.type]) ?? ''
    }`;
    const title = `${this.getNameTitle()}${this.getCostTitle()}<br/>${armorValueLabel} ${armorTypeLabel}`;
    return title;
  }

  getWardTitle() {
    const wardData = this.system?.ward;
    const wardValueLabel = `${$l10n('SDM.WardValue')}: ${wardData?.value}`;
    const armorValueLabel = `${$l10n('SDM.ArmorValue')}: ${wardData?.armor}`;
    const wardTypeLabel = `${$l10n('SDM.WardType')}: ${
      $l10n(CONFIG.SDM.wardType[wardData?.type]) ?? ''
    }`;
    const title = `${this.getNameTitle()}${this.getCostTitle()}<br/>${wardValueLabel}${
      wardData?.armor ? ` ${armorValueLabel}` : ''
    } ${wardTypeLabel}`;
    return title;
  }

  getDefaultAbilityLabel(power) {
    const defaultAbility = power ? power.default_ability : this.system.default_ability;
    return `(+${$l10n(CONFIG.SDM.abilityAbbreviations[defaultAbility])})`;
  }

  getDefaultTitle() {
    let title = '';

    switch (this.type) {
      case 'gear':
        if (this.system?.size?.unit === SizeUnit.CASH) {
          title = `${capitalizeFirstLetter($l10n('SDM.UnitCash'))}: ${$l10n(
            'SDM.CashSymbol'
          )}${this.system.quantity * (this.system.size.value || 1)}`;
        } else {
          let remainingItems = '';
          if (!this.system.type && this.system.starting_kit) {
            remainingItems = `<br>${$l10n('SDM.GearStartingKitRemainingItems')}: ${this.system.packed_remaining_items}`;
          }
          title = `${$l10n('TYPES.Item.gear')}: ${this.getNameTitle()}${this.getCostTitle()}${remainingItems}`;
        }
        break;
      case 'trait':
        title = `${$l10n('TYPES.Item.trait')}: ${this.getNameTitle()}${this.getCostTitle()}`;
        break;
      case 'burden':
        title = `${$l10n('TYPES.Item.burden')}: ${this.getNameTitle()}${this.getCostTitle()}`;
        break;
    }

    return title;
  }

  getPowerShortTitle(powerData, actorPowerCost = 2, overcharge = false) {
    const powerName = powerData.name || this.name;
    const powerLevel = powerData?.level;

    let powerCost = Math.ceil(actorPowerCost * powerLevel);
    if (overcharge) powerCost *= 2;
    let title = `${powerName} (${$l10n('SDM.Cost').toLowerCase()}: ${powerCost})`;
    return title;
  }

  getPowerTitle(powerData, actorPowerCost = 2) {
    const powerLevel = powerData?.level;
    const powerCost = Math.ceil(actorPowerCost * powerLevel);
    const powerName = powerData.name || this.getNameTitle();

    let title = `<b>${powerName}</b>${!powerData?.name ? this.getCostTitle() : ''} (${$l10n('SDM.Cost').toLowerCase()}: ${powerCost})<br/>`;

    const powerLabel = `${$l10n('SDM.PowerLevelAbbr')}: ${powerLevel}`;
    const rangeLabel = `${$l10n('SDM.PowerRangeAbbr')}: ${powerData?.range}`;
    const targetLabel = `${$l10n('SDM.PowerTargetAbbr')}: ${powerData?.target}`;
    const durationLabel = `${$l10n('SDM.PowerDurationAbbr')}: ${powerData?.duration}`;
    const overchargeLabel = `${$l10n('SDM.PowerOverchargeAbbr')}: ${powerData?.overcharge}`;
    let rollLabel = `${$l10n('SDM.PowerRollFormulaAbbr')}: ${powerData?.roll_formula}`;

    if (powerData?.default_ability) {
      rollLabel += ` ${this.getDefaultAbilityLabel(powerData)}`;
    }

    title += `${powerLabel}, ${rangeLabel}, ${targetLabel}, ${durationLabel}${powerData?.roll_formula ? `, ${rollLabel}` : ''}`;
    title += powerData?.overcharge ? `<br/>${overchargeLabel}` : '';

    return title;
  }

  getPowerAlbumTitle(actorPowerCost = 2) {
    let title = `${$l10n('SDM.PowerAlbum')}: <b>${this.getNameTitle()}</b>${this.getCostTitle()}<br/><br/>`;

    if (!this.system.powers.length) {
      title += `<i class="fa-solid fa-spider"></i> ${$l10n('SDM.NoPowers')} <i class="fa-solid fa-spider"></i>`;
      return title;
    }

    this.system.powers.forEach((power, index) => {
      title += `${index + 1}) ${this.getPowerTitle(power, actorPowerCost)}<br/><br>`;
    });

    return title;
  }

  getSkillTitle() {
    const skillMod = this.system?.skill?.modifier_final;
    const skillRank = this.system?.skill?.rank;

    if (skillMod === 0) return this.name;
    const allMods = { ...CONFIG.SDM.skillMod, ...CONFIG.SDM.extraSkillMod };
    const skillModLabel = $l10n(allMods[skillRank]);
    const title = `${$l10n('SDM.SkillMod')}: +${skillMod} ${skillModLabel}`;

    return title;
  }

  getWeaponTitle() {
    const data = this.system;
    const weaponData = data?.weapon;

    let title = `${this.getNameTitle()}${this.getCostTitle()}<br/>${$l10n('SDM.Damage')}: ${weaponData?.damage.base}`;

    if (weaponData?.versatile) {
      title += `/${weaponData?.damage.versatile}`;
    }

    if (data?.default_ability) {
      title += ` ${this.getDefaultAbilityLabel()}`;
    }

    const rangeLabel = $l10n(CONFIG.SDM.rangeType[weaponData?.range]) ?? '';

    title += ` ${$l10n('SDM.WeaponRange')}: ${rangeLabel}`;

    return title;
  }

  getInventoryTitle() {
    let title = '';
    const data = this.system;

    const getInventoryItemTitle = {
      [GearType.ARMOR]: () => this.getArmorTitle(),
      [TraitType.POWER]: (system, actorSystem) =>
        this.getPowerTitle(system.power, actorSystem.power_cost),
      [GearType.POWER_ALBUM]: (system, actorSystem) =>
        this.getPowerAlbumTitle(actorSystem.power_cost),
      [TraitType.SKILL]: () => this.getSkillTitle(),
      [GearType.WEAPON]: () => this.getWeaponTitle(),
      [GearType.WARD]: () => this.getWardTitle(),
      [ItemType.MOUNT]: () => this.getDefaultTitle(),
      [ItemType.VEHICLE]: () => this.getDefaultTitle(),
      '': () => this.getDefaultTitle()
    };

    const titleFunction = getInventoryItemTitle[data.type];
    title = titleFunction(this.system, this.actor.system);

    return title;
  }

  getInventoryName() {}

  async getItemChatCard({ collapsed = false, displayWeight = true }) {
    let type = this.system.type ? this.system.type : this.type;

    let costSubtitle = `${$l10n('SDM.CashSymbol')}${this.system.cost}`;

    let weightSubtitle = `${this.system.size.value} ${$l10n(`SDM.Unit.${this.system.size.unit}.abbr`)}`;

    if (this.system.size.unit === SizeUnit.CASH) {
      type = SizeUnit.CASH;
      costSubtitle = `${$l10n('SDM.CashSymbol')}${this.system.quantity * (this.system.size.value || 1)}`;
      weightSubtitle = '';
    }

    if ([ItemType.TRAIT, ItemType.BURDEN].includes(this.type)) {
      weightSubtitle = '';
      costSubtitle = '';
    }

    const context = {
      config: CONFIG.SDM,
      item: this,
      type,
      costSubtitle,
      weightSubtitle: displayWeight ? weightSubtitle : '',
      collapsed
    };

    return await renderTemplate(templatePath('chat/item-card'), context);
  }

  async sendToChat({
    actor,
    flavor = '',
    collapsed = false,
    displayWeight = true,
    blindGMRoll = false
  }) {
    const content = await this.getItemChatCard({ collapsed, displayWeight });

    const chatMessageData = {
      actor,
      content,
      flavor: flavor || game.user.name
    };

    if (blindGMRoll) {
      chatMessageData.rollMode = CONST.DICE_ROLL_MODES.BLIND;
    }

    return createChatMessage(chatMessageData);
  }

  async toggleReadied() {
    const BROKEN_ITEM_READIED = false;

    let nextValue = this.system.broken ? BROKEN_ITEM_READIED : !this.system.readied;

    if (!this.parent || (this.parent && this.parent?.type === ActorType.CARAVAN)) {
      nextValue = false;
    }

    await this.update({ 'system.readied': nextValue });
  }

  async toggleIsHallmark() {
    if (this.system.is_hallmark && this.system.hallmark) {
      const currentExperience = parseInt(this.system.hallmark.experience);
      if (currentExperience > 0) {
        ui.notifications.error($l10n('SMD.ErrorHallmarkExperience'));
        return;
      }
    }

    if (
      (!this.parent && !game.user.isGM) ||
      (this.parent && this.parent?.type === ActorType.CARAVAN)
    ) {
      return;
    }

    if (!this.system.is_hallmark && this.parent && this.parent?.type === ActorType.CHARACTER) {
      const characterCurrentHallmarks = this.parent.items.contents.filter(
        item => item.system.is_hallmark
      );
      if (characterCurrentHallmarks.length >= this.parent.system.level) {
        ui.notifications.error($fmt('SDM.ErrorHallmarkLimit', { target: this.parent.name }));
        return;
      }
    }

    await this.update({ 'system.is_hallmark': !this.system.is_hallmark });
  }

  async toggleItemStatus(action = '') {
    const isRepair = action === 'repair';
    const status = this.system.status;
    const readied = this.system.readied;

    let nextStatus;

    if (status === '' && !isRepair) {
      nextStatus = ItemStatusType.NOTCHED;
    } else if (status === ItemStatusType.NOTCHED) {
      nextStatus = isRepair ? '' : ItemStatusType.BROKEN;
    } else if (status === ItemStatusType.BROKEN && isRepair) {
      nextStatus = ItemStatusType.NOTCHED;
    }

    if (nextStatus === undefined) return; // sem mudança

    await this.update({
      'system.status': nextStatus,
      'system.readied': nextStatus === ItemStatusType.BROKEN ? false : readied
    });
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
      finalRoll = formula;
    } else {
      finalRoll = damage?.base || '';
      if (versatile && damageMode === 'versatile' && damage.versatile) {
        finalRoll = damage.versatile;
        label += ` (${game.i18n.localize('SDM.FeatureVersatile')})`;
      }
    }

    // Invoke the roll and submit it to chat.
    const roll = new Roll(finalRoll, actor);
    await roll.evaluate();
    // If you need to store the value first, uncomment the next line.

    await roll.toMessage({
      speaker: speaker,
      rollMode: rollMode,
      flavor: label
    });
  }
}

import { describeNpcProfile, getNpcProfile } from '../helpers/npcVariability.mjs';
import { applyDefeatCondition, combineRollModes, conditionRollMode, isWeakened } from '../helpers/conditions.mjs';
import { actorTriggers, renderTriggers, runTriggerActions } from '../rolls/triggers.mjs';
import { bindCollapsibleSections } from '../helpers/collapsibleSections.mjs';
import { restActor } from '../app/rest.mjs';
import { getPowerCost, getPowerDangerHtml, paysPowerCost, payPowerCost } from '../helpers/powerCost.mjs';
import { lightFromPower, powerCreatesLight, putOutLight } from '../helpers/lights.mjs';
import { getCompactMode, setCompactMode } from '../helpers/sheetPrefs.mjs';
import { consumeSingleUsePower } from '../helpers/singleUsePowers.mjs';
import { resolveFormula } from '../helpers/formulas.mjs';
import { combineMultiplier, describeBoost, describeBoostPaid, getBoost, payBoost } from '../rolls/boost.mjs';
import { useItem } from '../app/use-item.mjs';
import { ACTOR_COUNTER_ACTIONS, getCounters, resetCounters, stepCounter } from '../helpers/counters.mjs';
import CompendiumBrowser from '../app/compendium-browser.mjs';
import { SdmItem } from '../documents/item.mjs';

import {
  getNPCDataByLevel,
  getNpcTableChoices,
  getXpForLevel,
  getXpToNextLevel,
  MAX_MODIFIER
} from '../helpers/actorUtils.mjs';
import {
  ActorType,
  AttackTarget,
  GearType,
  ItemType,
  RollMode,
  RollType,
} from '../helpers/constants.mjs';
import { prepareActiveEffectCategories } from '../helpers/effects.mjs';
import {
  $fmt,
  $l10n,
  capitalizeFirstLetter,
  constructHTMLButton,
  isNewFormulaBetter,
  toPascalCase
} from '../helpers/globalUtils.mjs';
import {
  getSlotsTaken,
  ITEMS_ALLOWED_IN_CONTAINERS,
  ITEMS_NOT_ALLOWED_IN_CHARACTERS
} from '../helpers/itemUtils.mjs';
import { openInvestXpDialog } from '../app/invest-xp.mjs';
import { openProgressLog } from '../app/progress-log.mjs';
import { openCharacterUpgradeDialog, openHallmarkUpgradeDialog } from '../app/level-upgrades.mjs';
import { getAnimatedSourceItem, isAnimatedNpc } from '../helpers/animatedItems.mjs';
import { templatePath } from '../helpers/templates.mjs';
import { openItemTransferDialog } from '../items/transfer.mjs';
import { directResourceDiceRoll, healingHeroDice } from '../rolls/hero_dice/index.mjs';
import SDMRoll, { sanitizeExpression } from '../rolls/sdmRoll.mjs';
import { rollPreviewRows } from '../helpers/rollPreview.mjs';
import { speedContext, targetRangeHtml } from '../helpers/zones.mjs';
import {
  renderCorruptionResult,
  renderDangerResult,
  renderDefeatResult,
  renderGroupChaseResult,
  renderNPCMoraleResult,
  renderReactionResult,
  renderRelifeResult,
  renderSaveResult
} from '../rolls/ui/renderResults.mjs';
import { DEFAULT_SAVE_VALUE, SAVING_THROW_BASE_FORMULA } from '../settings.mjs';
import { bindNumberInputs, unformatNumberInputs, reformatNumberInputs } from '../helpers/numberFormat.mjs';

const { api, sheets } = foundry.applications;
const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;
const DragDrop = foundry.applications.ux.DragDrop.implementation;
const FilePicker = foundry.applications.apps.FilePicker.implementation;
const TextEditor = foundry.applications.ux.TextEditor.implementation;
const { performIntegerSort } = foundry.utils;

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheetV2}
 */
export class SdmActorSheet extends api.HandlebarsApplicationMixin(sheets.ActorSheetV2) {
  constructor(options = {}) {
    super(options);

    // Create a new classes array with the npc class if needed
    const classes = [...this.options.classes];
    const window = { ...this.options.window };
    const controls = [...this.options.window.controls];

    if (this.actor?.type === ActorType.NPC) {
      classes.push(ActorType.NPC);
      // Animated items level with their item, never on their own
      if (game.user.isGM && !isAnimatedNpc(this.actor)) {
        controls.push({
          action: 'levelUpNPC',
          icon: 'fa-solid fa-angles-up',
          label: 'Level UP NPC',
          ownership: 'OWNER'
        });
      }

      window.controls = controls;
    }

    if (this.actor?.type === ActorType.CHARACTER) {
      // controls.push({
      //   action: 'toggleMode',
      //   icon: 'fa-solid fa-gear',
      //   label: 'SDM.ToggleModeLabel',
      //   ownership: 'OWNER'
      // });

      if (game.user.isGM || game.settings.get('sdm', 'canPlayerRerollCharacter')) {
        controls.push({
          action: 'rerollCharacter',
          icon: 'fa-solid fa-recycle',
          label: 'SDM.RerollCharacter',
          ownership: 'OWNER'
        });
      }

      window.controls = controls;
    }

    // Update options with the new classes array
    this.options = {
      ...this.options,
      classes,
      window
    };

    this.#dragDrop = this.#createDragDropHandlers();
  }
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['sdm', 'actor'],
    position: {
      width: 800,
      height: 800
    },
    window: {
      resizable: true
    },
    actions: {
      createDoc: this._createAndViewDoc,
      deleteDoc: this._deleteDoc,
      heroicHealing: { handler: this._onHeroHealing, buttons: [0, 2] },
      bloodDiceRoll: this._onBloodDiceRoll,
      touristDiceRoll: this._onTouristDiceRoll,
      onEditImage: this._onEditImage,
      reactionRoll: this._onReactionRoll,
      relifeRoll: this._onRelifeRoll,
      groupChaseRoll: this._onGroupChaseRoll,
      corruptionRoll: this._onCorruptionRoll,
      defeatRoll: this._onDefeatRoll,
      roll: this._onRoll,
      rollNPCDamage: this._onRollNPCDamage,
      rollNPCMorale: this._onRollNPCMorale,
      rollSavingThrow: this._onRollSavingThrow,
      toggleEffect: this._toggleEffect,
      toggleMode: this._onToggleMode,
      openCompendiumBrowser: this._onOpenCompendiumBrowser,
      toggleReadied: this._toggleReadied,
      transferItem: this._onTransferItem,
      updateAttack: this._onUpdateAttack,
      viewDoc: this._viewDoc,
      rerollCharacter: this._onRerollCharacter,
      levelUpNPC: this._onLevelUpNPC,
      configureNpcTable: this._onConfigureNpcTable,
      toggleProtoLink: this._onToggleProtoLink,
      investXp: this._onInvestXp,
      showProgressLog: this._onShowProgressLog,
      chooseUpgrade: this._onChooseUpgrade,
      chooseHallmarkUpgrade: this._onChooseHallmarkUpgrade,
      openDoc: { handler: this._openDoc, buttons: [0] },
      toggleItemStatus: { handler: this._toggleItemStatus, buttons: [0, 2] },
      // Left click +1; right-click −1 is handled in _onRender (so the row's context menu stays closed)
      stepItemCounter: { handler: this._onStepItemCounter, buttons: [0] },
      ...ACTOR_COUNTER_ACTIONS,
      useItem: this._onUseItem,
      putOutLight: this._onPutOutLight,
      restActor: this._onRestActor,
      openPetSheet: this._onOpenPetSheet,
      toggleCompact: this._onToggleCompact
    },
    dragDrop: [{ dragSelector: '[data-drag]', dropSelector: null }],
    form: {
      submitOnChange: true
    }
  };

  /** @override */
  static PARTS = {
    header: {
      template: templatePath('actor/header')
    },
    tabs: {
      // Foundry-provided generic template
      template: 'templates/generic/tab-navigation.hbs'
    },
    inventory: {
      template: templatePath('actor/inventory'),
      scrollable: ['']
    },
    biography: {
      template: templatePath('actor/biography'),
      scrollable: ['']
    },
    notes: {
      template: templatePath('actor/notes'),
      scrollable: ['']
    },
    pet: {
      template: templatePath('actor/pet'),
      scrollable: ['']
    },
    effects: {
      template: templatePath('actor/effects'),
      scrollable: ['']
    }
  };

  async _openCustomRollModal(
    {
      type,
      from,
      ability = '',
      formula = '',
      canOvercharge = false,
      attack = '',
      versatile = false,
      versatileFormula = '',
      bonusDamage = '',
      powerOptions = [],
      powerIndex = 0,
      item = null,
      freeCast = false
    },
    isShift = false,
    isCtrl = false
  ) {
    let rollTitlePrefix = '';
    const isDamage = type === RollType.DAMAGE;
    const isAttack = type === RollType.ATTACK;
    const isAbility = type === RollType.ABILITY;
    const isPower = type === RollType.POWER;
    const isCharacter = this.actor.type === ActorType.CHARACTER;
    const isPowerAlbum = type === RollType.POWER_ALBUM;

    let targetActor;

    const firstTarget = Array.from(game.user.targets)[0];
    if (firstTarget) {
      targetActor = firstTarget.actor;
    }

    if (isDamage) rollTitlePrefix = $l10n('SDM.Damage');
    if (isAttack) rollTitlePrefix = $l10n('SDM.Attack');
    if (isAbility) rollTitlePrefix = $l10n('SDM.Ability');
    if (isPowerAlbum) rollTitlePrefix = $l10n('SDM.PowerAlbum');
    if (rollTitlePrefix !== '') rollTitlePrefix += ' ';

    let title = from;

    const actorAttack = isAttack && isCharacter ? this.actor.system[attack] : null;
    const actorAttackBonus = isAttack && isCharacter ? actorAttack.bonus || 0 : 0;
    const allAttackBonus = isAttack && isCharacter ? this.actor.system?.attack_bonus || 0 : 0;
    const dmgOrAttackBonus = bonusDamage || actorAttackBonus + allAttackBonus;
    const availableSkills = this.actor.getAvailableSkills();
    const isCharacterActor = this.actor.type === ActorType.CHARACTER;
    const language = game.i18n.lang;
    let selectedSkill = isAttack ? actorAttack?.favorite_skill : '';
    let shouldExplode = !isDamage && !isPower && !isPowerAlbum;
    let selectedAbility = isAttack ? actorAttack?.default_ability : ability;

    const baseRollMode =
      isAttack && isCharacter
        ? this.actor.system[attack].roll_mode
        : isAbility && isCharacter
          ? this.actor.system.abilities[selectedAbility].roll_mode
          : RollMode.NORMAL;
    // Optional condition automation: advantage / disadvantage from the roller's and the target's conditions
    const conditionMode = conditionRollMode(this.actor, {
      attack,
      ability: isAttack ? actorAttack?.default_ability ?? '' : ability,
      target: targetActor,
      isAttack,
      isAbility
    });
    const selectedRollMode = combineRollModes(baseRollMode, conditionMode);

    const actorData = this.actor?.system;
    const damageMultiplier = CONFIG.SDM.getDamageMultiplier(actorData.base_damage_multiplier || 2);

    // Damage boost paid with a resource (from the item)
    const boost = isDamage ? getBoost(item) : null;

    // Power cost: paid with life and/or ability points when casting
    const powerCost =
      (isPower || isPowerAlbum) && paysPowerCost(this.actor)
        ? {
            cost: powerOptions?.[powerIndex]?.cost ?? 0,
            life: Number(this.actor.system.life?.value) || 0,
            abilities: Object.keys(CONFIG.SDM.getOrderedAbilities(game.i18n.lang)).map(key => ({
              key,
              abbr: $l10n(CONFIG.SDM.abilityAbbreviations[key] ?? key),
              label: $l10n(CONFIG.SDM.abilities[key] ?? key),
              current: Number(this.actor.system.abilities?.[key]?.current) || 0
            }))
          }
        : null;
    // The cost box shows the cost: the title keeps only the power's name
    const dialogTitle = powerCost ? `${title}`.replace(/\s*\([^()]*:\s*\d+\)\s*$/, '') : title;

    const template = await renderTemplate(templatePath('custom-roll-dialog'), {
      boost,
      boostLabel: boost ? describeBoost(boost, { item, actor: this.actor }) : '',
      powerCost,
      powerDanger: powerOptions?.[powerIndex]?.dangerHtml ?? '',
      isPowerRoll: isPower || isPowerAlbum,
      rollTitlePrefix,
      rollPreview: true,
      title: dialogTitle,
      abilities: CONFIG.SDM.getOrderedAbilities(language),
      ability: isAttack ? actorAttack?.default_ability : ability,
      attack,
      availableSkills,
      selectedSkill,
      multiplierOptions: damageMultiplier,
      rollModes: CONFIG.SDM.rollMode,
      selectedRollMode: selectedRollMode || RollMode.NORMAL,
      type,
      isCharacterActor,
      attackTargetChoices: CONFIG.SDM.attackTarget,
      powerOptions,
      powerIndex,
      blindGMRoll: isCtrl
    });

    const damageIcon =
      isPower || isPowerAlbum
        ? 'fa-solid fa-wand-magic-sparkles'
        : isDamage
          ? 'one-handed'
          : 'fa-solid fa-dice-d20';
    const buttonLabel =
      isDamage && versatile
        ? $l10n('SDM.OneHanded')
        : isPower || isPowerAlbum
          ? $l10n('SDM.Cast')
          : $l10n('SDM.ButtonRoll');

    const buttons = [
      {
        action: 'one-handed',
        icon: damageIcon,
        label: buttonLabel,
        callback: (event, button) => ({
          versatile: false,
          overcharge: false,
          ...new foundry.applications.ux.FormDataExtended(button.form).object
        })
      }
    ];

    if (versatile) {
      buttons.push({
        action: 'two-handed',
        icon: 'two-handed',
        label: $l10n('SDM.TwoHanded'),
        callback: (event, button) => ({
          versatile,
          overcharge: false,
          ...new foundry.applications.ux.FormDataExtended(button.form).object
        })
      });
    }

    buttons.push({
      action: 'overcharge',
      class: 'overcharge',
      // hidden: !overchargeFormula,
      style: { display: !canOvercharge ? 'none' : '' },
      icon: 'fa-solid fa-hand-sparkles',
      label: $l10n('SDM.PowerOvercharge'),
      callback: (event, button) => ({
        versatile: false,
        overcharge: true,
        ...new foundry.applications.ux.FormDataExtended(button.form).object
      })
    });

    const titleType = capitalizeFirstLetter(toPascalCase(type)).replace(' ', '');

    // What the dialog's values will roll: one plan for the live preview and for the roll itself
    const planRoll = (values = {}, { useBoost = false } = {}) => {
      const {
        selectedAbility: abilityValue,
        modifier = '',
        rollMode = conditionMode ?? RollMode.NORMAL,
        shouldExplode: explodeValue,
        multiplier = '',
        selectedSkill: skillValue,
        attackTarget = AttackTarget.PHYSICAL,
        powerIndex: powerIndexValue
      } = values ?? {};
      const plan = {
        title,
        formula,
        versatileFormula,
        rollMode,
        attackTarget,
        multiplier,
        powerIndex,
        selectedAbility,
        selectedSkill,
        shouldExplode
      };
      if (powerIndexValue !== undefined) {
        plan.powerIndex = parseInt(powerIndexValue, 10);
        plan.selectedAbility = powerOptions[plan.powerIndex].default_ability;
      }
      if (skillValue !== undefined) plan.selectedSkill = skillValue;
      if (explodeValue !== undefined) plan.shouldExplode = explodeValue;
      if (abilityValue !== undefined) plan.selectedAbility = abilityValue;
      if (isPowerAlbum) {
        const power = powerOptions[plan.powerIndex];
        plan.title = power.name;
        plan.selectedAbility = power.default_ability;
        plan.formula = power.formula;
      }
      plan.modPart = foundry.dice.Roll.validate(modifier) ? `+${modifier}` : '';
      // Boost: mandatory ones always (also without the dialog), optional ones when ticked
      plan.boosted = !!(boost && (boost.mandatory || useBoost));
      if (plan.boosted) {
        plan.multiplier = combineMultiplier(multiplier, boost);
        // Extra and damage can read counters and other values (@item.counters.kills.value)
        const boostExtra = resolveFormula(boost.extra, { item, actor: this.actor });
        const boostDamage = resolveFormula(boost.damage, { item, actor: this.actor });
        if (boostExtra && foundry.dice.Roll.validate(boostExtra)) plan.modPart += `+${boostExtra}`;
        // The damage becomes the boost's formula (both hands)
        if (boostDamage && foundry.dice.Roll.validate(boostDamage)) {
          plan.formula = boostDamage;
          if (plan.versatileFormula) plan.versatileFormula = boostDamage;
        }
      }
      return plan;
    };

    const buildRollData = (plan, { versatile: twoHanded = false, overcharge = false } = {}) => {
      const data = {
        type,
        actor: this.actor,
        from: plan.title,
        ability: plan.selectedAbility,
        mode: plan.rollMode,
        modifier: dmgOrAttackBonus ? `${plan.modPart}+${dmgOrAttackBonus}` : plan.modPart,
        multiplier: plan.multiplier,
        explodingDice: plan.shouldExplode,
        versatile: !!twoHanded,
        skill: availableSkills[plan.selectedSkill],
        targetActor,
        attackTarget: plan.attackTarget,
        attack: isAttack ? attack : ''
      };
      if (plan.formula) data.formula = plan.formula;
      if (plan.versatileFormula && twoHanded) data.formula = plan.versatileFormula;
      if (overcharge) data.formula = powerOptions[plan.powerIndex].overchargeFormula;
      return data;
    };

    // Live preview: the formula each button rolls with the dialog's current values
    const rollPreview = values => {
      const plan = planRoll(values, { useBoost: !!values?.useBoost });
      const isPowerRoll = isPower || isPowerAlbum;
      const power = powerOptions?.[plan.powerIndex];
      const rows = [];
      const add = (label, options = {}) => {
        const data = buildRollData(plan, options);
        if (isPowerRoll && !data.formula) return;
        let shown = new SDMRoll(data).buildFormula().formula;
        try {
          shown = new Roll(shown, this.actor.system).formula;
        } catch {
          /* keep the raw formula */
        }
        rows.push(
          `<div class="sdm-roll-preview-row"><span>${foundry.utils.escapeHTML(label)}</span> <code>${foundry.utils.escapeHTML(shown)}</code></div>`
        );
      };
      if (versatile) {
        add($l10n('SDM.OneHanded'));
        add($l10n('SDM.TwoHanded'), { versatile: true });
      } else {
        add($l10n('SDM.RollPreview.Rolls'));
      }
      if (isPowerRoll && (power?.canOvercharge ?? canOvercharge) && power?.overchargeFormula) {
        add($l10n('SDM.PowerOvercharge'), { overcharge: true });
      }
      if (isPowerRoll && !rows.length) rows.push(`<div class="sdm-roll-preview-row">${$l10n('SDM.RollPreview.NoRoll')}</div>`);
      // Optional: the target's zone and whether the weapon or power reaches it (no penalty applied)
      const weaponRange = item?.system?.weapon?.range ?? '';
      if (isAttack || isPowerRoll || (isDamage && weaponRange)) {
        const range = isPowerRoll
          ? power?.range ?? ''
          : weaponRange || (isAttack && isCharacter && attack === 'melee' ? 'close' : '');
        const throwing = !isPowerRoll && !!item?.system?.features?.has?.('throwing');
        rows.unshift(targetRangeHtml(this.actor, { range, throwing, reach: isAttack }));
      }
      return rows.join('');
    };

    let rollOptions = {};

    if (!isShift) {
      // Create and render the modal
      rollOptions = await foundry.applications.api.DialogV2.wait({
        window: {
          title: $fmt('SDM.RollType', { type: $l10n(`SDM.${titleType}`) })
        },
        modal: true,
        powerOptions,
        rollPreview,
        content: template,
        position: {
          width: 400
        },
        buttons
      });
    }

    if (rollOptions === null) {
      return;
    }

    const { heroicQty = '0' } = rollOptions;
    const plan = planRoll(rollOptions, { useBoost: !!rollOptions.useBoost });
    powerIndex = plan.powerIndex;
    selectedAbility = plan.selectedAbility;
    title = plan.title;

    const heroicDice = parseInt(heroicQty || 0, 10);
    const currentHeroDice = this.actor.system.hero_dice?.value ?? 0;

    if (heroicDice > currentHeroDice) {
      ui.notifications.error('Not enough hero dice for this roll');
      return;
    }

    // Weakened (optional condition automation): half the damage dealt, noted on the roll
    if ((isDamage || isPower || isPowerAlbum) && isWeakened(this.actor)) {
      title = `${title} (${game.i18n.localize('SDM.Condition.weakened.Note')})`;
      plan.title = title;
    }

    if (plan.boosted) {
      const paid = await payBoost(this.actor, boost, item);
      if (paid === null) return;
      title = `${title} (${describeBoostPaid(boost, paid)})`;
      plan.title = title;
    }

    // Pay the power's cost (life, and ability points by choice or when life isn't enough)
    let costPaid = null;
    if (powerCost && item && !freeCast && (isShift || rollOptions.payPowerCost)) {
      const castData = isPowerAlbum ? item.system.powers?.[powerIndex] : item.system.power;
      const cost = getPowerCost(this.actor.system, castData, !!rollOptions.overcharge);
      // The form gives flat keys ("costFrom.agi"): expand them
      const fromAbilities = foundry.utils.expandObject(rollOptions ?? {}).costFrom ?? {};
      costPaid = await payPowerCost(this.actor, cost, { fromAbilities });
      if (!costPaid) return;
    }

    const rollData = buildRollData(plan, { versatile: !!rollOptions.versatile });

    if (isPower || isPowerAlbum) {
      rollData.powerDescription = powerOptions[powerIndex].description;
    }

    if (rollOptions.overcharge) {
      rollData.from =
        powerOptions[powerIndex].overcharge + ` (${$l10n('SDM.PowerOvercharge').toLowerCase()})`;
      rollData.formula = powerOptions[powerIndex].overchargeFormula;
      rollData.powerDescription = `${powerOptions[powerIndex].description}<strong>${$l10n('SDM.PowerOvercharge')}</strong><br>${powerOptions[powerIndex].overchargeDescription}`;
      rollData.overcharged = true;
    }

    if ((isPower || isPowerAlbum) && !rollData.formula) {
      rollData.sendPowerToChat = true;
    }

    if (item) {
      rollData.item = item;

      if (isPowerAlbum) {
        const powerItem = item.system.powers[powerIndex];
        const newPowerItem = new SdmItem({
          name: powerItem.name,
          type: 'gear',
          img: powerItem.img,
          system: {
            type: 'power',
            ...powerItem,
            power: {
              ...powerItem
            }
          }
        });
        rollData.item = newPowerItem;
        rollData.triggerItem = item;
        rollData.powerName = powerItem.name;
      }
    }

    rollData.isCtrl = isCtrl;
    const sdmRoll = new SDMRoll(rollData);
    await sdmRoll.evaluate();

    // Powers that create light light the caster's token
    if ((isPower || isPowerAlbum) && item) {
      const cast = isPowerAlbum ? item.system.powers?.[powerIndex] : item.system.power;
      if (cast && powerCreatesLight(cast)) {
        await lightFromPower(this.actor, {
          name: isPowerAlbum ? cast.name : item.name,
          img: isPowerAlbum ? cast.img : item.img,
          light: cast.light
        });
      }
    }

    // Life paid down to 0: defeat roll
    if (costPaid?.defeated) {
      const noop = () => {};
      await this.constructor._onDefeatRoll.call(
        this,
        { preventDefault: noop, stopPropagation: noop, detail: 1, shiftKey: false, ctrlKey: false },
        null
      );
    }

    // Single-use powers leave the album (or the power item goes away) once confirmed
    if (isPowerAlbum && item) await consumeSingleUsePower(item, powerIndex);
    else if (isPower && item) await consumeSingleUsePower(item);
  }

  async _openUpdateAttackModal(attack) {
    const availableSkills = this.actor.getAvailableSkills();
    const capitalizedAttack = capitalizeFirstLetter(attack);
    const skills = Object.values(availableSkills);
    const lang = game.i18n.lang;
    const attackSystemData = this.actor.system[attack];
    const { default_ability: selectedAbility, favorite_skill: selectedSkill } = attackSystemData;

    const template = await renderTemplate(templatePath('actor/character/update-attack'), {
      skills,
      abilities: CONFIG.SDM.getOrderedAbilities(lang),
      attack: $l10n(`SDM.Attack${capitalizedAttack}`),
      selectedAbility,
      selectedSkill
    });

    const updateAttackOptions = await foundry.applications.api.DialogV2.prompt({
      window: {
        title: game.i18n.format('DOCUMENT.Update', {
          type: $l10n(`SDM.Attack${capitalizedAttack}`)
        })
      },
      modal: true,
      content: template,
      ok: {
        icon: 'fa-solid fa-floppy-disk',
        label: game.i18n.format('SDM.ButtonSave'),
        callback: (event, button) =>
          new foundry.applications.ux.FormDataExtended(button.form).object
      }
    });

    if (!updateAttackOptions) return;

    const { default_ability = '', favorite_skill = '' } = updateAttackOptions;

    await this.actor.update({
      [`system.${attack}`]: {
        ...this.actor.system[attack],
        default_ability,
        favorite_skill
      }
    });
  }

  /** @override */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    // Not all parts always render
    options.parts = ['header', 'tabs'];
    // Don't show the other tabs if only limited view
    if (!this.document.limited) {
      // Control which parts show based on document subtype
      switch (this.document.type) {
        case 'character':
          options.parts.push('inventory', 'effects');
          break;
        case 'npc':
          options.parts.push('inventory', 'effects');
          break;
      }
      options.parts.push('notes');
    }

    options.parts.push('biography');
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);

    const buttons = [];

    if (this.actor.type === ActorType.CHARACTER) {
      buttons.push(
        constructHTMLButton({
          label: '',
          classes: ['header-control', 'icon', 'fa-solid', 'fa-gear'],
          dataset: { action: 'toggleMode', tooltip: 'SDM.ToggleModeLabel' }
        }),

        constructHTMLButton({
          label: '',
          classes: ['header-control', 'icon', 'fa-solid', 'fa-compress'],
          dataset: { action: 'toggleCompact', tooltip: 'SDM.CompactMode' }
        })
      );
    }

    buttons.push(
      constructHTMLButton({
        label: '',
        classes: ['header-control', 'icon', 'fa-solid', 'fa-book-open-reader'],
        dataset: { action: 'openCompendiumBrowser', tooltip: 'SDM.CompendiumBrowser.Title' }
      })
    );

    this.window.controls.after(...buttons);

    return frame;
  }

  /** Characters start in compact mode until switched (per client); NPC sheets have no compact mode. */
  get _isCompactMode() {
    if (this.actor.type !== ActorType.CHARACTER) return this.actor.getFlag('sdm', 'compactMode') ?? false;
    return getCompactMode(this.actor, true);
  }

  static async _onToggleCompact(event, target) {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail > 1) return; // Ignore repeated clicks

    // A view preference of this client: anyone who can see the sheet can switch it
    const newMode = !this._isCompactMode;
    setCompactMode(this.actor, newMode);
    this.element.classList.toggle('compact', newMode);
    return this.render();
  }

  /** @override */
  async _prepareContext(options) {
    // Output initialization
    const context = {
      // Validates both permissions and compendium status
      editable: this.isEditable,
      owner: this.document.isOwner,
      limited: this.document.limited,
      // Add the actor document.
      actor: this.actor,
      // Add the actor's data to context.data for easier access, as well as flags.
      system: this.actor.system,
      flags: this.actor.flags,
      statuses: this.actor.statuses,
      // Adding a pointer to CONFIG.SDM
      config: CONFIG.SDM,
      tabs: this._getTabs(options.parts),
      // Necessary for formInput and formFields helpers
      fields: this.document.schema.fields,
      systemFields: this.document.system.schema.fields,
      // Add isGM to the context
      isGM: game.user.isGM,
      // Animated item NPC: its level and XP follow the item
      animatedFrom: getAnimatedSourceItem(this.actor),
      npcTableLabel:
        this.actor.type === ActorType.NPC
          ? game.i18n.localize(
              getNpcTableChoices()[this.actor.system.createdFromTable] ?? 'SDM.generic-synthesized-creature'
            ) +
            (getNpcProfile(this.actor) ? ` · ${describeNpcProfile(getNpcProfile(this.actor))}` : '')
          : ''
    };

    // const language = game.i18n.lang;
    // context.system.abilities = CONFIG.SDM.getOrderedAbilities(language);
    // NPCs count at least the minimum XP for their level (older NPCs were created with 0 XP)
    const xpBase =
      this.actor.type === ActorType.NPC
        ? Math.max(parseInt(this.actor.system.experience, 10) || 0, getXpForLevel(this.actor.system.level))
        : this.actor.system.experience;
    context.xpToNextLevel = getXpToNextLevel(xpBase);
    context.isToken = this.document.isToken;
    // Speed in zones per round (shown on character and NPC sheets)
    context.speed = [ActorType.CHARACTER, ActorType.NPC].includes(this.actor.type) ? speedContext(this.actor) : null;
    // Referee: is the prototype token linked? (not on a token's own sheet, not for caravans)
    context.protoLink = null;
    if (game.user.isGM && !context.isToken && [ActorType.CHARACTER, ActorType.NPC].includes(this.actor.type)) {
      const linked = !!this.actor.prototypeToken?.actorLink;
      context.protoLink = {
        linked,
        // A character whose tokens aren't linked is almost always a mistake
        warn: this.actor.type === ActorType.CHARACTER && !linked,
        tooltip: game.i18n.localize(linked ? 'SDM.ProtoLink.LinkedHint' : 'SDM.ProtoLink.UnlinkedHint')
      };
    }

    if (this.actor.type === 'character') {
      const heroDiceType =
        this.actor.system.hero_dice?.dice_type || game.settings.get('sdm', 'defaultHeroDiceType');

      context.heroDiceType = heroDiceType;
      context.isEditMode = this.actor.getFlag('sdm', 'editMode') ?? false;
    }

    context.isCompactMode = this._isCompactMode;
    // Offloading context prep to a helper function
    this._prepareItems(context);

    return context;
  }

  /** @override */
  async _preparePartContext(partId, context) {
    switch (partId) {
      case 'inventory':
        context.tab = context.tabs[partId];
        break;
      case 'pet':
        context.tab = context.tabs[partId];
        break;
      case 'notes':
        context.tab = context.tabs[partId];
        // Enrich notes info for display
        // Enrichment turns text like `[[/r 1d20]]` into buttons
        context.enrichedNotes = await TextEditor.enrichHTML(this.actor.system.notes, {
          // Whether to show secret blocks in the finished html
          secrets: this.document.isOwner,
          // Data to fill in for inline rolls
          rollData: this.actor.getRollData(),
          // Relative UUID resolution
          relativeTo: this.actor
        });
        break;
      case 'biography':
        context.tab = context.tabs[partId];
        // Enrich biography info for display
        // Enrichment turns text like `[[/r 1d20]]` into buttons
        context.enrichedBiography = await TextEditor.enrichHTML(this.actor.system.biography, {
          // Whether to show secret blocks in the finished html
          secrets: this.document.isOwner,
          // Data to fill in for inline rolls
          rollData: this.actor.getRollData(),
          // Relative UUID resolution
          relativeTo: this.actor
        });
        break;
      case 'effects':
        context.tab = context.tabs[partId];
        // The actor's own counters (managed at the top of the Effects tab)
        context.counters = getCounters(this.actor);
        context.counterScope = '@actor';
        // Prepare active effects
        context.effects = prepareActiveEffectCategories(
          // A generator that returns all effects stored on the actor
          // as well as any items
          this.actor.allApplicableEffects()
        );
        break;
    }

    return context;
  }

  /**
   * Generates the data for the generic tab navigation template
   * @param {string[]} parts An array of named template parts to render
   * @returns {Record<string, Partial<ApplicationTab>>}
   * @protected
   */
  _getTabs(parts) {
    // If you have sub-tabs this is necessary to change
    const tabGroup = 'primary';
    // Default tab for first time it's rendered this session
    if (!this.tabGroups[tabGroup]) this.tabGroups[tabGroup] = 'inventory';
    return parts.reduce((tabs, partId) => {
      const tab = {
        cssClass: '',
        group: tabGroup,
        // Matches tab property to
        id: '',
        // FontAwesome Icon, if you so choose
        icon: '',
        // Run through localization
        label: 'SDM.Tab'
      };
      switch (partId) {
        case 'header':
        case 'tabs':
          return tabs;
        case 'inventory':
          tab.id = 'inventory';
          tab.label += 'Inventory';
          tab.icon = 'fa fa-toolbox';
          break;
        case 'pet':
          tab.id = 'pet';
          tab.label += 'Pet';
          tab.icon = 'fa fa-otter';
          break;
        case 'effects':
          tab.id = 'effects';
          tab.label += 'Effects';
          tab.icon = 'fa fa-bolt';
          break;
        case 'notes':
          tab.id = 'notes';
          tab.label += 'Notes';
          tab.icon = 'fa fa-book';
          break;
        case 'biography':
          tab.id = 'biography';
          tab.label += 'Biography';
          tab.icon = 'fa fa-user';
          break;
      }
      if (this.tabGroups[tabGroup] === tab.id) tab.cssClass = 'active';
      tabs[partId] = tab;
      return tabs;
    }, {});
  }

  /**
   * Organize and classify Items for Actor sheets.
   *
   * @param {object} context The context object to mutate
   */
  _prepareItems(context) {
    // Initialize containers.
    // You can just use `this.document.itemTypes` instead
    // if you don't need to subdivide a given type like
    // this sheet does with spells

    const transport = [];
    const isCaravan = this.actor.type === ActorType.CARAVAN;
    const isCharacter = this.actor.type === ActorType.CHARACTER;
    const isNPC = this.actor.type === ActorType.NPC;

    // Iterate through items, allocating to containers
    for (let i of this.document.items) {
      if (ITEMS_NOT_ALLOWED_IN_CHARACTERS.includes(i.type) && isCaravan) {
        transport.push(i);
      }
    }

    const inventory = this.actor.checkInventorySlots();
    const { items, traits, burdens, burdenPenalty } = inventory;

    // Sort then assign
    context.items = items.slots.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.itemSlotsTaken = items.slotsTaken;
    context.packedSlotsTaken = items.packedTaken;

    context.traits = traits.slots.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.traitSlotsTaken = traits.slotsTaken;

    context.burdens = burdens.slots.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.burdenSlotsTaken = burdenPenalty;

    if (isCaravan) {
      context.transport = transport;
    }
  }

  _reapplyStripes() {
    const root = this.element.querySelector('.items-list.collapsible-items');
    if (!root) return;

    const items = Array.from(root.querySelectorAll('li.item'));
    let visibleIndex = 0;

    items.forEach(li => {
      li.classList.remove('stripe-even', 'stripe-odd');
      if (li.offsetParent !== null) {
        li.classList.add(visibleIndex % 2 === 0 ? 'stripe-odd' : 'stripe-even');
        visibleIndex++;
      }
    });
  }

  _handleContainers() {
    const actor = this.actor;
    const root = this.element;

    const rows = Array.from(root.querySelectorAll('li.item'));

    for (const li of rows) {
      const item = actor.items.get(li.dataset.itemId);
      if (!item) continue;

      const parentId = item.system.container?.trim();
      if (!parentId) continue;

      const parentRow = root.querySelector(`li.item[data-item-id="${parentId}"]`);
      if (!parentRow) continue;

      parentRow.insertAdjacentElement('afterend', li);
      li.classList.add('item-child');
    }

    for (const li of rows) {
      const item = actor.items.get(li.dataset.itemId);
      if (!item) continue;

      const parentId = item.system.container?.trim();
      if (!parentId) continue;

      const parent = fromUuidSync(parentId);
      const collapsed = parent?.getFlag('sdm', 'isCollapsed');

      li.style.display = collapsed ? 'none' : '';
    }

    for (const li of rows) {
      const item = actor.items.get(li.dataset.itemId);
      if (!item || item.system.type !== 'container') continue;

      const collapsed = item.getFlag('sdm', 'isCollapsed');
      const nameDiv = li.querySelector('.item-name');

      if (!nameDiv.querySelector('.container-indicator')) {
        const icon = document.createElement('i');
        icon.classList.add(
          'fas',
          collapsed ? 'fa-angle-right' : 'fa-angle-down',
          'container-indicator'
        );
        icon.style.marginLeft = '5px;';
        icon.style.padding = '8px';

        li.addEventListener('click', async ev => {
          ev.preventDefault();
          if (ev.detail > 1) return;

          await item.setFlag('sdm', 'isCollapsed', !collapsed);
          this.render();
        });

        const nameRow = nameDiv.querySelector('.flexrow');
        nameRow.append(icon);
      }
    }

    this._reapplyStripes();
  }

  /**
   * Actions performed after any render of the Application.
   * Post-render steps are not awaited by the render process.
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @protected
   * @override
   */

  /**
   * Numeric inputs show thousands separators; switch them back to plain
   * numbers while the form is read and submitted.
   * @override
   */
  async _onSubmitForm(formConfig, event) {
    unformatNumberInputs(this.element);
    try {
      return await super._onSubmitForm(formConfig, event);
    } finally {
      reformatNumberInputs(this.element);
    }
  }

  _onRender(context, options) {
    bindNumberInputs(this.element, this.document);
    this.#dragDrop.forEach(d => d.bind(this.element));
    // Counter chips: right-click is −1 here, and never opens the row's context menu
    this.element.querySelectorAll('.sdm-counter-chip').forEach(chip =>
      chip.addEventListener('contextmenu', async event => {
        event.preventDefault();
        event.stopPropagation();
        if (!this.isEditable || !chip.dataset.action) return;
        const doc = chip.dataset.action === 'stepActorCounter' ? this.actor : this._getEmbeddedDocument(chip);
        if (doc) await stepCounter(doc, chip.dataset.key, -1);
      })
    );
    this.#disableOverrides();
    bindCollapsibleSections(this);
    // You may want to add other special handling here
    // Foundry comes with a large number of utility classes, e.g. SearchFilter
    // That you may want to implement yourself.

    const isCompact = this._isCompactMode;
    this.element.classList.toggle('compact', isCompact);

    this._handleContainers();
  }

  /**
   * Actions performed after a first render of the Application.
   * @param {ApplicationRenderContext} context      Prepared context data.
   * @param {RenderOptions} options                 Provided render options.
   * @protected
   */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);

    this._createContextMenu(
      this._getItemListContextOptions,
      '[data-document-class][data-item-id]',
      {
        hookName: 'getItemListContextOptions',
        parentClassHooks: false,
        fixed: true
      }
    );
  }

  _getItemListContextOptions() {
    return this.actor._getItemListContextOptions();
  }

  _checkActorWeightLimit(additionalSlots = 0, itemType) {
    if (this.actor.type === ActorType.NPC) {
      return true;
    }
    const itemSlotsTaken = this.actor.system.item_slots_taken;
    const actorItemSlots = this.actor.system.item_slots;
    const traitSlotsTaken = this.actor.system.trait_slots_taken;
    const actorTraitSlots = this.actor.system.trait_slots;

    if (itemType === ItemType.GEAR) {
      if (itemSlotsTaken + additionalSlots <= actorItemSlots) return true;
    } else if (itemType === ItemType.TRAIT) {
      if (traitSlotsTaken + additionalSlots <= actorTraitSlots) return true;
    }

    const actorBurdenPenalty = this.actor.system.burden_penalty || 0;
    const newBurdenPenalTy = additionalSlots + actorBurdenPenalty;
    const maxBurdenSlots = this.actor.system.burden_slots;

    return newBurdenPenalTy <= maxBurdenSlots;
  }

  async unpackStartingKitItem(target) {
    const item = this._getEmbeddedDocument(target);
    await SdmActorSheet._createAndViewDoc.call(this, null, {
      dataset: {
        documentClass: 'Item',
        type: 'gear'
      }
    });

    if (item.system?.starting_kit && item.system?.packed_remaining_items === 1) {
      await item.delete();
      return;
    }

    await item.update({ 'system.packed_remaining_items': item.system.packed_remaining_items - 1 });
  }

  _checkCarriedWeight(item, updateData) {
    if (this.actor.type === ActorType.NPC) {
      return true;
    }

    let itemSlots = getSlotsTaken(item?.system);

    if (updateData && !updateData.system) return true;

    let updateDataSlots = updateData ? getSlotsTaken(updateData?.system) : null;

    if (updateData?.system?.is_hallmark && !this.actor?.canAddHallmarkItem()) {
      ui.notifications.error($fmt('SDM.ErrorHallmarkLimit', { target: this.actor.name }));
      return false;
    }

    if (updateData && updateDataSlots <= itemSlots) {
      return true;
    }

    const slotsTaken = updateData ? updateDataSlots - itemSlots : itemSlots;
    const validWeight = this._checkActorWeightLimit(slotsTaken, item.type);

    if (!validWeight) {
      ui.notifications.error($fmt('SDM.ErrorWeightLimit', { target: this.actor.name }));
      return false;
    }
    return true;
  }

  // Helper validation method
  _validateItemWeight(item) {
    if (this.actor.type === ActorType.NPC) {
      return true;
    }

    if (
      this.actor.type === ActorType.CHARACTER &&
      item.system.is_hallmark &&
      !this.actor.canAddHallmarkItem()
    ) {
      ui.notifications.error($fmt('SDM.ErrorHallmarkLimit', { target: this.actor.name }));
      return false;
    }

    const itemSlots = getSlotsTaken(item.system);
    const validWeight = this._checkActorWeightLimit(itemSlots, item.type);

    if (!validWeight) {
      ui.notifications.error($fmt('SDM.ErrorWeightLimit', { target: this.actor.name }));
      return false;
    }

    return true;
  }

  /**************
   *
   *   ACTIONS
   *
   **************/

  /**
   * Handle changing a Document's image.
   *
   * @this SdmActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise}
   * @protected
   */
  static async _onEditImage(event, target) {
    const attr = target.dataset.edit;
    const current = foundry.utils.getProperty(this.document, attr);
    const { img } = this.document.constructor.getDefaultArtwork?.(this.document.toObject()) ?? {};
    const fp = new FilePicker({
      current,
      type: 'image',
      redirectToRoot: img ? [img] : [],
      callback: path => {
        this.document.update({ [attr]: path });
      },
      top: this.position.top + 40,
      left: this.position.left + 10
    });
    return fp.browse();
  }

  /**
   * Renders an embedded document's sheet
   *
   * @this SdmActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _viewDoc(event, target) {
    const doc = this._getEmbeddedDocument(target);
    doc.sheet.render(true);
  }

  /**
   * Handles item deletion
   *
   * @this SdmActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _deleteDoc(event, target) {
    const doc = this._getEmbeddedDocument(target);
    const proceed = await DialogV2.confirm({
      content: `<b>${$fmt('SDM.DeleteDocConfirmation', { doc: doc.name })}</b>`,
      modal: true,
      rejectClose: false,
      yes: { label: $l10n('SDM.ButtonYes') },
      no: { label: $l10n('SDM.ButtonNo') }
    });
    if (proceed) await doc.delete();
  }

  /**
   * Handles creating a new Owned Item and already open it for Editing
   *
   * @this SdmActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _createAndViewDoc(event, target) {
    const newDoc = await SdmActorSheet._createDoc.call(this, event, target);
    newDoc.sheet.render(true);
  }

  /**
   * Handle creating a new Owned Item or ActiveEffect for the actor using initial data defined
   * in the HTML dataset
   *
   * @this SdmActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _createDoc(event, target) {
    const docCls = getDocumentClass(target.dataset.documentClass);
    const docData = {
      name: docCls.defaultName({
        type: target.dataset.type,
        parent: this.actor
      })
    };

    // Apply dataset properties
    for (const [dataKey, value] of Object.entries(target.dataset)) {
      if (['action', 'documentClass'].includes(dataKey)) continue;
      foundry.utils.setProperty(docData, dataKey, value);
    }

    // Determine sort to place at bottom
    const collection = docCls.documentName === 'Item' ? this.actor.items : this.actor.effects;
    const maxSort = collection.reduce((max, doc) => Math.max(max, doc.sort || 0), 0);
    docData.sort = maxSort + 100; // or any increment

    return await docCls.create(docData, { parent: this.actor });
  }

  /**
   * Determines effect parent to pass to helper
   *
   * @this SdmActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _toggleEffect(event, target) {
    const effect = this._getEmbeddedDocument(target);
    await effect.update({ disabled: !effect.disabled });
  }

  /**
   * Determines effect parent to pass to helper
   *
   * @this SdmActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _toggleReadied(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    const item = this._getEmbeddedDocument(target);

    await item.toggleReadied();
  }

  static async _onTransferItem(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    if (event.detail > 1) return; // Ignore repeated clicks
    const item = this._getEmbeddedDocument(target);
    return openItemTransferDialog(item, this.actor);
  }

  static async _onToggleMode(event, target) {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail > 1) return; // Ignore repeated clicks

    if (!this.actor.isOwner) return;

    const currentMode = this.actor.getFlag('sdm', 'editMode') ?? false;
    const newMode = !currentMode;

    await this.actor.setFlag('sdm', 'editMode', newMode);
    return this.render();
  }

  static async _onOpenCompendiumBrowser(event, target) {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail > 1) return; // Ignore repeated clicks

    return CompendiumBrowser.open();
  }

  static async _onRerollCharacter(event, target) {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail > 1) return; // Ignore repeated clicks

    await game.sdm.api.gm.characterGeneratorDialog(this.actor);
  }

  /**
   * Handle clickable rolls.
   *
   * @this SdmActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onRoll(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    if (event.detail > 1) return; // Ignore repeated clicks

    const reverseShift = game.settings.get('sdm', 'reverseShiftKey');
    const isShift = reverseShift !== !!event.shiftKey;
    const isCtrl = !!event.ctrlKey;

    // Get common data attributes
    const dataset = target.dataset;
    let ability = dataset.ability;
    let label = dataset.label;
    const attack = dataset.attack;
    const type = dataset.type;
    let formula = dataset.roll || '';
    let versatile = false;
    let versatileFormula = '';
    let overchargeFormula = '';
    let bonusDamage = '';
    let powerOptions;
    let powerIndex;
    let canOvercharge = false;
    let rollItem = null;

    //Handle item rolls.
    switch (type) {
      case 'damage':
        const item = this._getEmbeddedDocument(target);
        rollItem = item;
        const weaponDamage = item.system.weapon.damage;
        ability = item.system.default_ability;
        formula = weaponDamage.base;
        bonusDamage = weaponDamage.bonus;
        versatile =
          item.system?.weapon?.versatile || item.system?.features?.has('versatile') || false;

        if (versatile) {
          versatileFormula = weaponDamage.versatile;
        }

        break;
      case 'power':
        const powerItem = this._getEmbeddedDocument(target);
        rollItem = powerItem;
        const powerData = powerItem.system.power;
        label = powerItem.getPowerShortTitle(
          powerData,
          this.actor.system.power_cost,
          this.actor.system.power_cost_bonus
        );
        ability = powerData.default_ability;
        formula = powerData.roll_formula;
        overchargeFormula = powerData.overcharge_roll_formula;

        powerOptions = [
          {
            index: 0,
            name: powerItem.getPowerShortTitle(
              powerData,
              this.actor.system.power_cost,
              this.actor.system.power_cost_bonus
            ),
            overcharge: powerItem.getPowerShortTitle(
              powerData,
              this.actor.system.power_cost,
              this.actor.system.power_cost_bonus,
              true
            ),
            formula: powerData.roll_formula,
            overchargeFormula: powerData.overcharge_roll_formula,
            canOvercharge: !!powerData.overcharge,
            cost: getPowerCost(this.actor.system, powerData),
            dangerHtml: getPowerDangerHtml(this.actor.system, powerData, { canOvercharge: !!powerData.overcharge }),
            default_ability: powerData.default_ability,
            range: powerData.range,
            description: powerItem.system.description,
            overchargeDescription: powerData.overcharge
          }
        ];
        powerIndex = 0;
        canOvercharge = !!powerData.overcharge;
        break;

      case 'power_album':
        const powerAlbum = this._getEmbeddedDocument(target);
        const { powers = [], powers_current_index } = powerAlbum.system;
        // An empty album has nothing to cast
        if (!powers.length) {
          ui.notifications.warn($l10n('SDM.NoPowers'));
          return;
        }
        rollItem = powerAlbum;
        powerIndex = powers[powers_current_index] ? powers_current_index : 0;
        // A trigger can name the power to cast (blank: the selected one)
        if (dataset.powerName) {
          const wanted = `${dataset.powerName}`.trim().toLowerCase();
          const found = powers.findIndex(power => `${power.name ?? ''}`.trim().toLowerCase() === wanted);
          if (found >= 0) powerIndex = found;
        }
        const selectedPower = powers[powerIndex];

        powerOptions = powers.map((power, index) => {
          return {
            index,
            name: powerAlbum.getPowerShortTitle(
              power,
              this.actor.system.power_cost,
              this.actor.system.power_cost_bonus
            ),
            overcharge: powerAlbum.getPowerShortTitle(
              power,
              this.actor.system.power_cost,
              this.actor.system.power_cost_bonus,
              true
            ),
            formula: power.roll_formula,
            overchargeFormula: power.overcharge_roll_formula,
            canOvercharge: !!power.overcharge,
            cost: getPowerCost(this.actor.system, power),
            dangerHtml: getPowerDangerHtml(this.actor.system, power, { canOvercharge: !!power.overcharge }),
            default_ability: power.default_ability,
            range: power.range,
            description: power.description,
            overchargeDescription: power.overcharge
          };
        });
        ability = selectedPower.default_ability;
        formula = selectedPower.roll_formula;
        overchargeFormula = selectedPower.overcharge_roll_formula;
        canOvercharge = !!selectedPower.overcharge;

        break;
    }

    const rollAttributes = {
      type,
      from: label,
      formula,
      ability,
      attack,
      versatile,
      versatileFormula,
      overchargeFormula,
      canOvercharge,
      bonusDamage,
      powerOptions,
      powerIndex,
      item: rollItem,
      // Free cast (a trigger's "free"): no dialog and no cost
      freeCast: dataset.freeCast === 'true'
    };

    this._openCustomRollModal(rollAttributes, isShift || rollAttributes.freeCast, isCtrl);
  }

  static async _onRollNPCDamage(event, target) {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail > 1) return;

    const reverseShift = game.settings.get('sdm', 'reverseShiftKey');
    const isShift = reverseShift !== !!event.shiftKey;
    const isCtrl = !!event.ctrlKey;

    const damage = this.actor.system.damage || '1d4';

    const rollAttributes = {
      type: RollType.DAMAGE,
      from: this.actor.name,
      formula: damage
    };

    this._openCustomRollModal(rollAttributes, isShift, isCtrl);
  }

  static async _onRollNPCMorale(event, target) {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail > 1) return;

    const reverseShift = game.settings.get('sdm', 'reverseShiftKey');
    const isShift = reverseShift !== !!event.shiftKey;
    const isCtrl = !!event.ctrlKey;

    let data = { modifier: '' };

    // The formula rolled for the dialog values (also shown live in the dialog)
    const formulaFor = values => {
      const burdenPenalty = this.actor.system.burden_penalty || 0;
      const burdenPart = burdenPenalty > 0 ? -1 * burdenPenalty : 0;
      const totalBonuses = burdenPart;
      const bonusPart =
        totalBonuses === 0 ? '' : totalBonuses > 0 ? `+${totalBonuses}` : totalBonuses;

      const { modifier = '', rollMode = 'normal' } = values ?? {};
      const modPart = foundry.dice.Roll.validate(modifier) ? `+${modifier}` : '';
      const basMoraleFormula = game.settings.get('sdm', 'baseMoraleFormula') || '2d6';

      const keepModifier =
        rollMode === RollMode.ADVANTAGE ? 'kh' : rollMode === RollMode.DISADVANTAGE ? 'kl' : '';

      const diceExpression = keepModifier
        ? `{${basMoraleFormula}, ${basMoraleFormula}}${keepModifier}`
        : basMoraleFormula;

      const formula = `${diceExpression}${bonusPart}${modPart}`;
      return sanitizeExpression(formula);
    };

    if (!isShift) {
      data = await DialogV2.wait({
        window: {
          title: $fmt('SDM.RollType', { type: $l10n('SDM.Morale') }),
          resizable: true
        },
        modal: true,
        content: await renderTemplate(templatePath('actor/npc/morale-roll-dialog'), {
          rollModes: CONFIG.SDM.rollMode,
          blindGMRoll: isCtrl
        }),
        buttons: [
          {
            label: $l10n('SDM.ButtonRoll'),
            icon: 'fa-solid fa-person-running',
            callback: (event, button) => ({
              ...new foundry.applications.ux.FormDataExtended(button.form).object
            })
          }
        ],
        rollPreview: values => rollPreviewRows([{ label: $l10n('SDM.RollPreview.Rolls'), formula: formulaFor(values) }]),
        rejectClose: false
      });
    }

    if (!data) {
      return;
    }

    const sanitizedFormula = formulaFor(data);
    const targetNumber = this.actor.system.morale || 2;

    // Create and evaluate the roll
    let roll = new Roll(sanitizedFormula);
    roll = await roll.evaluate();

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });

    await renderNPCMoraleResult({ roll, targetNumber }, { fromHeroDice: false, speaker, isCtrl });
  }

  static async _onCorruptionRoll(event, target) {
    event.preventDefault();
    event.stopPropagation();

    if (event.detail > 1) return;
    const reverseShift = game.settings.get('sdm', 'reverseShiftKey');
    const isShift = reverseShift !== !!event.shiftKey;
    const isCtrl = !!event.ctrlKey;
    let data = { modifier: '', selectedAbility: '' };
    const selectedRollMode = this.actor.system.corruption.roll_mode || RollMode.NORMAL;

    // The formula rolled for the dialog values (also shown live in the dialog)
    const formulaFor = values => {
      const { modifier = '', rollMode = RollMode.NORMAL } = values ?? {};

      const baseFormula = game.settings.get('sdm', 'baseCorruptionFormula') || '2d6';
      const corruptionBonus = this.actor.system.corruption.roll_bonus || 0;
      const burdenPenalty = this.actor.system.burden_penalty || 0;
      const abilityMod =
        this.actor.type === ActorType.CHARACTER
          ? this.actor.system.abilities['aur'].current
          : this.actor.system?.bonus || 0;
      const burdenPart = burdenPenalty > 0 ? -1 * burdenPenalty : 0;
      const totalBonuses = abilityMod + burdenPart + corruptionBonus;
      const bonusPart =
        totalBonuses === 0 ? '' : totalBonuses > 0 ? `+${totalBonuses}` : totalBonuses;
      const modPart = foundry.dice.Roll.validate(modifier) ? ` +${modifier}` : '';

      const keepModifier =
        rollMode === RollMode.ADVANTAGE ? 'kh' : rollMode === RollMode.DISADVANTAGE ? 'kl' : '';

      const diceExpression = keepModifier
        ? `{${baseFormula}, ${baseFormula}}${keepModifier}`
        : baseFormula;

      const formula = `${diceExpression}${bonusPart}${modPart}`;
      return sanitizeExpression(formula);
    };

    if (!isShift) {
      data = await DialogV2.wait({
        window: {
          title: $fmt('SDM.RollType', { type: $l10n('SDM.Corruption') })
        },
        modal: true,
        position: {
          width: 500
        },
        content: await renderTemplate(templatePath('corruption-roll-dialog'), {
          rollModes: CONFIG.SDM.rollMode,
          selectedRollMode,
          blindGMRoll: isCtrl
        }),
        buttons: [
          {
            label: $l10n('SDM.Corruption'),
            icon: 'fa-solid fa-biohazard',
            callback: (event, button) => ({
              ...new foundry.applications.ux.FormDataExtended(button.form).object
            })
          }
        ],
        rollPreview: values => rollPreviewRows([{ label: $l10n('SDM.RollPreview.Rolls'), formula: formulaFor(values) }]),
        rejectClose: false
      });
    }

    if (!data) {
      return;
    }

    const sanitizedFormula = formulaFor(data);

    let roll = new Roll(sanitizedFormula);
    roll = await roll.evaluate();

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });

    await renderCorruptionResult({ roll }, { fromHeroDice: false, speaker, isCtrl });
  }

  static async _onReactionRoll(event, target) {
    event.preventDefault();
    event.stopPropagation();

    if (event.detail > 1) return;

    const reverseShift = game.settings.get('sdm', 'reverseShiftKey');
    const isShift = reverseShift !== !!event.shiftKey;
    const isCtrl = !!event.ctrlKey;
    let data = { modifier: '', charismaOperator: 1, customBaseFormula: '' };
    const selectedRollMode = this.actor.system.abilities['cha'].roll_mode || RollMode.NORMAL;

    // The formula rolled for the dialog values (also shown live in the dialog)
    const formulaFor = values => {
      const {
        modifier = '',
        charismaOperator = 1,
        rollMode = RollMode.NORMAL,
        customBaseFormula = ''
      } = values ?? {};

      const baseFormula = game.settings.get('sdm', 'baseReactionFormula') || '2d6';

      const finalBaseFormula = foundry.dice.Roll.validate(customBaseFormula)
        ? customBaseFormula
        : baseFormula;

      const reactionBonus = this.actor.system.reaction_bonus || 0;
      const burdenPenalty = this.actor.system.burden_penalty || 0;
      const chaMod = this.actor.system.abilities['cha'].current;
      const burdenPart = burdenPenalty > 0 ? -1 * burdenPenalty : 0;
      const chaPart = charismaOperator > 0 ? chaMod : -1 * chaMod;
      const totalBonuses = chaPart + reactionBonus + burdenPart;
      const bonusPart =
        totalBonuses === 0 ? '' : totalBonuses > 0 ? `+${totalBonuses}` : totalBonuses;
      const modPart = foundry.dice.Roll.validate(modifier) ? ` +${modifier}` : '';

      const keepModifier =
        rollMode === RollMode.ADVANTAGE ? 'kh' : rollMode === RollMode.DISADVANTAGE ? 'kl' : '';

      const diceExpression = keepModifier
        ? `{${finalBaseFormula}, ${finalBaseFormula}}${keepModifier}`
        : finalBaseFormula;

      const formula = `${diceExpression}${bonusPart}${modPart}`;
      return sanitizeExpression(formula);
    };

    if (!isShift) {
      data = await DialogV2.wait({
        window: {
          title: $fmt('SDM.RollType', { type: $l10n('SDM.Reaction') })
        },
        modal: true,
        position: {
          width: 500
        },
        content: await renderTemplate(templatePath('reaction-roll-dialog'), {
          rollModes: CONFIG.SDM.rollMode,
          selectedRollMode,
          blindGMRoll: isCtrl
        }),
        buttons: [
          {
            action: 'diplomacy',
            label: $l10n('SDM.ReactionCheck'),
            icon: 'fa-solid fa-face-smile',
            callback: (event, button) => ({
              charismaOperator: 1,
              ...new foundry.applications.ux.FormDataExtended(button.form).object
            })
          },
          {
            action: 'conflict',
            label: $l10n('SDM.ReactionProvokeConflict'),
            icon: 'fa-solid fa-face-angry',
            callback: (event, button) => ({
              charismaOperator: -1,
              ...new foundry.applications.ux.FormDataExtended(button.form).object
            })
          }
        ],
        rollPreview: values => rollPreviewRows([
          { label: $l10n('SDM.ReactionCheck'), formula: formulaFor({ ...values, charismaOperator: 1 }) },
          { label: $l10n('SDM.ReactionProvokeConflict'), formula: formulaFor({ ...values, charismaOperator: -1 }) }
        ]),
        rejectClose: false
      });
    }

    if (!data) {
      return;
    }

    const { charismaOperator = 1 } = data;
    const sanitizedFormula = formulaFor(data);

    let roll = new Roll(sanitizedFormula);
    roll = await roll.evaluate();

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });

    await renderReactionResult(
      { roll, charismaOperator },
      { fromHeroDice: false, speaker, isCtrl }
    );
  }

  static async _onRelifeRoll(event, target) {
    event.preventDefault();
    event.stopPropagation();

    if (event.detail > 1) return;

    const reverseShift = game.settings.get('sdm', 'reverseShiftKey');
    const isShift = reverseShift !== !!event.shiftKey;
    const isCtrl = !!event.ctrlKey;

    // Get selected roll mode from actor (default to normal)
    const selectedRollMode = this.actor.system.relife?.roll_mode || RollMode.NORMAL;

    // Define relife types and their corresponding abilities
    const relifeTypes = [
      { id: 'body', label: 'SDM.RelifeTypeBody', ability: 'end' },
      { id: 'head', label: 'SDM.RelifeTypeHead', ability: 'tho' },
      { id: 'jewel', label: 'SDM.RelifeTypeJewel', ability: 'aur' },
      { id: 'shattered', label: 'SDM.RelifeTypeShattered', ability: 'cha' }
    ];

    const relifeCosts = {
      body: await TextEditor.enrichHTML($l10n('SDM.RelifeTypeBodyCost')),
      head: await TextEditor.enrichHTML($l10n('SDM.RelifeTypeHeadCost')),
      jewel: await TextEditor.enrichHTML($l10n('SDM.RelifeTypeJewelCost')),
      shattered: await TextEditor.enrichHTML($l10n('SDM.RelifeTypeShatteredCost'))
    };

    let data = {};
    // The formula rolled for the dialog values (also shown live in the dialog)
    const formulaFor = values => {
      const { modifier = '', relifeType = 'body', rollMode = RollMode.NORMAL } = values ?? {};
      const ability = relifeTypes.find(t => t.id === relifeType).ability;

      // Base formula (default 1d20, can be overridden by setting)
      const baseFormula = game.settings.get('sdm', 'baseRelifeFormula') || '1d20';

      // Compute ability modifier
      const abilityMod = this.actor.system.abilities[ability]?.current || 0;

      // Relife bonus (actor field)
      const relifeBonus = this.actor.system.relife_bonus || 0;

      // Burden penalty (negative)
      const burdenPenalty = this.actor.system.burden_penalty || 0;

      // Sum before hard limit
      let totalBonus = abilityMod + relifeBonus - burdenPenalty;

      // Apply hard limit if enabled
      const useHardLimit = game.settings.get('sdm', 'useHardLimitRule');
      const hardLimit = game.settings.get('sdm', 'defaultHardLimitValue') || MAX_MODIFIER;
      if (useHardLimit) {
        totalBonus = Math.min(totalBonus, hardLimit);
      }

      const bonusPart = totalBonus === 0 ? '' : totalBonus > 0 ? `+${totalBonus}` : `${totalBonus}`;
      const modPart = foundry.dice.Roll.validate(modifier) ? ` +${modifier}` : '';

      // Apply advantage/disadvantage
      const keepModifier =
        rollMode === RollMode.ADVANTAGE ? 'kh' : rollMode === RollMode.DISADVANTAGE ? 'kl' : '';

      const diceExpression = keepModifier
        ? `{${baseFormula}, ${baseFormula}}${keepModifier}`
        : baseFormula;

      const formula = `${diceExpression}${bonusPart}${modPart}`;
      return sanitizeExpression(formula);
    };

    if (!isShift) {
      data = await DialogV2.wait({
        window: {
          title: $fmt('SDM.RollType', { type: $l10n('SDM.Relife') })
        },
        modal: true,
        position: {
          width: 500
        },
        content: await renderTemplate(templatePath('relife-roll-dialog'), {
          rollModes: CONFIG.SDM.rollMode,
          selectedRollMode,
          selectedRelifeType: 'body',
          relifeTypes,
          relifeCosts,
          blindGMRoll: isCtrl
        }),
        buttons: [
          {
            label: $l10n('SDM.Relife'),
            icon: 'fa-solid fa-hand-holding-heart',
            callback: (event, button) => ({
              ...new foundry.applications.ux.FormDataExtended(button.form).object
            })
          }
        ],
        rollPreview: values => rollPreviewRows([{ label: $l10n('SDM.RollPreview.Rolls'), formula: formulaFor(values) }]),
        rejectClose: false,
        render: (event, dialog) => {
          const html = dialog.element;
          const select = html.querySelector('#relifeType');
          const cost = html.querySelector('#relifeCost');

          if (select && cost) {
            select.addEventListener('change', ev => {
              const val = ev.target.value;
              cost.innerHTML = relifeCosts[val] ?? '';
            });
          }
        }
      });
    }

    if (!data) return;

    const { relifeType = 'body' } = data;
    const ability = relifeTypes.find(t => t.id === relifeType).ability;
    const sanitizedFormula = formulaFor(data);

    let roll = new Roll(sanitizedFormula);
    roll = await roll.evaluate();

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const label = `[${$l10n('SDM.Relife')}] ${$l10n(`SDM.RelifeType${toPascalCase(relifeType)}`)}`;
    await renderRelifeResult(
      { roll, label, cost: relifeCosts[relifeType], ability },
      { fromHeroDice: false, speaker, isCtrl }
    );

    const defeatedId = CONFIG.specialStatusEffects.DEFEATED;
    await this.actor?.toggleStatusEffect(defeatedId, {
      active: false
    });
  }

  static async _onGroupChaseRoll(event, target) {
    event.preventDefault();
    event.stopPropagation();

    if (event.detail > 1) return;

    const reverseShift = game.settings.get('sdm', 'reverseShiftKey');
    const isShift = reverseShift !== !!event.shiftKey;
    const isCtrl = !!event.ctrlKey;
    let data = { modifier: '' };
    const selectedRollMode = this.actor.system.abilities['end'].roll_mode || RollMode.NORMAL;
    const availableSkills = this.actor.getAvailableSkills();
    const label = $fmt('SDM.RollType', { type: $l10n('SDM.GroupChase') });
    // The formula rolled for the dialog values (also shown live in the dialog)
    const formulaFor = values => {
      const { modifier = '', selectedSkill = '', rollMode = RollMode.NORMAL } = values ?? {};

      const skillPart = selectedSkill ? availableSkills[selectedSkill]?.mod : 0;
      const baseFormula = game.settings.get('sdm', 'baseGroupChaseFormula') || '1d20';

      const groupChaseBonus = this.actor.system.group_chase_bonus || 0;
      const burdenPenalty = this.actor.system.burden_penalty || 0;
      const endMod = this.actor.system.abilities['end'].current;
      const burdenPart = burdenPenalty > 0 ? -1 * burdenPenalty : 0;
      const chaseSum = endMod + skillPart + groupChaseBonus + burdenPart;

      const useHardLimitRule = game.settings.get('sdm', 'useHardLimitRule');
      const defaultHardLimitValue = game.settings.get('sdm', 'defaultHardLimitValue') || MAX_MODIFIER;
      const finalChaseBonus = useHardLimitRule ? Math.min(chaseSum, defaultHardLimitValue) : chaseSum;

      const bonusPart =
        finalChaseBonus === 0 ? '' : finalChaseBonus > 0 ? `+${finalChaseBonus}` : finalChaseBonus;
      const modPart = foundry.dice.Roll.validate(modifier) ? ` +${modifier}` : '';

      const keepModifier =
        rollMode === RollMode.ADVANTAGE ? 'kh' : rollMode === RollMode.DISADVANTAGE ? 'kl' : '';

      const diceExpression = keepModifier
        ? `{${baseFormula}, ${baseFormula}}${keepModifier}`
        : baseFormula;

      const formula = `${diceExpression}${bonusPart}${modPart}`;
      return sanitizeExpression(formula);
    };

    if (!isShift) {
      data = await DialogV2.wait({
        window: {
          title: label
        },
        modal: true,
        position: {
          width: 500
        },
        content: await renderTemplate(templatePath('group-chase-roll-dialog'), {
          rollModes: CONFIG.SDM.rollMode,
          selectedRollMode,
          availableSkills,
          blindGMRoll: isCtrl
        }),
        buttons: [
          {
            label: $l10n('SDM.GroupChase'),
            icon: 'fa-solid fa-truck-fast',
            callback: (event, button) => ({
              ...new foundry.applications.ux.FormDataExtended(button.form).object
            })
          }
        ],
        rollPreview: values => rollPreviewRows([{ label: $l10n('SDM.RollPreview.Rolls'), formula: formulaFor(values) }]),
        rejectClose: false
      });
    }

    if (!data) {
      return;
    }

    const sanitizedFormula = formulaFor(data);

    let roll = new Roll(sanitizedFormula);
    roll = await roll.evaluate();

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });

    await renderGroupChaseResult(
      { roll, label: `[${$l10n('SDM.GroupChase')}]` },
      { fromHeroDice: false, speaker, isCtrl }
    );
  }

  static async _onDefeatRoll(event, target) {
    event.preventDefault();
    event.stopPropagation();

    if (event.detail > 1) return;
    const reverseShift = game.settings.get('sdm', 'reverseShiftKey');
    const isShift = reverseShift !== !!event.shiftKey;
    const isCtrl = !!event.ctrlKey;
    let data = { modifier: '', selectedAbility: 'end' };

    if (this.actor.type !== ActorType.CHARACTER) return;

    const selectedRollMode = this.actor.system?.defeat?.roll_mode || RollMode.NORMAL;

    // The formula rolled for the dialog values (also shown live in the dialog)
    const formulaFor = values => {
      const { modifier = '', selectedAbility = 'end', rollMode = RollMode.NORMAL } = values ?? {};

      const baseFormula = game.settings.get('sdm', 'baseDefeatFormula') || '2d6';

      const burdenPenalty = this.actor.system.burden_penalty || 0;

      const abilityMod =
        this.actor.type === ActorType.CHARACTER
          ? this.actor.system.abilities[selectedAbility].current
          : this.actor.system?.bonus || 0;

      const burdenPart = burdenPenalty > 0 ? -1 * burdenPenalty : 0;
      const defeatBonus = this.actor.system.defeat.roll_bonus || 0;
      const totalBonuses = abilityMod + defeatBonus + burdenPart;
      const bonusPart =
        totalBonuses === 0 ? '' : totalBonuses > 0 ? `+${totalBonuses}` : totalBonuses;
      const modPart = foundry.dice.Roll.validate(modifier) ? ` +${modifier}` : '';

      const keepModifier =
        rollMode === RollMode.ADVANTAGE ? 'kh' : rollMode === RollMode.DISADVANTAGE ? 'kl' : '';

      const diceExpression = keepModifier
        ? `{${baseFormula}, ${baseFormula}}${keepModifier}`
        : baseFormula;

      const formula = `${diceExpression}${bonusPart}${modPart}`;
      return sanitizeExpression(formula);
    };

    if (!isShift) {
      data = await DialogV2.wait({
        window: {
          title: $fmt('SDM.RollType', { type: $l10n('SDM.Defeat') })
        },
        modal: true,
        position: {
          width: 500
        },
        content: await renderTemplate(templatePath('defeat-roll-dialog'), {
          rollModes: CONFIG.SDM.rollMode,
          selectedRollMode,
          abilities: CONFIG.SDM.defeatAbilities,
          blindGMRoll: isCtrl
        }),
        buttons: [
          {
            label: $l10n('SDM.DefeatRoll'),
            icon: 'fa-solid fa-bed-pulse',
            callback: (event, button) => ({
              ...new foundry.applications.ux.FormDataExtended(button.form).object
            })
          }
        ],
        rollPreview: values => rollPreviewRows([{ label: $l10n('SDM.RollPreview.Rolls'), formula: formulaFor(values) }]),
        rejectClose: false
      });
    }

    if (!data) {
      return;
    }

    const { selectedAbility = 'end' } = data;
    const sanitizedFormula = formulaFor(data);

    let roll = new Roll(sanitizedFormula);
    roll = await roll.evaluate();

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const defeatedId = CONFIG.specialStatusEffects.DEFEATED;
    if (roll.total <= 6) {
      await this.actor?.toggleStatusEffect(defeatedId, {
        overlay: true,
        active: true
      });
    }

    // Optional condition automation: knocked out (7) or stunned (8–11)
    await applyDefeatCondition(this.actor, roll.total);

    // Defeat triggers (above 6 the character is not defeated)
    const fired = actorTriggers(this.actor, 'defeat', roll, { success: roll.total > 6 });
    await renderDefeatResult(
      { roll, selectedAbility },
      { fromHeroDice: false, speaker, isCtrl, extraHtml: renderTriggers(fired) }
    );
    if (fired.length) await runTriggerActions(fired, { actor: this.actor });
  }

  static async _onRollDanger(event, target) {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail > 1) return;

    const dataset = target.dataset;
    const { ability = 'aur', targetNumber = 0 } = dataset;

    const reverseShift = game.settings.get('sdm', 'reverseShiftKey');
    const isShift = reverseShift !== !!event.shiftKey;
    const isCtrl = !!event.ctrlKey;

    const title = $fmt('SDM.RollType', {
      type: $l10n('SDM.Danger')
    });
    const language = game.i18n.lang;
    const availableSkills = this.actor.getAvailableSkills();
    const isNpc = this.actor.type === ActorType.NPC || !this.actor.system.abilities;

    const template = await renderTemplate(templatePath('custom-roll-dialog'), {
      rollTitlePrefix: '',
      title,
      abilities: CONFIG.SDM.getOrderedAbilities(language),
      ability,
      attack: '',
      availableSkills: availableSkills,
      selectedSkill: '',
      rollModes: [RollMode.NORMAL],
      selectedRollMode: RollMode.NORMAL,
      type: RollType.DANGER,
      // NPCs (e.g. an animated item using its power) have no abilities: they roll with their bonus
      isCharacterActor: !isNpc,
      attackTargetChoices: CONFIG.SDM.attackTarget,
      blindGMRoll: isCtrl
    });

    const buttons = [
      {
        action: 'save',
        icon: 'fa-solid fa-dice-d20',
        label: $l10n('SDM.ButtonRoll'),
        callback: (event, button) => ({
          versatile: false,
          ...new foundry.applications.ux.FormDataExtended(button.form).object
        })
      }
    ];

    let rollOptions = {};

    if (!isShift) {
      rollOptions = await foundry.applications.api.DialogV2.wait({
        window: {
          title
        },
        modal: true,
        content: template,
        position: {
          width: 400
        },
        rejectClose: false,
        buttons
      });

      if (rollOptions === null) {
        return;
      }
    }

    const modifier = rollOptions?.modifier;
    const rollMode = rollOptions?.rollMode;
    const selectedAbility = rollOptions?.selectedAbility;
    const selectedSkill = rollOptions?.selectedSkill;
    const modPart = foundry.dice.Roll.validate(modifier) ? `+${modifier}` : '';
    const baseRollFormula =
      game.settings.get('sdm', 'savingThrowBaseRollFormula') || SAVING_THROW_BASE_FORMULA;

    const keepModifier =
      rollMode === RollMode.ADVANTAGE ? 'kh' : rollMode === RollMode.DISADVANTAGE ? 'kl' : '';

    const diceExpression = keepModifier
      ? `{${baseRollFormula}, ${baseRollFormula}}${keepModifier}`
      : baseRollFormula;

    const abilityData =
      isNpc || ability === ActorType.NPC
        ? { current: this.actor.system.bonus }
        : this.actor.system.abilities[selectedAbility || ability];

    const finalAbility = Number(abilityData?.current) || 0;
    const burdenPenalty = this.actor.system?.burden_penalty || 0;

    const skillPart = (selectedSkill ? Number(availableSkills?.[selectedSkill]?.mod) : 0) || 0;
    const dangerSum = finalAbility + skillPart - burdenPenalty;

    const useHardLimitRule = game.settings.get('sdm', 'useHardLimitRule');
    const defaultHardLimitValue = game.settings.get('sdm', 'defaultHardLimitValue') || MAX_MODIFIER;
    const finalDangerBonus = useHardLimitRule
      ? Math.min(dangerSum, defaultHardLimitValue)
      : dangerSum;

    const bonusPart =
      finalDangerBonus === 0
        ? ''
        : finalDangerBonus > 0
          ? `+${finalDangerBonus}`
          : finalDangerBonus;

    let formula = `${diceExpression}${bonusPart}${modPart}`;

    formula = sanitizeExpression(formula);
    let roll = new Roll(formula);
    roll = await roll.evaluate();

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const label = `[${$l10n('SDM.Danger')}]`;
    await renderDangerResult(
      { roll, label, targetNumber },
      { fromHeroDice: false, speaker, isCtrl }
    );
  }

  static async _onRollSavingThrow(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    if (event.detail > 1) return; // Ignore repeated clicks

    // Get common data attributes
    const dataset = target.dataset;
    const { ability, rollTarget } = dataset;
    const abilityData =
      ability !== ActorType.NPC
        ? this.actor.system.abilities[ability]
        : { current: this.actor.system.bonus };

    const finalAbility = abilityData?.current;
    const ward = this.actor?.system?.ward || 0;
    const burdenPenalty = this.actor.system?.burden_penalty || 0;
    const saveBonus = abilityData?.save_bonus || 0;
    const allSaveBonus = this.actor.system?.all_save_bonus || 0;
    const savingThrowSum = finalAbility + ward + saveBonus + allSaveBonus - burdenPenalty;

    const useHardLimitRule = game.settings.get('sdm', 'useHardLimitRule');
    const defaultHardLimitValue = game.settings.get('sdm', 'defaultHardLimitValue') || MAX_MODIFIER;
    const finalSavingThrowBonus = useHardLimitRule
      ? Math.min(savingThrowSum, defaultHardLimitValue)
      : savingThrowSum;

    const reverseShift = game.settings.get('sdm', 'reverseShiftKey');
    const isShift = reverseShift !== !!event.shiftKey;
    const isCtrl = !!event.ctrlKey;

    let label = $fmt('SDM.SavingThrowRoll', {
      ability: $l10n(CONFIG.SDM.abilities[ability]) || $l10n('TYPES.Actor.npc')
    });

    if (ward > 0) {
      label += ` (${$l10n('TYPES.Item.ward').toLowerCase()} +${ward})`;
    }

    const actorData = this.actor?.system;
    const damageMultiplier = CONFIG.SDM.getDamageMultiplier(actorData.base_damage_multiplier || 2);

    const template = await renderTemplate(templatePath('custom-roll-dialog'), {
      rollTitlePrefix: '',
      title: label,
      abilities: [],
      ability,
      attack: '',
      availableSkills: [],
      selectedSkill: '',
      multiplierOptions: damageMultiplier,
      rollModes: CONFIG.SDM.rollMode,
      selectedRollMode: abilityData.roll_mode || RollMode.NORMAL,
      type: RollType.SAVE,
      isCharacterActor: true,
      attackTargetChoices: CONFIG.SDM.attackTarget,
      blindGMRoll: isCtrl
    });

    const buttons = [
      {
        action: 'save',
        icon: 'fa-solid fa-dice-d20',
        label: $l10n('SDM.ButtonRoll'),
        callback: (event, button) => ({
          versatile: false,
          ...new foundry.applications.ux.FormDataExtended(button.form).object
        })
      }
    ];

    // The formula rolled for the dialog values (also shown live in the dialog)
    const formulaFor = values => {
      const modifier = values?.modifier;
      const rollMode = values?.rollMode;

      const modPart = foundry.dice.Roll.validate(modifier) ? `+${modifier}` : '';
      const baseRollFormula =
        game.settings.get('sdm', 'savingThrowBaseRollFormula') || SAVING_THROW_BASE_FORMULA;

      const keepModifier =
        rollMode === RollMode.ADVANTAGE ? 'kh' : rollMode === RollMode.DISADVANTAGE ? 'kl' : '';

      const diceExpression = keepModifier
        ? `{${baseRollFormula}, ${baseRollFormula}}${keepModifier}`
        : baseRollFormula;

      const bonusPart =
        finalSavingThrowBonus === 0
          ? ''
          : finalSavingThrowBonus > 0
            ? `+${finalSavingThrowBonus}`
            : finalSavingThrowBonus;

      let formula = `${diceExpression}${bonusPart}${modPart}`;

      return sanitizeExpression(formula);
    };

    let rollOptions = {};

    if (!isShift) {
      // Create and render the modal
      rollOptions = await foundry.applications.api.DialogV2.wait({
        window: {
          title: $fmt('SDM.RollType', { type: $l10n('SDM.FieldSaveTarget') })
        },
        modal: true,
        content: template,
        position: {
          width: 400
        },
        rollPreview: values => rollPreviewRows([{ label: $l10n('SDM.RollPreview.Rolls'), formula: formulaFor(values) }]),
        rejectClose: false,
        buttons
      });

      if (rollOptions === null) {
        return;
      }
    }

    const targetNumber = rollTarget || this.actor.system?.save_target || DEFAULT_SAVE_VALUE;
    const formula = formulaFor(rollOptions);
    // Create and evaluate the roll
    let roll = new Roll(formula);
    roll = await roll.evaluate();

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });

    // Save triggers of the actor's readied gear, traits and burdens (a save at or above the target succeeds)
    const fired = actorTriggers(this.actor, 'save', roll, {
      ability: ability === ActorType.NPC ? '' : ability,
      success: roll.total >= targetNumber
    });
    await renderSaveResult(
      { roll, label, targetNumber },
      { fromHeroDice: false, speaker, isCtrl, extraHtml: renderTriggers(fired) }
    );
    if (fired.length) await runTriggerActions(fired, { actor: this.actor });
  }

  static async _onUpdateAttack(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    if (event.detail > 1) return; // Ignore repeated clicks

    // Get common data attributes
    const dataset = target.dataset;
    const { attack } = dataset;

    this._openUpdateAttackModal(attack);
  }

  static async _onHeroHealing(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    const { detail, button } = event;
    if (event.detail > 1) return;

    let onlySpendWithoutRolling = button === 2;

    // Get common data attributes
    await healingHeroDice(event, this.actor, onlySpendWithoutRolling);
  }

  static async _onBloodDiceRoll(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events

    // Get common data attributes
    await directResourceDiceRoll(event, this.actor, 'blood_dice');
  }

  static async _onTouristDiceRoll(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events

    // Get common data attributes
    await directResourceDiceRoll(event, this.actor, 'tourist_dice');
  }

  static async _openDoc(event, target) {
    const { detail, button } = event;

    if (button === 0) {
      if (detail <= 1 || detail > 2) return;
      return SdmActorSheet._viewDoc.call(this, event, target);
    }
  }

  /** Use a consumable (or other usable gear) on the selected tokens. */
  static async _onUseItem(event, target) {
    event.preventDefault();
    event.stopPropagation();
    await useItem(this._getEmbeddedDocument(target));
  }

  /** Rest one week (button next to the life label). */
  static async _onRestActor(event) {
    event.preventDefault();
    event.stopPropagation();
    await restActor(this.actor);
  }

  /** Inventory row flame: put the item's light out. */
  static async _onPutOutLight(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const item = this._getEmbeddedDocument(target);
    if (item) await putOutLight(this.actor, { itemId: item.id });
  }

  /** Inventory counter: click +1, right-click −1. */
  static async _onStepItemCounter(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const item = this._getEmbeddedDocument(target);
    await stepCounter(item, target.dataset.key, event.button === 2 ? -1 : 1);
  }

  static async _toggleItemStatus(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events

    const item = this._getEmbeddedDocument(target);
    await item.toggleItemStatus(event);
  }

  /** Choose a pending level-up upgrade for the character. */
  static async _onChooseUpgrade(event) {
    event.preventDefault();
    event.stopPropagation();
    return openCharacterUpgradeDialog(this.actor);
  }

  /** Choose a pending upgrade for a hallmark item in the inventory. */
  static async _onChooseHallmarkUpgrade(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const item = this._getEmbeddedDocument(target);
    if (item) return openHallmarkUpgradeDialog(item);
  }

  /** History of investments and upgrades (the Referee can undo the latest). */
  static async _onShowProgressLog(event) {
    event.preventDefault();
    event.stopPropagation();
    return openProgressLog(this.actor);
  }

  /** Open the dialog to invest Player XP. */
  static async _onInvestXp(event) {
    event.preventDefault();
    event.stopPropagation();
    return openInvestXpDialog(this.actor);
  }

  /** Referee: Shift+click the link icon by the name to link / unlink the prototype token. */
  static async _onToggleProtoLink(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM || !event.shiftKey || this.document.isToken) return;
    const linked = !this.actor.prototypeToken?.actorLink;
    await this.actor.update({ 'prototypeToken.actorLink': linked });
    await ChatMessage.create({
      content: `<p><i class="fa-solid ${linked ? 'fa-link' : 'fa-link-slash'}"></i> ${foundry.utils.escapeHTML(
        game.i18n.format(linked ? 'SDM.ProtoLink.NowLinked' : 'SDM.ProtoLink.NowUnlinked', { name: this.actor.name })
      )}</p>`,
      whisper: [game.user.id]
    });
  }

  /** Referee: see and change the table the NPC levels up with. */
  static async _onConfigureNpcTable(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM) return;
    const current = this.actor.system.createdFromTable || 'generic-synthesized-creature';
    const choices = getNpcTableChoices();
    const options = Object.entries(choices)
      .map(([key, label]) => `<option value="${key}" ${key === current ? 'selected' : ''}>${game.i18n.localize(label)}</option>`)
      .join('');
    // An individual profile (optional NPC variability) can be removed here: back to the plain table
    const profile = getNpcProfile(this.actor);
    const profileHtml = profile
      ? `<div class="form-group"><label>${game.i18n.localize('SDM.NpcProfile.Label')}</label>
        <div class="form-fields"><span>${foundry.utils.escapeHTML(describeNpcProfile(profile))}</span></div></div>
        <div class="form-group"><label><input type="checkbox" name="removeProfile" /> ${game.i18n.localize('SDM.NpcProfile.Remove')}</label></div>
        <p class="hint">${game.i18n.localize('SDM.NpcProfile.RemoveHint')}</p>`
      : '';
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('SDM.NpcTable.Title'), icon: 'fa-solid fa-gear' },
      content: `<div class="form-group"><label>${game.i18n.localize('SDM.NpcTable.Label')}</label>
        <div class="form-fields"><select name="table">${options}</select></div></div>
        <p class="hint">${game.i18n.localize('SDM.NpcTable.Hint')}</p>${profileHtml}`,
      rejectClose: false,
      ok: {
        label: game.i18n.localize('SDM.NpcTable.Save'),
        callback: (e, button) => ({
          table: button.form.elements.table.value,
          removeProfile: !!button.form.elements.removeProfile?.checked
        })
      }
    });
    if (!result?.table) return;
    const { table } = result;
    if (result.removeProfile) await this.actor.unsetFlag('sdm', 'npcProfile');
    await this.actor.update({ 'system.createdFromTable': table });
    // An animated item's creature: the item keeps the same table
    const item = getAnimatedSourceItem(this.actor);
    if (item) await item.update({ 'system.animation.table': table }, { sdmAnimationSync: true });
  }

  static async _onLevelUpNPC(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events

    if (!this.actor.type === ActorType.NPC) return;
    const npcData = this.actor.system;
    const currentLevel = npcData.level || 0;
    const npcTable = npcData.createdFromTable || '';
    const nextLevel = currentLevel + 1;
    const newData = getNPCDataByLevel(npcTable, nextLevel);

    // Custom table (no data): any level; otherwise the table's last level is the limit
    if (newData && newData.Lvl < nextLevel) {
      ui.notifications.error(
        $fmt('SDM.NPCLevelUpLimit', { name: this.actor.name, level: currentLevel })
      );
      return;
    }

    // Same stat rules as levelling by XP; XP is raised to the minimum for the new level
    await this.actor.levelUpNpcTo(nextLevel, { syncExperience: true });
  }

  static async _onOpenPetSheet(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events

    if (event.detail > 1) return;

    const item = this._getEmbeddedDocument(target);

    if (item.system.type !== GearType.PET) return;

    if (!item.system.pet) return;

    const petDocument = await fromUuid(item.system.pet);
    if (!petDocument) return;

    petDocument.sheet.render(true);
  }

  /** Helper Functions */

  /**
   * Fetches the embedded document representing the containing HTML element
   *
   * @param {HTMLElement} target    The element subject to search
   * @returns {Item | ActiveEffect} The embedded Item or ActiveEffect
   */
  _getEmbeddedDocument(target) {
    const docRow = target.closest('li[data-document-class]');
    if (docRow.dataset.documentClass === 'Item') {
      return this.actor.items.get(docRow.dataset.itemId);
    } else if (docRow.dataset.documentClass === 'ActiveEffect') {
      const parent =
        docRow.dataset.parentId === this.actor.id
          ? this.actor
          : this.actor.items.get(docRow?.dataset.parentId);
      return parent.effects.get(docRow?.dataset.effectId);
    } else return console.warn('Could not find document class');
  }

  /***************
   *
   * Drag and Drop
   *
   ***************/

  /**
   * Define whether a user is able to begin a dragstart workflow for a given drag selector
   * @param {string} selector       The candidate HTML selector for dragging
   * @returns {boolean}             Can the current user drag this selector?
   * @protected
   */
  _canDragStart(selector) {
    // game.user fetches the current user
    return this.isEditable;
  }

  /**
   * Define whether a user is able to conclude a drag-and-drop workflow for a given drop selector
   * @param {string} selector       The candidate HTML selector for the drop target
   * @returns {boolean}             Can the current user drop on this selector?
   * @protected
   */
  _canDragDrop(selector) {
    // game.user fetches the current user
    return this.isEditable;
  }

  /**
   * Callback actions which occur at the beginning of a drag start workflow.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragStart(event) {
    const docRow = event.currentTarget.closest('li');
    if ('link' in event.target.dataset) return;

    // Chained operation
    let dragData = this._getEmbeddedDocument(docRow)?.toDragData();

    if (!dragData) return;

    // Set data transfer
    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  /**
   * Callback actions which occur when a dragged element is over a drop target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragOver(event) {}

  /**
   * Callback actions which occur when a dragged element is dropped on a target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    const actor = this.actor;
    const allowed = Hooks.call('dropActorSheetData', actor, this, data);
    if (allowed === false) return;

    // Handle different data types
    switch (data.type) {
      case 'ActiveEffect':
        return this._onDropActiveEffect(event, data);
      case 'Actor':
        return this._onDropActor(event, data);
      case 'Item':
        return this._onDropItem(event, data);
      case 'Folder':
        return this._onDropFolder(event, data);
    }
  }

  /**
   * Handle the dropping of ActiveEffect data onto an Actor Sheet
   * @param {DragEvent} event                  The concluding DragEvent which contains drop data
   * @param {object} data                      The data transfer extracted from the event
   * @returns {Promise<ActiveEffect|boolean>}  The created ActiveEffect object or false if
   *                                           it couldn't be created.
   * @protected
   */
  async _onDropActiveEffect(event, data) {
    const aeCls = getDocumentClass('ActiveEffect');
    const effect = await aeCls.fromDropData(data);
    if (!this.actor.isOwner || !effect) return false;
    if (effect.target === this.actor) return this._onSortActiveEffect(event, effect);
    return aeCls.create(effect, { parent: this.actor });
  }

  /**
   * Handle a drop event for an existing embedded Active Effect to sort that Active Effect
   * relative to its siblings
   *
   * @param {DragEvent} event
   * @param {ActiveEffect} effect
   */
  async _onSortActiveEffect(event, effect) {
    /** @type {HTMLElement} */
    const dropTarget = event.target.closest('[data-effect-id]');
    if (!dropTarget) return;
    const target = this._getEmbeddedDocument(dropTarget);

    // Don't sort on yourself
    if (effect.uuid === target.uuid) return;

    // Identify sibling items based on adjacent HTML elements
    const siblings = [];
    for (const el of dropTarget.parentElement.children) {
      const siblingId = el.dataset.effectId;
      const parentId = el.dataset.parentId;
      if (siblingId && parentId && (siblingId !== effect.id || parentId !== effect.parent.id))
        siblings.push(this._getEmbeddedDocument(el));
    }

    // Perform the sort
    const sortUpdates = performIntegerSort(effect, {
      target,
      siblings
    });

    // Split the updates up by parent document
    const directUpdates = [];

    const grandchildUpdateData = sortUpdates.reduce((items, u) => {
      const parentId = u.target.parent.id;
      const update = { _id: u.target.id, ...u.update };
      if (parentId === this.actor.id) {
        directUpdates.push(update);
        return items;
      }
      if (items[parentId]) items[parentId].push(update);
      else items[parentId] = [update];
      return items;
    }, {});

    // Effects-on-items updates
    for (const [itemId, updates] of Object.entries(grandchildUpdateData)) {
      await this.actor.items.get(itemId).updateEmbeddedDocuments('ActiveEffect', updates);
    }

    // Update on the main actor
    return this.actor.updateEmbeddedDocuments('ActiveEffect', directUpdates);
  }

  /**
   * Handle dropping of an Actor data onto another Actor sheet
   * @param {DragEvent} event            The concluding DragEvent which contains drop data
   * @param {object} data                The data transfer extracted from the event
   * @returns {Promise<object|boolean>}  A data object which describes the result of the drop,
   *                                     or false if the drop was not permitted.
   * @protected
   */
  async _onDropActor(event, data) {
    if (!this.actor.isOwner) return false;
  }

  /* -------------------------------------------- */

  /**
   * Handle dropping of an item reference or item data onto an Actor Sheet
   * @param {DragEvent} event            The concluding DragEvent which contains drop data
   * @param {object} data                The data transfer extracted from the event
   * @returns {Promise<Item[]|boolean>}  The created or updated Item instances,
   *                                     or false if the drop was not permitted.
   * @protected
   */
  async _onDropItem(event, data) {
    if (!this.actor.isOwner) return false;

    const item = await Item.implementation.fromDropData(data);
    const isCharacterOrNPC = [ActorType.CHARACTER, ActorType.NPC].includes(this.actor.type);

    if (isCharacterOrNPC && ITEMS_NOT_ALLOWED_IN_CHARACTERS.includes(item.type)) {
      return false;
    }

    // Handle item sorting within the same Actor
    if (this.actor.uuid === item.parent?.uuid) {
      return this._handleInventoryDrop(event, item);
    }

    if (item.parent) {
      return this._onDropItemCreate(item, event);
    }

    if (item.system?.type === GearType.POWER) {
      const buttons = [
        {
          action: 'gear',
          label: game.i18n.localize('TYPE.Gear'),
          icon: 'fa fa-book',
          callback: () => 'gear'
        },
        {
          action: 'trait',
          label: game.i18n.localize('TYPE.Trait'),
          icon: 'fa fa-brain',
          callback: () => 'trait'
        },
        {
          action: 'burden',
          label: game.i18n.localize('TYPE.Burden'),
          icon: 'fa fa-skull',
          callback: () => 'burden'
        }
      ];

      const title = game.i18n.format('SDM.CreateItemTypeAs', {
        type: game.i18n.localize('TYPES.Item.power')
      });

      const choice = await DialogV2.wait({
        window: {
          title: title,
          resizable: false
        },
        content: `<h3>${title}</h3>`,
        buttons: buttons,
        modal: true,
        rejectClose: false
      });

      if (!choice) return;

      let clonedItem = foundry.utils.duplicate(item);
      clonedItem.system.type = GearType.POWER;
      switch (choice) {
        case 'gear':
          clonedItem.type = ItemType.GEAR;
          break;
        case 'trait':
          clonedItem.type = ItemType.TRAIT;
          break;
        case 'burden':
          clonedItem.type = ItemType.BURDEN;
          break;
      }

      return this._onDropItemCreate(clonedItem, event);
    }

    if (item.system?.type === GearType.CORRUPTION) {
      const itemCorruption = await DialogV2.confirm({
        window: { title: $fmt('SDM.CreateItemTypeAs', { type: $l10n('TYPES.Item.corruption') }) },
        content: `<h3>${$fmt('SDM.CreateItemTypeAs', { type: $l10n('TYPES.Item.corruption') })}</h3>`,
        modal: true,
        rejectClose: false,
        yes: { label: $l10n('TYPE.Item'), icon: 'fa fa-sack-xmark' },
        no: { label: $l10n('TYPE.Trait'), icon: 'fa fa-brain' }
      });

      if (itemCorruption === null) return;

      let clonedItem = foundry.utils.duplicate(item);

      if (!itemCorruption) {
        clonedItem.type = ItemType.TRAIT;
        return this._onDropItemCreate(clonedItem, event);
      }

      clonedItem.type = ItemType.GEAR;
      return this._onDropItemCreate(clonedItem, event);
    }

    if (item.type === ItemType.BURDEN || item.system?.type === GearType.AFFLICTION) {
      const buttons = [
        {
          action: 'gear',
          label: game.i18n.localize('TYPE.Gear'),
          icon: 'fa fa-sack-xmark',
          callback: () => 'gear'
        },
        {
          action: 'trait',
          label: game.i18n.localize('TYPE.Trait'),
          icon: 'fa fa-brain',
          callback: () => 'trait'
        },
        {
          action: 'burden',
          label: game.i18n.localize('TYPE.Burden'),
          icon: 'fa fa-skull',
          callback: () => 'burden'
        }
      ];

      const title = game.i18n.format('SDM.CreateItemTypeAs', {
        type: game.i18n.localize(
          item.type === ItemType.BURDEN ? 'TYPES.Item.burden' : 'TYPES.Item.affliction'
        )
      });

      const choice = await DialogV2.wait({
        window: {
          title: title,
          resizable: false
        },
        content: `<h3>${title}</h3>`,
        buttons: buttons,
        modal: true,
        rejectClose: false
      });

      if (!choice) return;

      let clonedItem = foundry.utils.duplicate(item);

      switch (choice) {
        case 'gear':
          clonedItem.type = ItemType.GEAR;
          clonedItem.system.type = GearType.AFFLICTION;
          break;
        case 'trait':
          clonedItem.type = ItemType.TRAIT;
          clonedItem.system.type = GearType.AFFLICTION;
          break;
        case 'burden':
          clonedItem.type = ItemType.BURDEN;
          clonedItem.system.type = '';
          break;
      }

      return this._onDropItemCreate(clonedItem, event);
    }

    if (item.system.type === GearType.PET) {
      const itemPet = await DialogV2.confirm({
        window: { title: $fmt('SDM.CreateItemTypeAs', { type: $l10n('TYPES.Item.pet') }) },
        content: `<h3>${$fmt('SDM.CreateItemTypeAs', { type: $l10n('TYPES.Item.pet') })}</h3>`,
        modal: true,
        rejectClose: false,
        yes: { label: $l10n('TYPE.Item'), icon: 'fa fa-sack-xmark' },
        no: { label: $l10n('TYPE.Trait'), icon: 'fa fa-brain' }
      });

      if (itemPet === null) return;

      let clonedItem = foundry.utils.duplicate(item);

      if (!itemPet) {
        clonedItem.type = ItemType.TRAIT;
        return this._onDropItemCreate(clonedItem, event);
      }

      clonedItem.type = ItemType.GEAR;
      return this._onDropItemCreate(clonedItem, event);
    }

    if (item.system.type === GearType.AUGMENT) {
      const itemAugment = await DialogV2.confirm({
        window: { title: $fmt('SDM.CreateItemTypeAs', { type: $l10n('TYPES.Item.augment') }) },
        content: `<h3>${$fmt('SDM.CreateItemTypeAs', { type: $l10n('TYPES.Item.augment') })}</h3>`,
        modal: true,
        rejectClose: false,
        yes: { label: $l10n('TYPE.Item'), icon: 'fa fa-sack-xmark' },
        no: { label: $l10n('TYPE.Trait'), icon: 'fa fa-brain' }
      });

      if (itemAugment === null) return;

      let clonedItem = foundry.utils.duplicate(item);

      if (!itemAugment) {
        clonedItem.type = ItemType.TRAIT;
        return this._onDropItemCreate(clonedItem, event);
      }

      clonedItem.type = ItemType.GEAR;
      return this._onDropItemCreate(clonedItem, event);
    }

    return this._onDropItemCreate(item, event);
  }

  async _handleInventoryDrop(event, droppedItem) {
    const dropTargetEl = event.target.closest('li[data-item-id]');
    let targetItem = null;

    const isDroppedContainer = droppedItem.system.type === GearType.CONTAINER;

    if (dropTargetEl) {
      targetItem = this.actor.items.get(dropTargetEl.dataset.itemId);
    }

    // ---------------------------------------------------------
    // Dropped on empty inventory space (move to root)
    // ---------------------------------------------------------
    if (!targetItem) {
      if (isDroppedContainer) return;

      const allItems = Array.from(this.actor.items);
      const maxSort = Math.max(...allItems.map(i => i.sort), 0);
      await droppedItem.update({
        'system.container': '',
        'system.readied': false,
        sort: maxSort + 100
      });
      await this._rebuildInventorySort();
      return;
    }

    const isTargetContainer = targetItem.system.type === GearType.CONTAINER;
    const isTargetInsideContainer = targetItem.system?.container !== '';

    /* =========================================================
     CASE 1: DROPPED ITEM IS A CONTAINER (unchanged)
    ========================================================== */
    if (isDroppedContainer) {
      // CASE: Dropped item is a container
      if (isTargetContainer) {
        // Swap two container blocks (container + all children)
        const droppedBlock = this.actor.items
          .filter(i => i.id === droppedItem.id || i.system.container === droppedItem.uuid)
          .sort((a, b) => a.sort - b.sort);

        const targetBlock = this.actor.items
          .filter(i => i.id === targetItem.id || i.system.container === targetItem.uuid)
          .sort((a, b) => a.sort - b.sort);

        const droppedSort = droppedBlock[0].sort;
        const targetSort = targetBlock[0].sort;

        const updates = [];

        for (let i = 0; i < droppedBlock.length; i++) {
          updates.push({ _id: droppedBlock[i].id, sort: targetSort + i });
        }
        for (let i = 0; i < targetBlock.length; i++) {
          updates.push({ _id: targetBlock[i].id, sort: droppedSort + i });
        }

        await this.actor.updateEmbeddedDocuments('Item', updates);
        await this._rebuildInventorySort();
        return;
      }

      // Dropped container onto a non‑container item
      if (targetItem.system.container) return; // cannot drop container into another container's interior

      await this._onSortItem(event, droppedItem); // reorder the container itself

      // After moving the container, renumber its children to follow immediately after
      const container = this.actor.items.get(droppedItem.id);
      const children = this.actor.items
        .filter(i => i.system.container === container.uuid)
        .sort((a, b) => a.sort - b.sort);

      if (children.length) {
        const updates = [];
        let base = container.sort;
        for (let i = 0; i < children.length; i++) {
          updates.push({
            _id: children[i].id,
            sort: base + (i + 1)
          });
        }
        await this.actor.updateEmbeddedDocuments('Item', updates);
      }
      return;
    }

    /* =========================================================
     CASE 2: NORMAL ITEM
    ========================================================== */
    let newContainer = '';

    if (isTargetContainer || isTargetInsideContainer) {
      if (!ITEMS_ALLOWED_IN_CONTAINERS.includes(droppedItem.system.type)) return;
    }

    // ---------------------------------------------------------
    // Dropped directly on container
    // ---------------------------------------------------------
    if (isTargetContainer) {
      // If the dropped item is already inside this container, do nothing
      if (droppedItem.system.container === targetItem.uuid) {
        return false;
      }

      newContainer = targetItem.uuid;

      // Update container reference
      const response = await droppedItem.update({
        'system.container': newContainer,
        'system.readied': false
      });
      if (!response) return;

      // Find all children of this container (including the just‑added item)
      const children = this.actor.items
        .filter(i => i.system.container === newContainer)
        .sort((a, b) => a.sort - b.sort);

      // Determine the maximum sort among the entire container block
      const blockMaxSort = Math.max(targetItem.sort, ...children.map(c => c.sort || 0));

      // Place new item after the block's maximum sort
      const newSort = blockMaxSort + 1;
      await droppedItem.update({ sort: newSort });
      // Then rebuild to ensure all sorts are consistent
      await this._rebuildInventorySort();
      return;
    }

    // ---------------------------------------------------------
    // Dropped on item inside a container
    // ---------------------------------------------------------
    if (targetItem.system.container) {
      newContainer = targetItem.system.container;
    } else {
      newContainer = '';
    }

    // If both items are in the same container (or both loose), sort them
    if (droppedItem.system.container === targetItem.system.container) {
      await this._onSortItem(event, droppedItem);
      await this._rebuildInventorySort();
      return;
    }

    // Otherwise update container reference and then sort
    if (droppedItem.system.container !== newContainer) {
      const response = await droppedItem.update({
        'system.container': newContainer,
        'system.readied': false
      });
      if (!response) return;
    }

    await this._onSortItem(event, droppedItem);
    await this._rebuildInventorySort();
    return;
  }

  async _reorderContainers(droppedContainer, targetItem) {
    const containers = this.actor.items
      .filter(i => i.system.type === 'container')
      .sort((a, b) => a.sort - b.sort);

    const targetIsContainer = targetItem.system.type === 'container';

    const targetContainer = targetIsContainer ? targetItem : null;

    if (!targetContainer) return;

    const siblings = containers.filter(c => c.id !== droppedContainer.id);

    const sortUpdates = foundry.utils.performIntegerSort(droppedContainer, {
      target: targetContainer,
      siblings
    });

    const updates = sortUpdates.map(u => ({
      _id: u.target.id,
      ...u.update
    }));

    return this.actor.updateEmbeddedDocuments('Item', updates);
  }

  async _rebuildInventorySort() {
    const items = Array.from(this.actor.items);

    const containers = items
      .filter(i => i.system.type === 'container')
      .sort((a, b) => a.sort - b.sort);

    const looseItems = items
      .filter(i => i.system.type !== 'container' && !i.system.container)
      .sort((a, b) => a.sort - b.sort);

    const containerMap = new Map();

    for (const container of containers) {
      containerMap.set(container.uuid, []);
    }

    for (const item of items) {
      if (item.system.container && containerMap.has(item.system.container)) {
        containerMap.get(item.system.container).push(item);
      }
    }

    const finalOrder = [];

    finalOrder.push(...looseItems);

    for (const container of containers) {
      finalOrder.push(container);

      const children = containerMap.get(container.uuid).sort((a, b) => a.sort - b.sort);

      finalOrder.push(...children);
    }

    const updates = finalOrder.map((item, index) => ({
      _id: item.id,
      sort: (index + 1) * 100
    }));

    return this.actor.updateEmbeddedDocuments('Item', updates);
  }

  /**
   * Handle dropping of a Folder on an Actor Sheet.
   * The core sheet currently supports dropping a Folder of Items to create all items as owned items.
   * @param {DragEvent} event     The concluding DragEvent which contains drop data
   * @param {object} data         The data transfer extracted from the event
   * @returns {Promise<Item[]>}
   * @protected
   */
  async _onDropFolder(event, data) {
    if (!this.actor.isOwner) return [];
    const folder = await Folder.implementation.fromDropData(data);
    if (folder.type !== 'Item') return [];
    const droppedItemData = await Promise.all(
      folder.contents.map(async item => {
        if (!(document instanceof Item)) item = await fromUuid(item.uuid);
        return item;
      })
    );
    return this._onDropItemCreate(droppedItemData, event);
  }

  /**
   * Handle the final creation of dropped Item data on the Actor.
   * This method is factored out to allow downstream classes the opportunity to override
   * item creation behavior.
   * @param {object[]|object} itemData      The item data requested for creation
   * @param {DragEvent} event               The concluding DragEvent which provided the drop data
   * @returns {Promise<Item[]>}
   * @privateW
   */
  async _onDropItemCreate(itemData, event) {
    itemData = itemData instanceof Array ? itemData : [itemData];

    // Calculate total weight of new items using data model defaults
    let totalSlots = itemData.reduce((sum, item) => {
      const system = item.system || {};
      const slots = getSlotsTaken(system);
      return sum + slots;
    }, 0);
    const itemType = itemData[0].type;

    if (itemData[0].system.is_hallmark && !this.actor.canAddHallmarkItem()) {
      ui.notifications.error($fmt('SDM.ErrorHallmarkLimit', { target: this.actor.name }));
      return [];
    }

    const validWeight = this._checkActorWeightLimit(totalSlots, itemType);

    if (!validWeight) {
      ui.notifications.error($fmt('SDM.ErrorWeightLimit', { target: this.actor.name }));
      return [];
    }

    // Detect cross-actor drop
    const sourceItem = itemData[0].uuid ? fromUuidSync(itemData[0].uuid) : null;
    const sourceActor = sourceItem?.parent;

    const isCrossActor = sourceActor && sourceActor.uuid !== this.actor.uuid;
    const isContainer = sourceItem && !!sourceItem.system?.capacity?.max;
    const isCopy = event.ctrlKey;

    if (isCrossActor && isContainer) {
      return this._transferContainerWithContents(sourceItem, sourceActor, isCopy);
    }

    // Default behavior
    if (sourceItem?.parent?.isOwner && !isCopy) {
      await sourceItem.delete();
    }

    return this.actor.createEmbeddedDocuments('Item', itemData);
  }

  async _transferContainerWithContents(containerItem, sourceActor, isCopy) {
    const targetActor = this.actor;

    // 1️⃣ Duplicate container
    const containerData = foundry.utils.duplicate(containerItem.toObject());
    delete containerData._id;
    delete containerData.sort;
    delete containerData.folder;

    const [createdContainer] = await targetActor.createEmbeddedDocuments('Item', [containerData]);

    const oldUuid = containerItem.uuid;
    const newUuid = createdContainer.uuid;

    // 2️⃣ Find children
    const children = sourceActor.items.filter(i => i.system.container === oldUuid);

    if (children.length) {
      const childData = children.map(child => {
        const data = foundry.utils.duplicate(child.toObject());
        delete data._id;
        delete data.sort;
        delete data.folder;
        foundry.utils.setProperty(data, 'system.container', newUuid);
        return data;
      });

      await targetActor.createEmbeddedDocuments('Item', childData);
    }

    // 3️⃣ Delete originals ONLY if move
    if (!isCopy) {
      await sourceActor.deleteEmbeddedDocuments('Item', [
        containerItem.id,
        ...children.map(c => c.id)
      ]);
    }

    return createdContainer;
  }

  /**
   * Handle a drop event for an existing embedded Item to sort that Item relative to its siblings
   * @param {Event} event
   * @param {Item} item
   * @private
   */
  _onSortItem(event, item) {
    // Get the drag source and drop target
    const items = this.actor.items;
    const dropTarget = event.target.closest('[data-item-id]');
    if (!dropTarget) return;
    const target = items.get(dropTarget.dataset.itemId);

    // Don't sort on yourself
    if (item.id === target.id) return;

    // Identify sibling items based on adjacent HTML elements
    const siblings = [];
    for (let el of dropTarget.parentElement.children) {
      const siblingId = el.dataset.itemId;
      if (siblingId && siblingId !== item.id) siblings.push(items.get(el.dataset.itemId));
    }

    // Perform the sort
    const sortUpdates = performIntegerSort(item, {
      target,
      siblings
    });
    const updateData = sortUpdates.map(u => {
      const update = u.update;
      update._id = u.target._id;
      return update;
    });

    // Perform the update
    return this.actor.updateEmbeddedDocuments('Item', updateData);
  }

  /** The following pieces set up drag handling and are unlikely to need modification  */

  /**
   * Returns an array of DragDrop instances
   * @type {DragDrop[]}
   */
  get dragDrop() {
    return this.#dragDrop;
  }

  // This is marked as private because there's no real need
  // for subclasses or external hooks to mess with it directly
  #dragDrop;

  /**
   * Create drag-and-drop workflow handlers for this Application
   * @returns {DragDrop[]}     An array of DragDrop handlers
   * @private
   */
  #createDragDropHandlers() {
    return this.options.dragDrop.map(d => {
      d.permissions = {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this)
      };
      d.callbacks = {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this)
      };
      return new DragDrop(d);
    });
  }

  /********************
   *
   * Actor Override Handling
   *
   ********************/

  /**
   * Submit a document update based on the processed form data.
   * @param {SubmitEvent} event                   The originating form submission event
   * @param {HTMLFormElement} form                The form element that was submitted
   * @param {object} submitData                   Processed and validated form data to be used
   *                                              for a document update
   * @returns {Promise<void>}
   * @protected
   * @override
   */
  async _processSubmitData(event, form, submitData) {
    const overrides = foundry.utils.flattenObject(this.actor.overrides);
    for (let k of Object.keys(overrides)) delete submitData[k];
    await this.document.update(submitData);
  }

  /**
   * Disables inputs subject to active effects
   */
  #disableOverrides() {
    const flatOverrides = foundry.utils.flattenObject(this.actor.overrides);
    for (const override of Object.keys(flatOverrides)) {
      const input = this.element.querySelector(`[name="${override}"]`);
      if (input) {
        input.disabled = true;
      }
    }
  }
}

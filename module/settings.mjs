import { DiceType } from './helpers/constants.mjs';
import { $fmt, $l10n } from './helpers/globalUtils.mjs';
import { handleHeroDice } from './rolls/hero_dice/index.mjs';

export const BASE_REACTION_FORMULA = '2d6';
export const CHARACTER_DEFAULT_INITIATIVE = '2d6 + @abilities.agi.current + @initiative_bonus';
export const NPC_DEFAULT_INITIATIVE = '2d6 + @bonus';
export const NPC_DEFAULT_MORALE_FORMULA = '2d6';
export const SAVING_THROW_BASE_FORMULA = '1d20x';
export const DEFAULT_LEVEL_UP_SOUND =
  'systems/sdm/assets/audio/sounds_effects/single_church_bell.mp3';
export const DEFAULT_CURRENCY_IMG = 'icons/commodities/currency/coins-stitched-pouch-brown.webp';
export const DEFAULT_MAX_POWERS = 3;

export function registerSystemSettings() {
  /* -------------------------------------------- */
  /*  System settings registration                */
  /* -------------------------------------------- */

  game.settings.register('sdm', 'currencyName', {
    name: 'SDM.SettingsCurrencyName',
    hint: 'SDM.SettingsCurrencyNameHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: String, // Data type: String, Number, Boolean, etc
    default: 'cash'
  });

  game.settings.register('sdm', 'currencyImage', {
    name: 'SDM.SettingsCurrencyImg',
    hint: 'SDM.SettingsCurrencyImgHint',
    scope: 'world',
    restricted: true,
    config: true,
    type: new foundry.data.fields.FilePathField({
      categories: ['IMAGE'],
      default: DEFAULT_CURRENCY_IMG
    }),
    default: DEFAULT_CURRENCY_IMG
  });

  game.settings.register('sdm', 'shouldPlayLevelUpSoundFx', {
    name: 'SDM.SettingsShouldPlayLevelUpSoundFx',
    hint: 'SDM.SettingsShouldPlayLevelUpSoundFxHint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: false,
    requiresReload: false
  });

  game.settings.register('sdm', 'levelUpSoundFx', {
    name: 'SDM.SettingsLevelUpSoundFx',
    hint: 'SDM.SettingsLevelUpSoundFxHint',
    scope: 'world',
    restricted: true,
    config: true,
    type: new foundry.data.fields.FilePathField({
      categories: ['AUDIO'],
      default: DEFAULT_LEVEL_UP_SOUND
    }),
    default: DEFAULT_LEVEL_UP_SOUND,
    onChange: value => {
      if (!value) {
        game.settings.set('sdm', 'levelUpSoundFx', DEFAULT_LEVEL_UP_SOUND);
      }
    }
  });

  game.settings.register('sdm', 'defaultMaxPowers', {
    name: 'SDM.SettingsDefaultMaxPowers',
    hint: 'SDM.SettingsDefaultMaxPowersHint',
    scope: 'world',
    restricted: true,
    config: true,
    type: Number,
    default: DEFAULT_MAX_POWERS,
    onChange: value => {
      if (!value || value <= 0) {
        game.settings.set('sdm', 'defaultMaxPowers', DEFAULT_MAX_POWERS);
      }
    },
    requiresReload: true
  });

  game.settings.register('sdm', 'skillModifierStep', {
    name: 'SDM.SettingsSkillModifierStep',
    hint: 'SDM.SettingsSkillModifierStepHint',
    scope: 'world',
    restricted: true,
    config: true,
    type: Number,
    default: 3,
    onChange: value => {
      if (!value || value < 0 || value > 4) {
        game.settings.set('sdm', 'skillModifierStep', 3);
      }
    },
    requiresReload: true
  });

  game.settings.register('sdm', 'extendedSkillRanks', {
    name: 'SDM.SettingsExtendedSkillRanks',
    hint: 'SDM.SettingsExtendedSkillRanksHint',
    scope: 'world',
    restricted: true,
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true
  });

  game.settings.register('sdm', 'escalatorDie', {
    name: 'SDM.SettingsEscalatorDie',
    hint: 'SDM.SettingsEscalatorDieHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    config: false, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 0,
    onChange: value => {
      // This will now be called automatically
      updateEscalatorDisplay();
    }
  });

  game.settings.register('sdm', 'defaultSaveValue', {
    name: 'SDM.SettingsDefaultSaveValue',
    hint: 'SDM.SettingsDefaultSaveValueHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 13
  });

  game.settings.register('sdm', 'baseDefense', {
    name: 'SDM.SettingsBaseDefense',
    hint: 'SDM.SettingsBaseDefenseHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 7
  });

  game.settings.register('sdm', 'baseMentalDefense', {
    name: 'SDM.SettingsBaseMentalDefense',
    hint: 'SDM.SettingsBaseMentalDefenseHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 7
  });

  game.settings.register('sdm', 'baseSocialDefense', {
    name: 'SDM.SettingsBaseSocialDefense',
    hint: 'SDM.SettingsBaseSocialDefenseHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 7
  });

  game.settings.register('sdm', 'baseTraitSlots', {
    name: 'SDM.SettingsBaseTraitSlots',
    hint: 'SDM.SettingsBaseTraitSlotsHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 7
  });

  game.settings.register('sdm', 'baseItemSlots', {
    name: 'SDM.SettingsBaseItemSlots',
    hint: 'SDM.SettingsBaseItemSlotsHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 7
  });

  game.settings.register('sdm', 'baseBurdenSlots', {
    name: 'SDM.SettingsBaseBurdenSlots',
    hint: 'SDM.SettingsBaseBurdenSlotsHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 20
  });

  game.settings.register('sdm', 'baseMoraleFormula', {
    name: 'SDM.SettingsBaseMoraleFormula',
    hint: 'SDM.SettingsBaseMoraleFormulaHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: String, // Data type: String, Number, Boolean, etc
    default: NPC_DEFAULT_MORALE_FORMULA
  });

  game.settings.register('sdm', 'baseReactionFormula', {
    name: 'SDM.SettingsBaseReactionFormula',
    hint: 'SDM.SettingsBaseReactionFormulaHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: String, // Data type: String, Number, Boolean, etc
    default: BASE_REACTION_FORMULA
  });

  game.settings.register('sdm', 'defaultHeroDiceType', {
    name: 'SDM.SettingsDefaultHeroDiceType',
    hint: 'SDM.SettingsDefaultHeroDiceTypeHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: String, // Data type: String, Number, Boolean, etc
    default: 'd6',
    choices: DiceType,
    requiresReload: true
  });

  game.settings.register('sdm', 'savingThrowBaseRollFormula', {
    name: 'SDM.SettingsSavingThrowBaseRollFormula',
    hint: 'SDM.SettingsSavingThrowBaseRollFormulaHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: String, // Data type: String, Number, Boolean, etc
    default: SAVING_THROW_BASE_FORMULA,
    onChange: value => {
      if (!foundry.dice.Roll.validate(value)) {
        ui.notifications.error(
          $fmt('SDM.SettingsInvalidChange', { settings: 'saving throw base formula' })
        );
        game.settings.set('sdm', 'savingThrowBaseRollFormula', SAVING_THROW_BASE_FORMULA);
      }
    }
  });

  game.settings.register('sdm', 'initiativeFormula', {
    name: 'SDM.SettingsInitiativeFormula',
    hint: 'SDM.SettingsInitiativeFormulaHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: String, // Data type: String, Number, Boolean, etc
    default: CHARACTER_DEFAULT_INITIATIVE,
    onChange: value => {
      if (!foundry.dice.Roll.validate(value)) {
        ui.notifications.error(
          $fmt('SDM.SettingsInvalidChange', { settings: 'initiative formula' })
        );
        game.settings.set('sdm', 'initiativeFormula', CHARACTER_DEFAULT_INITIATIVE);
      }
    }
  });

  game.settings.register('sdm', 'npcInitiativeFormula', {
    name: 'SDM.SettingsNPCInitiativeFormula',
    hint: 'SDM.SettingsNPCInitiativeFormulaHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: String, // Data type: String, Number, Boolean, etc
    default: NPC_DEFAULT_INITIATIVE,
    onChange: value => {
      if (!foundry.dice.Roll.validate(value)) {
        ui.notifications.error(
          $fmt('SDM.SettingsInvalidChange', { settings: 'npc initiative formula' })
        );
        game.settings.set('sdm', 'npcInitiativeFormula', NPC_DEFAULT_INITIATIVE);
      }
    }
  });

  game.settings.register('sdm', 'healingHouseRule', {
    name: 'SDM.SettingsHealingHouseRule',
    hint: 'SDM.SettingsHealingHouseRuleHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Boolean, // Data type: String, Number, Boolean, etc
    default: false
  });
}

export function updateEscalatorDisplay() {
  const value = game.settings.get('sdm', 'escalatorDie');
  const container = document.getElementById('escalator-die');
  const display = document.getElementById('escalator-value');

  if (!container || !display) return;

  display.textContent = value;
  container.style.display = value > 0 ? 'block' : 'none';

  // Optional: Change icon color when active
  const img = container.querySelector('img');
  img.style.filter =
    value > 0 ? 'drop-shadow(0 0 4px #FF0000)' : 'drop-shadow(0 0 4px rgba(0,0,0,0.5))';
}

export function createEscalatorDieDisplay() {
  const escalatorContainer = document.createElement('div');
  escalatorContainer.id = 'escalator-die';
  escalatorContainer.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    display: none;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  `;

  // Create header element
  const headerText = document.createElement('div');
  headerText.textContent = $l10n('SDM.EscalatorDie');
  headerText.style.cssText = `
    color: white;
    font-weight: bold;
    text-shadow: 1px 1px 2px black;
    font-size: 0.9em;
    white-space: nowrap;
    background: rgba(0,0,0,0.7);
    padding: 2px 8px;
    border-radius: 3px;
    text-align: center;
  `;

  // Create image container
  const imageContainer = document.createElement('div');
  imageContainer.style.cssText = `
    position: relative;
    width: 50px;
    height: 50px;
    margin: 0 auto;
  `;

  // Create d20 image element
  const diceImage = document.createElement('img');
  diceImage.src = 'icons/svg/d20-grey.svg';
  diceImage.style.cssText = `
    width: 100%;
    height: 100%;
    filter: drop-shadow(0 0 4px rgba(0,0,0,0.5));
    position: absolute;
    left: 0;
    top: 0;
  `;

  // Create value display element
  const valueDisplay = document.createElement('div');
  valueDisplay.id = 'escalator-value';
  valueDisplay.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-weight: bold;
    font-size: 1.4em;
    text-shadow: 1px 1px 2px black;
    pointer-events: none;
  `;

  // Assemble elements
  imageContainer.append(diceImage, valueDisplay);
  escalatorContainer.append(headerText, imageContainer);
  document.body.appendChild(escalatorContainer);
  updateEscalatorDisplay();
}

export function configureUseHeroDiceButton(message, html, data) {
  if (!message) return;

  //const isInitiativeRoll = message?.getFlag("core", 'initiativeRoll');
  const isHeroResult = !!message?.getFlag('sdm', 'isHeroResult');
  const isRollTableMessage = !!message?.getFlag('core', 'RollTable');
  const isAbilityScoreRoll = !!message?.getFlag('sdm', 'isAbilityScoreRoll');
  const flags = message.flags;
  if (isRollTableMessage || isAbilityScoreRoll) return;

  if (isHeroResult) {
    $('button.hero-dice-btn').remove();
  }

  // Find the most recent roll message in chat
  const lastRollMessage = [...game.messages.contents]
    .reverse()
    .find(m => m.isRoll || m?.getFlag('sdm', 'isHeroResult'));

  if (lastRollMessage?.getFlag('sdm', 'isHeroResult')) {
    $('button.hero-dice-btn').remove();
    return;
  }

  // if (!lastRollMessage.rolls?.[0]?.dice?.some(d => d.faces === 20)) return;

  // Only proceed if this is the most recent d20 roll message
  if (!lastRollMessage || message.id !== lastRollMessage.id) return;
  // Only show if user has a character with hero dice

  // Get Actor from selected token, or default character for the Actor if none is.
  const actor = game.user?.character || canvas?.tokens?.controlled[0]?.actor;
  const isGM = game.user.isGM;
  if (!actor && !isGM) return;

  // Check hero_dice
  const hero_dice = actor?.system?.hero_dice?.value;
  if (!isGM && (!hero_dice || hero_dice < 1)) return;

  if (message.content.includes('fumble')) {
    return;
  }

  // Create button element
  const btn = document.createElement('button');
  btn.classList.add('hero-dice-btn');
  btn.dataset.messageId = message.id;

  // Create icon element
  const icon = document.createElement('i');
  const defaultHeroDiceType = game.settings.get('sdm', 'defaultHeroDiceType');
  const actorHeroDice = actor?.system?.hero_dice?.dice_type || defaultHeroDiceType;

  icon.classList.add('die-label', `dice-${actorHeroDice}`);
  btn.appendChild(icon);

  // Add localized text
  btn.append(` ${$l10n('SDM.RollUseHeroDice')}`);

  // Create container div
  const container = document.createElement('div');
  container.classList.add('flex', 'flex-group-center');
  container.appendChild(btn);

  // Find message content and append
  const messageContent = html.querySelector('.message-content');
  if (messageContent) {
    messageContent.appendChild(container);
  }

  // Add event listener
  btn.addEventListener('click', ev => {
    ev.preventDefault();
    ev.stopPropagation();
    handleHeroDice(ev, message, flags);
  });
}

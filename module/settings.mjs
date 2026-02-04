import { DEFAULT_CASH_ICON, DiceType } from './helpers/constants.mjs';
import { $fmt, $l10n } from './helpers/globalUtils.mjs';
import { handleHeroDice } from './rolls/hero_dice/index.mjs';

export const BASE_REACTION_FORMULA = '2d6';
export const BASE_DEFEAT_FORMULA = '2d6';
export const BASE_CORRUPTION_FORMULA = '2d6';
export const CHARACTER_DEFAULT_INITIATIVE = '2d6 + @abilities.agi.current + @initiative_bonus';
export const NPC_DEFAULT_INITIATIVE = '2d6 + @bonus';
export const NPC_DEFAULT_MORALE_FORMULA = '2d6';
export const SAVING_THROW_BASE_FORMULA = '1d20x';
export const DEFAULT_LEVEL_UP_SOUND =
  'systems/sdm/assets/audio/sound_effects/single_church_bell.mp3';
export const DEFAULT_MAX_POWERS = 3;
export const DEFAULT_HARD_LIMIT = 13;
export const DEFAULT_SAVE_VALUE = 13;

export function registerSystemSettings() {
  /* -------------------------------------------- */
  /*  System settings registration                */
  /* -------------------------------------------- */

  /** qol settings */

  game.settings.register('sdm', 'chromatype', {
    name: 'SDM.SettingsChromatype',
    hint: 'SDM.SettingsChromatypeHint',
    scope: 'client', // or "world"
    requiresReload: true,
    choices: CONFIG.SDM.accentColorOptions,
    type: String,
    default: 'teal'
  });

  game.settings.register('sdm', 'diceSoNiceChromatype', {
    name: 'SDM.SettingsDiceSoNiceChromatype',
    hint: 'SDM.SettingsDiceSoNiceChromatypeHint',
    scope: 'client', // or "world"
    requiresReload: true,
    choices: {
      same: 'SDM.DSNChromatypeSame',
      ...CONFIG.SDM.accentColorOptions
    },
    type: String,
    default: 'same'
  });

  game.settings.register('sdm', 'diceSoNiceChromatype', {
    name: 'SDM.SettingsDiceSoNiceChromatype',
    hint: 'SDM.SettingsDiceSoNiceChromatypeHint',
    scope: 'client', // or "world"
    requiresReload: true,
    choices: {
      same: 'SDM.DSNChromatypeSame',
      ...CONFIG.SDM.accentColorOptions
    },
    type: String,
    default: 'same'
  });

  game.settings.register('sdm', 'hero_dice_style', {
    name: 'SDM.SettingsHeroDiceStyle',
    hint: 'SDM.SettingsHeroDiceStyleHint',
    scope: 'client', // or "world"
    requiresReload: true,
    type: String,
    choices: CONFIG.SDM.diceThemeOptions,
    default: 'sdm-black'
  });

  game.settings.register('sdm', 'blood_dice_style', {
    name: 'SDM.SettingsBloodDiceStyle',
    hint: 'SDM.SettingsBloodDiceStyleHint',
    scope: 'client', // or "world"
    requiresReload: true,
    type: String,
    choices: CONFIG.SDM.diceThemeOptions,
    default: 'sdm-crimson'
  });

  game.settings.register('sdm', 'tourist_dice_style', {
    name: 'SDM.SettingsTouristDiceStyle',
    hint: 'SDM.SettingsTouristDiceStyleHint',
    scope: 'client', // or "world"
    requiresReload: true,
    type: String,
    choices: CONFIG.SDM.diceThemeOptions,
    default: 'sdm-green'
  });

  game.settings.register('sdm', 'oracle_dice_style', {
    name: 'SDM.SettingsOracleDiceStyle',
    hint: 'SDM.SettingsOracleDiceStyleHint',
    scope: 'client', // or "world"
    requiresReload: true,
    type: String,
    choices: CONFIG.SDM.diceThemeOptions,
    default: 'sdm-oracle'
  });

  game.settings.register('sdm', 'initiativeTieBreak', {
    name: 'SDM.SettingsInitiativeTiebreak',
    hint: 'SDM.SettingsInitiativeTiebreakHint',
    scope: 'world',
    restricted: true,
    type: Boolean,
    default: true
  });

  game.settings.register('sdm', 'groupPlayersToFriendlyTokens', {
    name: 'SDM.SettingsGroupPlayersToFriendlyTokens',
    hint: 'SDM.SettingsGroupPlayersToFriendlyTokensHint',
    scope: 'world',
    restricted: true,
    type: Boolean,
    default: true
  });

  game.settings.register('sdm', 'rerollInitiativeEveryRound', {
    name: 'SDM.SettingsRerollInitiativeEveryRound',
    hint: 'SDM.SettingsRerollInitiativeEveryRoundHint',
    scope: 'world',
    restricted: true,
    type: Boolean,
    default: true
  });

  game.settings.register('sdm', 'reverseShiftKey', {
    name: 'SDM.SettingsReverseShiftKey',
    hint: 'SDM.SettingsReverseShiftKeyHint',
    scope: 'client',
    type: Boolean,
    default: false
  });

  /** game world settings */

  game.settings.register('sdm', 'currencyName', {
    name: 'SDM.SettingsCurrencyName',
    hint: 'SDM.SettingsCurrencyNameHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    type: String, // Data type: String, Number, Boolean, etc
    default: 'cash'
  });

  game.settings.register('sdm', 'currencyImage', {
    name: 'SDM.SettingsCurrencyImg',
    hint: 'SDM.SettingsCurrencyImgHint',
    scope: 'world',
    restricted: true,
    type: new foundry.data.fields.FilePathField({
      categories: ['IMAGE'],
      default: DEFAULT_CASH_ICON
    }),
    default: DEFAULT_CASH_ICON
  });

  game.settings.register('sdm', 'shouldPlayLevelUpSoundFx', {
    name: 'SDM.SettingsShouldPlayLevelUpSoundFx',
    hint: 'SDM.SettingsShouldPlayLevelUpSoundFxHint',
    scope: 'client',
    type: Boolean,
    default: false,
    requiresReload: false
  });

  game.settings.register('sdm', 'levelUpSoundFx', {
    name: 'SDM.SettingsLevelUpSoundFx',
    hint: 'SDM.SettingsLevelUpSoundFxHint',
    scope: 'world',
    restricted: true,
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

  /** sdm rules settings */

  game.settings.register('sdm', 'useHardLimitRule', {
    name: 'SDM.SettingsUseHardLimitRule',
    hint: 'SDM.SettingsUseHardLimitRuleHint',
    scope: 'world',
    restricted: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });

  game.settings.register('sdm', 'defaultHardLimitValue', {
    name: 'SDM.SettingsDefaultHardLimitValue',
    hint: 'SDM.SettingsDefaultHardLimitValueHint',
    scope: 'world',
    restricted: true,
    type: Number,
    default: DEFAULT_HARD_LIMIT,
    onChange: value => {
      if (!value || value <= 0) {
        game.settings.set('sdm', 'defaultHardLimitValue', DEFAULT_HARD_LIMIT);
      }
    },
    requiresReload: true
  });

  game.settings.register('sdm', 'luckySevenRule', {
    name: 'SDM.SettingsLuckySevenRule',
    hint: 'SDM.SettingsLuckySevenRuleHint',
    scope: 'world',
    restricted: true,
    type: Boolean,
    default: false,
    requiresReload: false
  });

  game.settings.register('sdm', 'defaultMaxPowers', {
    name: 'SDM.SettingsDefaultMaxPowers',
    hint: 'SDM.SettingsDefaultMaxPowersHint',
    scope: 'world',
    restricted: true,
    type: Number,
    default: DEFAULT_MAX_POWERS,
    onChange: value => {
      if (!value || value <= 0) {
        game.settings.set('sdm', 'defaultMaxPowers', DEFAULT_MAX_POWERS);
      }
    },
    requiresReload: true
  });

  /** rules customization settings */

  game.settings.register('sdm', 'skillModifierStep', {
    name: 'SDM.SettingsSkillModifierStep',
    hint: 'SDM.SettingsSkillModifierStepHint',
    scope: 'world',
    restricted: true,
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
    type: Boolean,
    default: false,
    requiresReload: true
  });

  game.settings.register('sdm', 'escalatorDie', {
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

  game.settings.register('sdm', 'oracleDice', {
    scope: 'client', // "world" = GM only, "client" = per user
    config: false, // Show in configuration view
    type: String, // Data type: String, Number, Boolean, etc
    default: 'quick-d6',
    choices: ['quick-d6', 'bell-2d6', 'd10-oracle', 'bell-2d10', 'skilled-d20']
  });

  game.settings.register('sdm', 'bonusHeroDicePool', {
    scope: 'world',
    config: false,
    type: Number,
    default: 0,
    onChange: value => {
      updateBonusHeroDiceDisplay();
    }
  });

  game.settings.register('sdm', 'escalatorPosition', {
    scope: 'world',
    config: false,
    type: Object,
    default: { top: '20px', left: '50%' },
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
    requiresReload: true,
    type: Number, // Data type: String, Number, Boolean, etc
    default: DEFAULT_SAVE_VALUE
  });

  game.settings.register('sdm', 'baseDefense', {
    name: 'SDM.SettingsBaseDefense',
    hint: 'SDM.SettingsBaseDefenseHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    requiresReload: true,
    type: Number, // Data type: String, Number, Boolean, etc
    default: 7
  });

  game.settings.register('sdm', 'baseMentalDefense', {
    name: 'SDM.SettingsBaseMentalDefense',
    hint: 'SDM.SettingsBaseMentalDefenseHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    requiresReload: true,
    type: Number, // Data type: String, Number, Boolean, etc
    default: 7
  });

  game.settings.register('sdm', 'baseSocialDefense', {
    name: 'SDM.SettingsBaseSocialDefense',
    hint: 'SDM.SettingsBaseSocialDefenseHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    requiresReload: true,
    type: Number, // Data type: String, Number, Boolean, etc
    default: 7
  });

  game.settings.register('sdm', 'baseTraitSlots', {
    name: 'SDM.SettingsBaseTraitSlots',
    hint: 'SDM.SettingsBaseTraitSlotsHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    requiresReload: true,
    type: Number, // Data type: String, Number, Boolean, etc
    default: 7
  });

  game.settings.register('sdm', 'baseItemSlots', {
    name: 'SDM.SettingsBaseItemSlots',
    hint: 'SDM.SettingsBaseItemSlotsHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    requiresReload: true,
    type: Number, // Data type: String, Number, Boolean, etc
    default: 7
  });

  game.settings.register('sdm', 'baseBurdenSlots', {
    name: 'SDM.SettingsBaseBurdenSlots',
    hint: 'SDM.SettingsBaseBurdenSlotsHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    requiresReload: true,
    type: Number, // Data type: String, Number, Boolean, etc
    default: 20
  });

  game.settings.register('sdm', 'baseMoraleFormula', {
    name: 'SDM.SettingsBaseMoraleFormula',
    hint: 'SDM.SettingsBaseMoraleFormulaHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    requiresReload: true,
    type: String, // Data type: String, Number, Boolean, etc
    default: NPC_DEFAULT_MORALE_FORMULA
  });

  game.settings.register('sdm', 'baseReactionFormula', {
    name: 'SDM.SettingsBaseReactionFormula',
    hint: 'SDM.SettingsBaseReactionFormulaHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    requiresReload: true,
    type: String, // Data type: String, Number, Boolean, etc
    default: BASE_REACTION_FORMULA
  });

  game.settings.register('sdm', 'baseCorruptionFormula', {
    name: 'SDM.SettingsBaseCorruptionFormula',
    hint: 'SDM.SettingsBaseCorruptionFormulaHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    requiresReload: true,
    type: String, // Data type: String, Number, Boolean, etc
    default: BASE_CORRUPTION_FORMULA
  });

  game.settings.register('sdm', 'baseDefeatFormula', {
    name: 'SDM.SettingsBaseDefeatFormula',
    hint: 'SDM.SettingsBaseDefeatFormulaHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    requiresReload: true,
    type: String, // Data type: String, Number, Boolean, etc
    default: BASE_DEFEAT_FORMULA
  });

  game.settings.register('sdm', 'defaultHeroDiceType', {
    name: 'SDM.SettingsDefaultHeroDiceType',
    hint: 'SDM.SettingsDefaultHeroDiceTypeHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
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
    type: String, // Data type: String, Number, Boolean, etc
    default: SAVING_THROW_BASE_FORMULA,
    requiresReload: true,
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
    type: String, // Data type: String, Number, Boolean, etc
    default: CHARACTER_DEFAULT_INITIATIVE,
    requiresReload: true,
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
    type: String, // Data type: String, Number, Boolean, etc
    default: NPC_DEFAULT_INITIATIVE,
    requiresReload: true,
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
    type: Boolean, // Data type: String, Number, Boolean, etc
    default: false
  });

  game.settings.register('sdm', 'seasonsStarsIntegration', {
    name: 'SDM.SettingsSeasonStarsIntegration',
    hint: 'SDM.SettingsSeasonStarsIntegrationHint',
    scope: 'world', // "world" = GM only, "client" = per user
    restricted: true,
    type: Boolean, // Data type: String, Number, Boolean, etc
    default: false,
    onChange: value => {
      const hasSeasonsModule = game.seasonsStars;
      let language = game.i18n.lang.toLowerCase();
      if (language !== 'pt-br') {
        language = 'en';
      }
      const rainbowlands = 'rainbowlands';
      const rainbowlandsLang = `${rainbowlands}-${language}`;
      const calendars = game.seasonsStars ? game.seasonsStars.api.getAvailableCalendars() : [];
      const oldVersionCalendar = calendars.includes(rainbowlands);
      const hasRainbowlandsCalendar = calendars.includes(rainbowlandsLang);
      const calendarToUse = hasRainbowlandsCalendar ? rainbowlandsLang : rainbowlands;

      if (!value) return;

      if (value && hasSeasonsModule && (hasRainbowlandsCalendar || oldVersionCalendar)) {
        game.seasonsStars.api.setActiveCalendar(calendarToUse);
      } else {
        ui.notifications.error($l10n('SDM.seasonsStarsIntegrationError'));
        game.settings.set('sdm', 'seasonsStarsIntegration', false);
      }
    }
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
  const savedPosition = game.settings.get('sdm', 'escalatorPosition') || {
    top: '20px',
    left: '50%'
  };

  const escalatorContainer = document.createElement('div');
  escalatorContainer.id = 'escalator-die';
  escalatorContainer.style.cssText = `
    position: fixed;
    top: ${savedPosition.top};
    left: ${savedPosition.left};
    transform: translateX(-50%);
    z-index: 100;
    display: none;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    cursor: grab;
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
    margin-bottom: 5px;
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

  if (game.user.isGM) {
    makeDraggable(escalatorContainer, headerText);
  }

  updateEscalatorDisplay();
}

function makeDraggable(element, handle) {
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  element.addEventListener('mousedown', event => {
    isDragging = true;
    offsetX = event.clientX - element.offsetLeft;
    offsetY = event.clientY - element.offsetTop;
    element.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none'; // prevent text selection
  });

  document.addEventListener('mousemove', event => {
    if (!isDragging) return;
    element.style.left = event.clientX - offsetX + 'px';
    element.style.top = event.clientY - offsetY + 'px';
    element.style.right = 'auto';
    element.style.bottom = 'auto';
    element.style.transform = 'none'; // disable centering once user moves it
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      element.style.cursor = 'grab';
      document.body.style.userSelect = '';
      if (game.user.isGM) {
        // Save new position in settings
        game.settings.set('sdm', 'escalatorPosition', {
          left: element.style.left,
          top: element.style.top
        });

        // Broadcast to other clients so they update immediately
        game.socket.emit('system.sdm', {
          type: 'updateEscalatorPosition',
          position: {
            left: element.style.left,
            top: element.style.top
          }
        });
      }
    }
  });
}

export function setupEscalatorDiePositionBroadcast() {
  game.socket.on('system.sdm', data => {
    if (data.type === 'updateEscalatorPosition' && !game.user.isGM) {
      const container = document.getElementById('escalator-die');
      if (container) {
        container.style.top = data.position.top;
        container.style.left = data.position.left;
        container.style.transform = 'none';
      }
    }
  });
}

export function configureUseHeroDiceButton(message, html, data) {
  if (!message) return;

  // Guards — keep the original exclusions
  const isHeroResult = !!message?.getFlag('sdm', 'isHeroResult');
  const isRollTableMessage = !!message?.getFlag('core', 'RollTable');
  const isAbilityScoreRoll = !!message?.getFlag('sdm', 'isAbilityScoreRoll');
  const noHeroDice = !!message?.getFlag('sdm', 'noHeroDice');
  const flags = message.flags;
  if (isRollTableMessage || isAbilityScoreRoll || noHeroDice) return;

  // Remove existing buttons if the message is already a hero result
  if (isHeroResult) {
    $('button.hero-dice-btn').remove();
    $('button.blood-dice-btn').remove();
  }

  // Find the most recent roll message in chat (same logic as before)
  const lastRollMessage = [...game.messages.contents]
    .reverse()
    .find(m => m.isRoll || m?.getFlag('sdm', 'isHeroResult'));

  if (lastRollMessage?.getFlag('sdm', 'isHeroResult')) {
    $('button.hero-dice-btn').remove();
    $('button.blood-dice-btn').remove();
    return;
  }

  // Only proceed if this is the most recent roll message
  if (!lastRollMessage || message.id !== lastRollMessage.id) return;

  // Get Actor from selected token, or default character for the Actor if none is.
  const actor = game.user?.character || canvas?.tokens?.controlled[0]?.actor;
  const isGM = game.user.isGM;
  if (!actor && !isGM) return;

  // Do not show for fumbles (preserve original early return)
  if (message.content.includes('fumble')) return;

  // --- HERO DICE BUTTON (original behaviour) ---
  // Create hero-dice button element
  const heroBtn = document.createElement('button');
  heroBtn.classList.add('hero-dice-btn');
  heroBtn.dataset.messageId = message.id;

  const heroIcon = document.createElement('i');
  const defaultHeroDiceType = game.settings.get('sdm', 'defaultHeroDiceType');
  const actorHeroDice = actor?.system?.hero_dice?.dice_type || defaultHeroDiceType;
  heroIcon.classList.add('fa-solid', `fa-dice-${actorHeroDice}`);
  heroBtn.appendChild(heroIcon);

  heroBtn.append(` ${$l10n('SDM.RollUseHeroDice')}`);

  // Append hero button (container)
  const heroContainer = document.createElement('div');
  heroContainer.classList.add('flex', 'flex-group-center');
  heroContainer.appendChild(heroBtn);

  const messageContent = html.querySelector('.message-content');
  if (messageContent) {
    messageContent.appendChild(heroContainer);
  }

  // Hero button handler (unchanged call site)
  heroBtn.addEventListener('click', ev => {
    ev.preventDefault();
    ev.stopPropagation();
    // existing function assumed to exist
    handleHeroDice(ev, message, flags);
  });
}

export function configurePlayerChromatype() {
  const color = game.settings.get('sdm', 'chromatype');
  const dsnColor = game.settings.get('sdm', 'diceSoNiceChromatype');

  const dsnFinalColor = dsnColor === 'same' ? color : dsnColor;

  const DICE_SCALE = {
    d2: 1,
    d4: 0.8,
    d6: 1.25,
    d8: 0.75,
    d10: 0.75,
    d12: 1,
    d20: 0.75,
    d3: 1,
    d5: 0.75,
    df: 2,
    d100: 0.6
  };

  const colorMapping = {
    aqua: {
      hex: '#07cfcfd0',
      rgb: 'rgba(0, 255, 255, 0.2)',
      dice: {
        foreground: '#301B3F',
        background: '#07cfcfe0',
        edge: '#301B3F'
      }
    },
    red: {
      hex: '#E25C65',
      rgb: 'rgba(226, 92, 101, 0.2)',
      dice: {
        foreground: '#177a74ff',
        background: '#E25C65'
      }
    },
    orange: {
      hex: '#EC843D',
      rgb: 'rgba(236, 132, 61, 0.2)',
      dice: {
        foreground: '#0075DB',
        background: '#EC843D'
      }
    },
    yellow: {
      hex: '#D5CC63',
      rgb: 'rgba(213, 204, 99, 0.3)',
      dice: {
        foreground: '#48C5C7',
        background: '#D5CC63'
      }
    },
    green: {
      hex: '#688B75',
      rgb: 'rgba(104, 139, 117, 0.3)',
      dice: {
        foreground: '#463629',
        background: '#688B75'
      }
    },
    blue: {
      hex: '#497DAD',
      rgb: 'rgba(73, 125, 173, 0.25)',
      dice: {
        foreground: '#D27F23',
        background: '#497DAD'
      }
    },
    purple: {
      hex: '#785DAA',
      rgb: 'rgba(120, 93, 170, 0.2)',
      dice: {
        foreground: '#8faa5d',
        background: '#785DAA'
      }
    },
    violet: {
      hex: '#B10FD4',
      rgb: 'rgba(177, 15, 212, 0.2)',
      dice: {
        foreground: '#000000',
        background: '#B10FD4',
        edge: '#000000'
      }
    },
    pink: {
      hex: '#CF6188',
      rgb: 'rgba(207, 97, 136, 0.2)',
      dice: {
        foreground: '#362e63ff',
        background: '#CF6188',
        edge: '#362e63ff'
      }
    },
    ultraviolet: {
      hex: '#7A00FF',
      rgb: 'rgba(122, 0, 255, 0.2)',
      dice: {
        foreground: '#E5CCFF',
        background: '#7A00FF',
        edge: '#E5CCFF'
      }
    },
    teal: {
      hex: '#00817F',
      rgb: 'rgba(0, 129, 127, 0.15)',
      dice: {
        foreground: '#FFFF99',
        background: '#00817F'
      }
    },
    brown: {
      hex: '#8b4513',
      rgb: 'rgba(139, 69, 19, 0.1)',
      dice: {
        foreground: '#3098E3',
        background: '#8b4513',
        edge: '#3098E3'
      }
    },
    black: {
      hex: '#000000',
      rgb: 'rgba(0, 0, 0, 0.25)',
      dice: {
        foreground: '#f0f0f0ff',
        background: '#000000',
        edge: '#f0f0f0ff'
      }
    },
    white: {
      hex: 'rgba(255, 255, 255, 0.5)',
      rgb: 'rgba(255, 255, 255, 0.5)',
      dice: {
        foreground: '#462A8F',
        background: '#ffffff8c',
        edge: '#462A8F'
      }
    },
    gold: {
      hex: '#AD8C3F',
      rgb: 'rgba(173, 140, 63, 0.2)',
      dice: {
        foreground: '#0E245A',
        background: '#AD8C3F',
        edge: '#0E245A'
      }
    },
    silver: {
      hex: '#6e6e6e',
      rgb: 'rgba(192, 192, 192, 0.15)',
      dice: {
        foreground: '#f8f8f8ff',
        background: '#6e6e6e',
        edge: '#f8f8f8ff'
      }
    },
    crimson: {
      hex: '#660000',
      rgb: 'rgba(153, 0, 0, 0.15)',
      dice: {
        foreground: '#CFFCF7',
        background: '#660000',
        edge: '#CFFCF7'
      }
    },
    emerald: {
      hex: '#1e7d43',
      rgb: 'rgba(80, 200, 120, 0.15)',
      dice: {
        foreground: '#FADADD',
        background: '#1e7d43',
        edge: '#FADADD'
      }
    },
    olive: {
      hex: '#4a4a00',
      rgb: 'rgba(128, 128, 0, 0.15)',
      dice: {
        foreground: '#EAF0B1',
        background: '#4a4a00',
        edge: '#EAF0B1'
      }
    },
    lime: {
      hex: '#39FF14',
      rgb: 'rgba(57, 255, 20, 0.2)',
      dice: {
        foreground: '#462A8F',
        background: '#39FF14',
        edge: '#462A8F'
      }
    },
    neonPurple: {
      hex: '#FF02FF',
      rgb: 'rgba(255, 2, 255, 0.3)',
      dice: {
        foreground: '#000000',
        background: '#FF02FF',
        edge: '#000000'
      }
    },
    neonYellow: {
      hex: '#FFFF33',
      rgb: 'rgba(255, 255, 51, 0.3)',
      dice: {
        foreground: '#202040',
        background: '#FFFF33',
        edge: '#202040'
      }
    },
    neonRose: {
      hex: '#FF007F',
      rgb: 'rgba(255, 0, 127, 0.25)',
      dice: {
        foreground: '#000000',
        background: '#FF007F',
        edge: '#000000'
      }
    },
    mint: {
      hex: '#3FFFBF',
      rgb: 'rgba(63, 255, 191, 0.25)',
      dice: {
        foreground: '#102020',
        background: '#3FFFBF',
        edge: '#102020'
      }
    },
    electricBlue: {
      hex: '#00BFFF',
      rgb: 'rgba(0, 191, 255, 0.25)',
      dice: {
        foreground: '#101010',
        background: '#00BFFF',
        edge: '#101010'
      }
    },
    tangerine: {
      hex: '#FF7E00',
      rgb: 'rgba(255, 126, 0, 0.25)',
      dice: {
        foreground: '#002244',
        background: '#FF7E00',
        edge: '#002244'
      }
    },
    ice: {
      hex: '#AFFFFF',
      rgb: 'rgba(175, 255, 255, 0.25)',
      dice: {
        foreground: '#003344',
        background: '#AFFFFF',
        edge: '#003344'
      }
    },
    sky: {
      hex: '#87CEFA',
      rgb: 'rgba(135, 206, 250, 0.25)',
      dice: {
        foreground: '#103050',
        background: '#87CEFA',
        edge: '#103050'
      }
    },
    roseGold: {
      hex: '#B76E79',
      rgb: 'rgba(183, 110, 121, 0.25)',
      dice: {
        foreground: '#2C0E10',
        background: '#B76E79',
        edge: '#2C0E10'
      }
    }
  };

  const selectedColor = colorMapping[color];
  const dice3DColor = colorMapping[dsnFinalColor].dice;
  const { foreground, background, edge } = dice3DColor;

  const rainbow = ['purple', 'red', 'orange', 'yellow', 'green', 'blue'];
  const foregroundRainbow = rainbow.map(color => colorMapping[color].dice.foreground);
  const backgroundRainbow = rainbow.map(color => colorMapping[color].dice.background);

  const neon = [
    'neonPurple',
    'lime',
    'ultraviolet',
    'aqua',
    'tangerine',
    'neonRose',
    'neonYellow',
    'mint',
    'electricBlue'
  ];
  const foregroundNeon = neon.map(color => colorMapping[color].dice.foreground);
  const backgroundNeon = neon.map(color => colorMapping[color].dice.background);

  const luxury = ['olive', 'emerald', 'crimson', 'silver', 'gold', 'roseGold'];
  const foregroundLuxury = luxury.map(color => colorMapping[color].dice.foreground);
  const backgroundLuxury = luxury.map(color => colorMapping[color].dice.background);

  // 1) pastel: soft, gentle tones
  const pastel = ['mint', 'ice', 'sky', 'pink', 'roseGold', 'aqua'];
  const foregroundPastel = pastel.map(color => colorMapping[color].dice.foreground);
  const backgroundPastel = pastel.map(color => colorMapping[color].dice.background);

  // 2) earth: grounded, natural tones
  const earth = ['brown', 'olive', 'green', 'emerald', 'gold'];
  const foregroundEarth = earth.map(color => colorMapping[color].dice.foreground);
  const backgroundEarth = earth.map(color => colorMapping[color].dice.background);

  // 3) warm: fire / sun palette
  const warm = ['red', 'crimson', 'orange', 'tangerine', 'gold', 'yellow'];
  const foregroundWarm = warm.map(color => colorMapping[color].dice.foreground);
  const backgroundWarm = warm.map(color => colorMapping[color].dice.background);

  // 4) cool: water / sky / futuristic
  const cool = ['aqua', 'electricBlue', 'ice', 'teal', 'ultraviolet'];
  const foregroundCool = cool.map(color => colorMapping[color].dice.foreground);
  const backgroundCool = cool.map(color => colorMapping[color].dice.background);

  // 5) dark: moody, deep tones
  const dark = ['black', 'brown', 'crimson', 'olive', 'purple', 'violet'];
  const foregroundDark = dark.map(color => colorMapping[color].dice.foreground);
  const backgroundDark = dark.map(color => colorMapping[color].dice.background);

  // 6) light: bright / near-white highlights
  const light = ['white', 'ice', 'mint', 'sky', 'aqua', 'yellow'];
  const foregroundLight = light.map(color => colorMapping[color].dice.foreground);
  const backgroundLight = light.map(color => colorMapping[color].dice.background);

  // 7) romantic: soft warm/purple/pink mix
  const romantic = ['pink', 'roseGold', 'neonRose', 'purple', 'violet', 'gold'];
  const foregroundRomantic = romantic.map(color => colorMapping[color].dice.foreground);
  const backgroundRomantic = romantic.map(color => colorMapping[color].dice.background);

  // 8) metallic: shiny / reflective tones
  const metallic = ['silver', 'gold', 'roseGold'];
  const foregroundMetallic = metallic.map(color => colorMapping[color].dice.foreground);
  const backgroundMetallic = metallic.map(color => colorMapping[color].dice.background);

  // 9) bright: high-visibility lively colors
  const bright = ['yellow', 'lime', 'tangerine', 'pink', 'electricBlue'];
  const foregroundBright = bright.map(color => colorMapping[color].dice.foreground);
  const backgroundBright = bright.map(color => colorMapping[color].dice.background);

  // 10) royal: rich, regal tones
  const royal = ['emerald', 'crimson', 'violet', 'gold', 'purple'];
  const foregroundRoyal = royal.map(color => colorMapping[color].dice.foreground);
  const backgroundRoyal = royal.map(color => colorMapping[color].dice.background);

  Hooks.once('diceSoNiceInit', dice3d => {
    if (dice3d) {
      const colorData = {
        name: 'sdm-chromatype',
        description: $l10n('SDM.DiceTheme.Chromatype'),
        category: 'SDM: Chromatype Dice',
        foreground: [foreground],
        background: [background],
        outline: 'black',
        texture: 'none',
        material: 'plastic',
        font: 'Our Golden Age',
        fontScale: DICE_SCALE
      };

      if (edge) {
        colorData.edge = [edge];
      }
      dice3d.addColorset(colorData);

      const rainbowData = {
        name: 'sdm-rainbowlands',
        description: $l10n('SDM.DiceTheme.Rainbowlands'),
        category: 'SDM: Theme',
        foreground: foregroundRainbow,
        background: backgroundRainbow,
        outline: 'black',
        texture: 'none',
        material: 'plastic',
        font: 'Our Golden Age',
        fontScale: DICE_SCALE
      };
      dice3d.addColorset(rainbowData);

      const neonData = {
        name: 'sdm-neon',
        description: $l10n('SDM.DiceTheme.Neon'),
        category: 'SDM: Theme',
        foreground: foregroundNeon,
        background: backgroundNeon,
        outline: 'black',
        texture: 'none',
        material: 'plastic',
        font: 'Bitcount Single',
        fontScale: DICE_SCALE
      };
      dice3d.addColorset(neonData);

      const luxuryData = {
        name: 'sdm-luxury',
        description: $l10n('SDM.DiceTheme.Luxury'),
        category: 'SDM: Theme',
        foreground: foregroundLuxury,
        background: backgroundLuxury,
        outline: 'black',
        texture: 'none',
        material: 'plastic',
        font: 'Bonheur Royale'
      };
      dice3d.addColorset(luxuryData);

      // const pastelData = {
      //   name: 'sdm-pastel',
      //   description: 'SDM Pastel Dice',
      //   category: 'Colors',
      //   foreground: foregroundPastel,
      //   background: backgroundPastel,
      //   outline: 'black',
      //   texture: 'none',
      //   material: 'plastic',
      //   font: 'Our Golden Age',
      //   fontScale: DICE_SCALE
      // };
      // dice3d.addColorset(pastelData);

      // const earthData = {
      //   name: 'sdm-earth',
      //   description: 'SDM Earth Dice',
      //   category: 'Colors',
      //   foreground: foregroundEarth,
      //   background: backgroundEarth,
      //   outline: 'black',
      //   texture: 'none',
      //   material: 'plastic',
      //   font: 'Our Golden Age',
      //   fontScale: DICE_SCALE
      // };
      // dice3d.addColorset(earthData);

      for (let colorValue of Object.keys(colorMapping)) {
        const diceData = {
          name: `sdm-${colorValue}`,
          description: $l10n(CONFIG.SDM.accentColorOptions[colorValue]),
          category: 'SDM: Color',
          foreground: colorMapping[colorValue].dice.foreground,
          background: colorMapping[colorValue].dice.background,
          outline: 'black',
          texture: 'none',
          material: 'plastic',
          font: 'Our Golden Age',
          fontScale: DICE_SCALE
        };

        if (colorMapping[colorValue].dice.edge) {
          diceData['edge'] = colorMapping[colorValue].dice.edge;
        }

        dice3d.addColorset(diceData);
      }

      const warmData = {
        name: 'sdm-warm',
        description: $l10n('SDM.DiceTheme.Warm'),
        category: 'SDM: Theme',
        foreground: foregroundWarm,
        background: backgroundWarm,
        outline: 'black',
        texture: 'none',
        material: 'plastic',
        font: 'Our Golden Age',
        fontScale: DICE_SCALE
      };
      dice3d.addColorset(warmData);

      const coolData = {
        name: 'sdm-cool',
        description: $l10n('SDM.DiceTheme.Cool'),
        category: 'SDM: Theme',
        foreground: foregroundCool,
        background: backgroundCool,
        outline: 'black',
        texture: 'none',
        material: 'plastic',
        font: 'Our Golden Age',
        fontScale: DICE_SCALE
      };
      dice3d.addColorset(coolData);

      const darkData = {
        name: 'sdm-dark',
        description: $l10n('SDM.DiceTheme.Dark'),
        category: 'SDM: Theme',
        foreground: foregroundDark,
        background: backgroundDark,
        outline: 'black',
        texture: 'none',
        material: 'plastic',
        font: 'Our Golden Age',
        fontScale: DICE_SCALE
      };
      dice3d.addColorset(darkData);

      const lightData = {
        name: 'sdm-light',
        description: $l10n('SDM.DiceTheme.Light'),
        category: 'SDM: Theme',
        foreground: foregroundLight,
        background: backgroundLight,
        outline: 'black',
        texture: 'none',
        material: 'plastic',
        font: 'Our Golden Age',
        fontScale: DICE_SCALE
      };
      dice3d.addColorset(lightData);

      const romanticData = {
        name: 'sdm-romantic',
        description: $l10n('SDM.DiceTheme.Romantic'),
        category: 'SDM: Theme',
        foreground: foregroundRomantic,
        background: backgroundRomantic,
        outline: 'black',
        texture: 'none',
        material: 'plastic',
        font: 'Bonheur Royale'
      };
      dice3d.addColorset(romanticData);

      const mysticOracle = {
        name: 'sdm-oracle',
        description: $l10n('SDM.DiceOracles'),
        category: 'SDM: Oracle Dice',
        foreground: ['#D4AF37', '#FDB827', '#FDB827'],
        background: ['#4B0082', '#460752', '#483D8B'],
        outline: '#000000',
        edge: '#D4AF37',
        texture: 'stars',
        material: 'metal',
        font: 'Medieval Sharp',
        fontColor: '#FDB827',
        shadow: 'rgba(212, 175, 55, 0.5)'
      };
      dice3d.addColorset(mysticOracle);

      const heroDice = {
        name: 'sdm-hero',
        description: $l10n('SDM.FieldHeroDice'),
        category: 'SDM: Hero Dice',
        foreground: ['#99fcde'],
        background: ['#2c5679'],
        outline: '#000000',
        edge: '#99fcde',
        font: 'Bitcount Single',
        shadow: 'rgba(71, 182, 247, 0.5)',
        material: 'wood'
      };

      dice3d.addColorset(heroDice);
    }
  });

  const { hex: hexColor, rgb: rgbColor } = selectedColor;

  document.documentElement.style.setProperty('--sdm-c-accent', hexColor);
  document.documentElement.style.setProperty('--sdm-c-highlight', hexColor);
  document.documentElement.style.setProperty('--sdm-scrollbar-thumb', hexColor);
  document.documentElement.style.setProperty('--sdm-item-hover', rgbColor);
  document.documentElement.style.setProperty('--button-focus-outline-color', rgbColor, 'important');
  document.documentElement.style.setProperty(
    '--button-hover-background-color:',
    rgbColor,
    'important'
  );
  document.documentElement.style.setProperty('--color-warm-2', rgbColor, 'important');
  document.documentElement.style.setProperty(
    'scrollbar-color',
    `${hexColor} transparent`,
    'important'
  );

  const darkRoot = document.querySelector('.theme-dark') || document;
  if (!darkRoot) return;
  // Dark theme scope (nearest ancestor wins over :root)
  darkRoot.style?.setProperty('--sdm-c-accent', hexColor, 'important');
  darkRoot.style?.setProperty('--sdm-c-highlight', hexColor, 'important');
  darkRoot.style?.setProperty('--sdm-scrollbar-thumb', hexColor, 'important');
  darkRoot.style?.setProperty('--sdm-item-hover', rgbColor, 'important');
  darkRoot.style?.setProperty('--button-focus-outline-color', rgbColor, 'important');
  darkRoot.style?.setProperty('--button-hover-background-color', rgbColor, 'important');
}

export function updateBonusHeroDiceDisplay() {
  const value = game.settings.get('sdm', 'bonusHeroDicePool') || 0;
  const container = document.getElementById('bonus-hero-dice');
  const display = document.getElementById('bonus-hero-value');

  if (!container || !display) return;

  display.textContent = value;
  container.style.display = value > 0 ? 'flex' : 'none';

  // Optional: visual pulse when active
  container.style.boxShadow = value > 0 ? '0 0 8px var(--sdm-c-accent)' : 'none';
}

export function createBonusHeroDiceDisplay() {
  const savedPos = { top: '80px', left: '50%' }; // default position; adjust as you like

  const container = document.createElement('div');
  container.id = 'bonus-hero-dice';
  container.style.cssText = `
    position: fixed;
    top: ${savedPos.top};
    left: ${savedPos.left};
    transform: translateX(-50%);
    z-index: 100;
    display: none;
    gap: 6px;
    align-items: center;
    padding: 6px 8px;
    border-radius: 8px;
    background: rgba(0,0,0,0.55);
    color: white;
    font-weight: 600;
    font-size: 0.9em;
    pointer-events: auto;
  `;

  // header / label
  const label = document.createElement('div');
  label.textContent = $l10n('SDM.BonusHeroDice') || 'Bonus Hero Dice';
  label.style.cssText = `
    white-space: nowrap;
    text-shadow: 1px 1px 2px black;
    margin-right: 8px;
    font-family: var(--sdm-font-secondary);
  `;

  // icon
  const icon = document.createElement('i');
  icon.classList.add('fa-solid', 'fa-dice-d6');
  icon.style.cssText = `
    font-size: 20px;
    width: 20px;
    height: 20px;
    line-height: 20px;
    margin-right: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
  `;

  // value display
  const valueEl = document.createElement('div');
  valueEl.id = 'bonus-hero-value';
  valueEl.style.cssText = `
    min-width: 18px;
    text-align: center;
    font-size: 1.1em;
    text-shadow: 1px 1px 2px black;
    border: 1px solid rgba(255,255,255,0.15);
    padding: 4px 4px;
    font-size: 14px;
    font-family: var(--sdm-font-dice);
  `;

  // Make it look interactive for GMs
  if (game?.user?.isGM) {
    valueEl.style.cursor = 'pointer';
    valueEl.setAttribute('data-tooltip', $l10n('SDM.DoubleClickToEdit'));

    // Double-click to change value (GM only) — using DialogV2.input (Foundry v13)
    valueEl.addEventListener('dblclick', async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      if (!game.user.isGM) return;

      const current = game.settings.get('sdm', 'bonusHeroDicePool') || 0;

      try {
        // DialogV2.input returns an object with the form values (or throws if closed when rejectClose=true)
        const data = await foundry.applications.api.DialogV2.input({
          window: { title: $l10n('SDM.SetBonusHeroDice') || 'Set Bonus Hero Dice' },
          // the input name must be "value" so we can read data.value
          content: `<input name="value" type="number" min="0" step="1" value="${Number(current)}" autofocus style="width:100%;">`,
          ok: { label: $l10n('SDM.ButtonSave') || 'Save' },
          // rejectClose:false by default in v13; using try/catch below handles cancel
          rejectClose: false,
          // modal optional: false so it doesn't block entire UI
          modal: true
        });

        if (!data || typeof data.value === 'undefined') return; // cancelled

        const parsed = parseInt(String(data.value).trim(), 10);
        if (Number.isNaN(parsed) || parsed < 0) {
          const warnMsg = $l10n('SDM.InvalidNumber') || 'Please enter a non-negative integer.';
          ui.notifications?.warn(warnMsg);
          return;
        }

        // persist and broadcast
        await game.settings.set('sdm', 'bonusHeroDicePool', parsed);
        game.socket.emit('system.sdm', {
          type: 'updateBonusHeroDice',
          value: parsed
        });

        // refresh local display
        updateBonusHeroDiceDisplay();
      } catch (err) {
        // user dismissed dialog or an unexpected error occurred — ignore cancel quietly
        console.debug('Set Bonus Hero Dice cancelled or failed', err);
      }
    });
  }

  // GM-only reset button (created only for GMs)
  let resetBtn = null;
  if (game?.user?.isGM) {
    resetBtn = document.createElement('button');
    resetBtn.classList.add('bonus-hero-reset');
    const resetTooltip = $l10n('SDM.ResetBonusHeroDice') || 'Reset';
    resetBtn.setAttribute('data-tooltip', resetTooltip);
    resetBtn.style.cssText = `
      margin-left: 8px;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.15);
      color: white;
      padding: 4px 6px;
      border-radius: 4px;
      cursor: pointer;
    `;
    resetBtn.textContent = '⟲';

    resetBtn.addEventListener('click', async ev => {
      ev.preventDefault();
      ev.stopPropagation();

      // set to zero
      await game.settings.set('sdm', 'bonusHeroDicePool', 0);

      // broadcast so other clients update
      game.socket.emit('system.sdm', {
        type: 'updateBonusHeroDice',
        value: 0
      });

      updateBonusHeroDiceDisplay();
    });
  }

  // assemble
  const inner = document.createElement('div');
  inner.style.cssText = 'display:flex; align-items:center; gap:6px;';
  inner.append(icon, label, valueEl);
  if (resetBtn) inner.appendChild(resetBtn);

  container.appendChild(inner);
  document.body.appendChild(container);

  // allow GMs to drag it like the escalator (optional), using same draggable helper if available
  if (typeof makeDraggable === 'function') {
    makeDraggable(container, label);
  }

  // initial update
  updateBonusHeroDiceDisplay();
}

/* ----------------------------
   Broadcast listener for sync
   ---------------------------- */

export function setupBonusHeroDiceBroadcast() {
  game.socket.on('system.sdm', data => {
    if (!data) return;
    if (data.type === 'updateBonusHeroDice') {
      // Some other client changed the value -> update local settings if a value is present
      if (typeof data.value !== 'undefined') {
        // If the change came from GM via socket but this client didn't receive setting
        // (race conditions), force a settings read & UI update
        updateBonusHeroDiceDisplay();
      }
    }
  });
}

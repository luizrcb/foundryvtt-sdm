![](https://github.com/luizrcb/foundryvtt-sdm/blob/main/assets/sdm-compatible.png?raw=true)

![SDM System](https://img.shields.io/badge/dynamic/json.svg?url=https://raw.githubusercontent.com/luizrcb/foundryvtt-sdm/refs/heads/main/system.json&label=SDM%20System&query=$.version&colorB=blue&logo=gnometerminal&logoColor=white) ![FoundryVTT Verified](https://img.shields.io/badge/dynamic/json.svg?url=https://raw.githubusercontent.com/luizrcb/foundryvtt-sdm/refs/heads/main/system.json&label=FoundryVTT%20Verified&query=$.compatibility.verified&colorB=green&logo=roll20) ![FoundryVTT Supported](https://img.shields.io/endpoint?url=https://foundryshields.com/version?url=https://raw.githubusercontent.com/luizrcb/foundryvtt-sdm/refs/heads/main/system.json&label=FoundryVTT%20Supported&colorB=green)

![GitHub Release Date](https://img.shields.io/github/release-date/luizrcb/foundryvtt-sdm?color=blue) [![GitHub commits](https://img.shields.io/github/commits-since/luizrcb/foundryvtt-sdm/latest)](https://github.com/luizrcb/foundryvtt-sdm/commits) ![GitHub contributors](https://img.shields.io/github/contributors/luizrcb/foundryvtt-sdm) [![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/luizrcb/foundryvtt-sdm/issues)

![GitHub downloads](https://img.shields.io/github/downloads/luizrcb/foundryvtt-sdm/total?label=Downloads) ![GitHub downloads Latest](https://img.shields.io/github/downloads/luizrcb/foundryvtt-sdm/latest/total?label=Downloads%20Latest%20Release) [![Report Bugs](https://img.shields.io/badge/Report%20Bugs%20on%20GitHub-2dba4e?logo=GitHub&amp;logoColor=white)](https://github.com/luizrcb/foundryvtt-sdm/issues)

# Synthetic Dream Machine for Foundry VTT

An unoffical, community-supported system for playing Ultraviolet Grasslands (UVG) and Our Golden Age (OGA) using the [Synthetic Dream Machine](https://www.wizardthieffighter.com/synthetic-dream-machine/) RPG rules on [Foundry VTT](http://foundryvtt.com/).

*foundryvtt-sdm* is an independent production by community contributors, and is not affiliated with [Luka Rejec](https://patreon.com/wizardthieffighter) or [WTF Studio](https://www.wizardthieffighter.com/). It is published under the [Synthetic Dream Machine Third Party License](https://raw.githubusercontent.com/luizrcb/foundryvtt-sdm/refs/heads/main/SDM-3RD-PARTY-LICENSE-2.0.txt).

## Credits

Synthetic Dream Machine (SDM), Ultraviolet Grasslands (UVG), Our Golden Age (OGA), and the Vastlands Guidebook (VLG) are copyright [Luka Rejec](https://patreon.com/wizardthieffighter).

## Acknowledgements

This project uses names of creatures, items, traits, powers, locations, and rule sections from the [Vastlands Guidebook](https://www.exaltedfuneral.com/products/vastlands-guidebook-bootleg-beta-early-release-free-pdf) ([Luka Rejec](https://patreon.com/wizardthieffighter), VLG 2025)

## Licenses

- **Content:** [Synthetic Dream Machine Third Party License](https://raw.githubusercontent.com/luizrcb/foundryvtt-sdm/refs/heads/main/SDM-3RD-PARTY-LICENSE-2.0.txt)
- **Source Code:** All source code files (javascript, hbs, scss, css) are licensed under the [MIT License](https://en.wikipedia.org/wiki/MIT_License).
- **Foundry VTT:** The project is created following the Foundry VTT [Limited License Agreement for module development](https://foundryvtt.com/article/license/).
- **Icons:** Icons in the `/assets/icons/` folder are courtesy of [Game-icons.net](https://game-icons.net/) and licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- **Audio:** Audio files in the `/assets/audio/sound_effects` folder are courtesy of [Pixabay](https://pixabay.com) and licensed under [Content License - Pixabay](https://pixabay.com/service/license-summary/)
- **Fonts:** The fonts used in this project carry their own licenses.

## Add-on Modules Integration

The SDM system provides companion add-on modules to integrate with the following:

- **Item Piles**: [Item Piles: SDM](https://github.com/luizrcb/item-piles-sdm)
- **Token Action HUD**: [Token Action HUD SDM](https://github.com/luizrcb/token-action-hud-sdm)

## System Features

### Actor Types

- Caravan
- Character
- NPC

### Item Types

- Item
  - Album of Power
  - Armor
  - Gear
  - Power
  - Ward
  - Weapon
- Trait
  - Power
  - Skill
  - Trait
- Burden

### Features

#### Core Gameplay

- Character Sheet (Edit Mode / Play Mode) for configuring attacks, power cost, and full ability values.
- Each attack type (melee, ranged, fantascience, and oldtech) can be configured with a preferred ability and skill.
- Support for mental and social attacks (and defenses) as described in the *Vastlands Guidebook* (VLG).
- Descriptive results for saving throws, reactions, morale (NPC), and targeted attack rolls.
- Characters can spend hero dice to modify rolls or regain life (players must configure their main character in the User Configuration menu). Exploding dice are supported.
- **Special roll results (magic numbers):**
  - **1** = critical failure.
  - **13** = only one ammo or other resource left.
  - **20** = critical success.
- The system will automatically disable temporary active effects based on combat round/turn durations.

#### Items & Inventory

- Fully automated character inventory slots (each burden imposes a -1 penalty to all rolls, except hero dice rolls).
- Hovering over items in the inventory displays their key information (damage, range, power cost, etc.).
- Double-clicking an inventory item will open its sheet.
- Right-click any inventory item, trait, or burden to send a card to the chat.
- Easy item transfer between actors.
- Caravan cargo drop areas are highlighted when dragging an item.
- Items can be flagged as  a **hallmark** (hallmark item leveling is not automated). The hallmark experience field supports math expressions.
- Items can be marked as **notched** or **broken**.
- Drag and drop a power into an Album of Power to add it to the Album; Referees can also extract powers from an album (copy power from the album to a new gear item).

### Caravan System

- **Caravan actor type:**
  - Real container-based drag-and-drop inventory (sacks).
  - Shows total value and slots per sack for each container.
  - Overload indicator when the caravan capacity is exceeded.

### Dice & Rolls

- Group initiative rolls (Referee button in the Token Controls menu).
- Customizable initiative rolls in NPC sheets.
- Shift+Click shortcut to skip opening custom roll dialogs.
- Ctrl+Click shortcut to make rolls in blind GM mode.
- Right-click roll results in the chat to open `Apply as Damage` and `Apply as Healing` menu options (applies to all selected tokens).

### NPCs & Referee Tools

- NPCs support experience tracking (pets, sidekicks) and can use skills and traits in rolls.
- **Referee utility functions** are available directly as buttons in the token controls left menu (no need to use macros).
- Referee and Player utility functions are exposed in the system API for automation.

### Customization & UI

- Highly configurable core game values (base defenses, item and trait slots, etc.).
- **Chromatype customization:**
  - Choose a main chromatype color for UI elements.
  - Dice So Nice integration with the  "SDM Chromatype Dice” theme for Dice So Nice.
  - Separate configuration for Dice So Nice Chromatype color.

### Localization

- Full localization for Brazilian Portuguese (pt-BR).

## Compendiums

This project compendiums and macros use names of creatures, items, traits, powers, locations and rule sections from the *Vastlands Guidebook*.

- The following compendiums contain equipment, traits, macros and roll tables:
  - Equipment:
    - Armors (VLG, pp. 74-77):
      - Modern and Ancient Shields
      - Light Armor
      - Medium Armor
      - Heavy Armor
      - Classic Golem Armor
    - Gears: (VLG, pp. 82-85)
      - Gadgets
      - Consumables
    - Powers (VLG, pp. 94-113 and [Powers Enumerated I](https://www.wizardthieffighter.com/2024/powers-enumerated-i/))
    - Wards (VLG, pp. 78-79):
      - Trinkets
      - Wearable Wards
      - Portable Wards
      - Bulky Wards
    - Weapons (VLG, pp. 68-73):
      - Traditional Melee Weapons
      - Long Ago Melee Weapons
      - Ranged Weapons
      - Throwing Weapons
      - Terrible Ranged Weapons of the Long Ago
  - Traits (VLG, pp. 16-17 and pp. 114-159):
    - Path of the Wizard
    - Path of the Traveler
    - Path of the Fighter
    - Other Paths
      - Barbarian, Bluelander, Bourgeois, Golem, Greenlander, Holy Fool, Manager, Noble, Noömagus, Orangelander, Purplelander, Redlander, Scion, Servant, Skeleton, Soldier, Tourist Trickster, Weapon (Weapon and Bearer), Yellowlander.
  - SDM Macros (Referee Macros):
    - Give (or take) cash.
    - Give (or take) hero dice.
    - Give XP.
    - Group Initiative (select all tokens and use the macro, no need to create the encounter). Initiative will be grouped by token disposition (friendly, neutral, hostile, secret).
    - Escalator Die (UVG 1ed legacy feature). The escalator die value will be added to ability, attack, weapon, power, and album of power roll results.
    - Generate Random NPCs using tables from the Vastlands Guidebook (VLG, pp. 162-163)
  - SDM Player Macros:
    - Generate Ability Scores (method described in the Vastlands Guidebook (VLG, p. 12): rolls 1d100 for every ability score and displays the results in chat).
    - Character Background Trait Generator based in the Vastlands Guidebook Background table (VLG, p. 15)
  - Rollable Tables:
    - Ability Scores: preferred method for ability score generation (VLG, pp. 12-13). Roll d100 table to generate ability scores, then assign unlabeled scores.
    - Referee Title: a fun d10 table to choose referee title and referee session power (VLG, p. 7).
    - Rollable tables for every equipment category (Light Armor, Medium Armor, etc)

## Installation Instructions

The latest version of the system can be installed through the in-app System Browser by searching for any of the following: "SDM", "Synthetic Dream Machine", "UVG", "Ultraviolet Grasslands", "OGA", or "Our Golden Age".

You can also use one of the following alternative installation methods:

1. Pasting the following url into the **Install System** dialog on the Setup menu of the application.
##
    https://raw.githubusercontent.com/luizrcb/foundryvtt-sdm/main/system.json
2. Browsing the repository's [Releases](https://github.com/luizrcb/foundryvtt-sdm/releases) page, where you can copy any system.json link for use in the Install System dialog.
3. Downloading one of the .zip archives from the Releases page and extracting it into your foundry Data folder, under `Data/systems/sdm`.

<!-- This system is made possible thanks to all of its contributors!

<a href="https://github.com/luizrcb/foundryvtt-sdm/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=luizrcb/foundryvtt-sdm" />
</a> -->

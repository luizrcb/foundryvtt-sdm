![](https://github.com/luizrcb/foundryvtt-sdm/blob/main/assets/sdm-compatible.png?raw=true)

![SDM System](https://img.shields.io/badge/dynamic/json.svg?url=https://raw.githubusercontent.com/luizrcb/foundryvtt-sdm/refs/heads/main/system.json&label=SDM%20System&query=$.version&colorB=blue&logo=gnometerminal&logoColor=white) ![FoundryVTT Verified](https://img.shields.io/badge/dynamic/json.svg?url=https://raw.githubusercontent.com/luizrcb/foundryvtt-sdm/refs/heads/main/system.json&label=FoundryVTT%20Verified&query=$.compatibility.verified&colorB=green&logo=roll20) ![FoundryVTT Supported](https://img.shields.io/endpoint?url=https://foundryshields.com/version?url=https://raw.githubusercontent.com/luizrcb/foundryvtt-sdm/refs/heads/main/system.json&label=FoundryVTT%20Supported&colorB=green)

![GitHub Release Date](https://img.shields.io/github/release-date/luizrcb/foundryvtt-sdm?color=blue) [![GitHub commits](https://img.shields.io/github/commits-since/luizrcb/foundryvtt-sdm/latest)](https://github.com/luizrcb/foundryvtt-sdm/commits) ![GitHub contributors](https://img.shields.io/github/contributors/luizrcb/foundryvtt-sdm) [![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/luizrcb/foundryvtt-sdm/issues)

![GitHub downloads](https://img.shields.io/github/downloads/luizrcb/foundryvtt-sdm/total?label=Downloads) ![GitHub downloads Latest](https://img.shields.io/github/downloads/luizrcb/foundryvtt-sdm/latest/total?label=Downloads%20Latest%20Release) [![Report Bugs](https://img.shields.io/badge/Report%20Bugs%20on%20GitHub-2dba4e?logo=GitHub&amp;logoColor=white)](https://github.com/luizrcb/foundryvtt-sdm/issues)

# Synthetic Dream Machine for Foundry VTT

An unoffical, community-supported system for playing Ultraviolet Grasslands (UVG) and Our Golden Age (OGA) using the [Synthetic Dream Machine](https://www.wizardthieffighter.com/synthetic-dream-machine/) RPG rules on [Foundry VTT](http://foundryvtt.com/).

*foundryvtt-sdm* is an independent production by community contributors, and is not affiliated with Luka Rejec or WTF Studio. It is published under the [Synthetic Dream Machine Third Party License](https://raw.githubusercontent.com/luizrcb/foundryvtt-sdm/refs/heads/main/SDM-3RD-PARTY-LICENSE-2.0.txt).

## Credits

- Synthetic Dream Machine (SDM), Ultraviolet Grasslands (UVG), Our Golden Age (OGA), and the Vastlands Guidebook (VLG) are copyright Luka Rejec.

## Licenses

- **Content:** [Synthetic Dream Machine Third Party License](https://raw.githubusercontent.com/luizrcb/foundryvtt-sdm/refs/heads/main/SDM-3RD-PARTY-LICENSE-2.0.txt)
- **Source Code:** All source code files (javascript, hbs, scss, css) are licensed under the [MIT License](https://en.wikipedia.org/wiki/MIT_License).
- **Foundry VTT:** The project is created following the Foundry VTT [Limited License Agreement for module development](https://foundryvtt.com/article/license/).
- **Icons:** Icons in the `/assets/icons/` folder are courtesy of [Game-icons.net](https://game-icons.net/) and licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- **Audio:** Audio files in the `/assets/audio/sound_effects` folder are courtesy of [Pixabay](https://pixabay.com) and licensed under [Content License - Pixabay](https://pixabay.com/service/license-summary/)
- **Fonts:** The fonts used in this project carry their own licenses.

## System Features

### Actor Types

- Character
- NPC

### Item Types

- Item
  - Armor
  - Gear
  - Power
  - Power Album
  - Ward
  - Weapon
- Trait
  - Power
  - Skill
  - Trait
- Burden

### Features

- Fully automated character inventory slots (each burden imposes a -1 to all rolls except hero dice rolls).
- Hovering over items in the inventory displays their key information (damage, range, power cost, etc.).
- Easy item transfer between actors.
- Character Sheet (Edit Mode / Play Mode) for configuring attacks, power costs, and full ability values.
- Each attack type (melee, ranged, fantascience, and oldtech) can be configured with a preferred ability and skill.
- Characters can spend hero dice to modify rolls or regain life (players must configure their main character in the User Configuration menu). This can cause dice to explode.
- Support for group initiative rolls (GM Macro).
- Shift+click shortcut to skip opening custom roll dialogs.
- Highly configurable core game values (base defenses, item and trait slots, etc.).
- Customizable initiative rolls in NPC sheets.
- Descriptive results for saving throws, reactions, morale (NPC), and targeted attack rolls.
- Extensive bonus options to simulate backpacks, blessings, curses, injuries, trait effects (see the Active Effects Changes tab for the full list).
- GM utility macros.
- Drag and drop a power into a power album to easily copy it to the album.
- Support for mental and social attacks (and defenses) as described in the Vastlands Guidebook (VLG).
- Full localization for Brazilian Portuguese (pt-BR).
- Special roll results for magic numbers (1 = critical failure, 13 = only one ammo or other resource left, 20 = critical success).
- Right-click roll results in the chat to open `Apply as Damage` and `Apply as Healing` menu options. This will be applied to all selected tokens.

- The following compendiums contain equipment, traits, macros and roll tables:
  - Equipment:
    - Armors
      - Modern and Ancient Shields
      - Light Armor
      - Medium Armor
      - Heavy Armor
      - Classic Golem Armor
    - Wards:
      - Trinkets
      - Wearable Wards
      - Portable Wards
      - Bulky Wards
    - Weapons:
      - Traditional Melee Weapons
      - Long Ago Melee Weapons
      - Ranged Weapons
      - Throwing Weapons
      - Terrible Ranged Weapons of the Long Ago
  - Traits:
    - Path of the Wizard
    - Path of the Traveler
    - Path of the Fighter
  - SDM Macros (GM Macros):
    - Give (or take) cash.
    - Give (or take) hero dice.
    - Give XP.
    - Group Initiative (select all tokens and use the macro, no need to create the encounter). Initiative will be grouped by token disposition (friendly, neutral, hostile, secret).
    - Escalator Die (UVG 1ed legacy feature). The escalator die value will be added to ability, attack, weapon, power, and power album roll results.
    - Generate Random NPCs using tables from the Vastlands Guidebook (VLG)
  - SDM Player Macros:
    - Generate Ability Scores (method described in the Vastlands Guidebook (VLG): rolls 1d100 for every ability score and displays the results in chat).
    - Character Background Trait Generator (based in the Vastlands Guidebook Background table)
  - Rolltables:
    - Ability Scores (preferred method for ability score generation). Roll d100 table to generate ability scores, then assign unlabeled scores.
    - Referee Title (a fun d10 table to choose referee title and referee session power).
    - RollTables for every equipment category (Light Armor, Medium Armor, etc)

## Installation Instructions

To install and use the Synthetic Dream Machine system for Foundry Virtual Tabletop, simply paste the following
URL into the **Install System** dialog on the Setup menu of the application.

[https://raw.githubusercontent.com/luizrcb/foundryvtt-sdm/main/system.json](https://raw.githubusercontent.com/luizrcb/foundryvtt-sdm/main/system.json)

If you wish to manually install the system, you must clone or extract it into the `Data/systems/sdm` folder. You
may do this by cloning the repository or downloading a zip archive from the
[Releases Page](https://github.com/luizrcb/foundryvtt-sdm/releases).

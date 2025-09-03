# CHANGELOG

## v0.2.0

- Add caravan actor type
- Change all sheet input styles to look clean and minimal
- Automatically disable temporary active effects based on combat round/turn durations

## v0.1.40

- Send inventory items to chat when you right-click them
- Send power cards to chat when you cast a power
- Double-clicking an inventory item will open its sheet

## v0.1.39

- When you drag and drop a power onto a character sheet, you can choose to create it as an item or as a trait
- Changed “Power Album” labels to “Album of Power”

## v0.1.38

- Add consumables to the gears compendium
- Add 65 powers to the equipment compendium
- Add support for custom reaction base formulas
- Add support for casting/overcharging powers that don't have a roll expression (sends power card to chat)
- Add support for zero-cost powers
- Add power and overcharge descriptions to the roll result in chat

## v0.1.37

- Add gadget gears compendium
- Fix pt-BR localization in the background trait generator

## v0.1.36

- Replace the word “GM” with “Referee” everywhere
- Organize rollable tables into folders
- Add an option to roll saving throws, reaction, and morale with advantage or disadvantage
- Add optional hard limit rule for d20 rolls (configurable and enabled by default)

## v0.1.35

- Many fixes in pt-BR localization
- Added Traits compendium with Path of the Wizard, Path of the Traveler and Path of the Fighter

## v0.1.34

- Add Character Background Trait Generator in SDM Player Macros
- Add support to custom base damage multiplier (hunter trait)
- Add bonus weapon slots (armiger trait)

## v0.1.33

- Add compendium with all weapons, armors and wards from the Vastlands Guidebook
- Add rollable tables for every equipment category (light armor, medium armor, etc)

## v0.1.32

- Add Referee macro to generate random NPCs
- Expose API functions to create random NPCs (game.sdm.api.createNPC and game.sdm.api.createNPCByLevel)

## v0.1.31

- Fix issue when updating base abilities to a value lower than current + bonus
- Fix bug that incorrectly added ability bonuses to defenses

## v0.1.30

- Remove hardcoded roll bonus and use a config value for traits when used as skills
- Add github actions release workflow

## v0.1.29

- Fix players not been able to change player xp and pc xp in their character sheets
- Allow Referees to drag and reposition the escalator die display

## v0.1.28

- Ignore all roll modifiers that are not a valid roll expression

## v0.1.27

- Updated README
- Add missing multiplier options for power and album of power roll dialogs

## v0.1.26

- Added setting to reverse Shift key shortcut behaviour
- Fixed drop of powers in album of powers

## v0.1.25

- Fixed bug that allowed a lower max_power value than the number of powers in an album

## v0.1.24

- Changed album of power content to a tab

## v0.1.23

- Added missing burden penalty to reaction rolls

## v0.1.22

- Fixed bug preventing characters from using hero dice in rolls that are not theirs

## v0.1.21

- Added power containers and caravan inventory
- Rerendered roll result after hero dice usage
- Fixed missing i18n strings
- Removed pro font awesome icons and replaced with free options using SVG assets
- Added default config in combat tracker actors prototype tokens and new group initiative logic
- Renamed power container to album of power
- Added sound effect on leveling up and additional configuration options
- Merged quality-of-life features from caravan branch
- Fixed system update notification pip position
- Added system version and GitHub metadata to README file
- Changed album of power roll icon

## v0.1.20

- Fixed item-transfer to and from NPCs

## v0.1.19

- Improved dark theme visibility

## v0.1.18

- Bumped system version
- Adjusted element positioning in chat messages for targeted attacks
- Fixed typo in pt-BR translation file

## v0.1.17

- Added on target and natural 13 rolls results

## v0.1.16

- Added item transfers using sockets and limited player interactions with non-owned sheets

## v0.1.15

- Fixed UI positioning issues and attacks now need to beat defense values instead of meeting them

## v0.1.14

- Added critical success and failure tracking and styling on d20-based rolls

## v0.1.13

- Added apply damage or healing context menu options on chat messages
- Added shift+left click shortcut to skip most roll dialogs

## v0.1.12

- Added dedicated damage roll button on NPC sheet and reordered some fields

## v0.1.11

- Added support for social and mental attacks

## v0.1.10

- Fixed abilities orders and colors
- Bumped system version

## v0.1.9

- Fixed enforcement of max values for current abilities on actor update
- Bumped package version

## v0.1.8

- Added system pause icon and fixed attack_bonus being wrongly applied to ability rolls
- Added sort=true attributes to most selectOptions
- Bumped version

## v0.1.7

- Moved utility scripts to utils folder
- Removed unfinished features from UI and added missing burden name input
- Updated README with installation instructions
- Fixed installation link

## v0.1.6

- Added helper scripts to pack and unpack compendium data
- Added system badge and version to sidebar info
- Bumped system version

## v0.1.5

- Fixed missing settings i18n and reviewed active effects possible target properties

## v0.1.4

- Added leveldb files to .gitignore
- Fixed version control of compendium data as unpacked JSON files
- Removed wrongly versioned compendium JSON files
- Fixed issues on item in the inventory table
- Bumped system version
- Fixed .gitignore for Foundry DB files

## v0.1.3

- Added SDM third-party license and updated minimum compatibility version

## v0.1.2

- Bumped version
- Added missing part context

## v0.1.1

- Fixed bug on notes tab

## v0.1.0

- Migrated code from UVG 1st edition repo
- Improved code formatting by adding prettier configuration
- Refactored hero dice component
- Added character sheet edit mode, allowing players to change attacks default attribute and favorite skill
- Refactored i18n and fixed strings not using localization
- Consolidated weapon and armor into gear item type
- Updated data models from UVG 1st edition to SDM
- Validated item slots on create, update, drop, and transfer of items
- Renamed heroic dice to hero dice and allowed players to change other players’ rolls using their hero dice
- Reused gear and trait partials in burdens list
- Refactored settings i18n and isolated some setup code
- Refactored all character sheet rolls (except saving throws) to use a new SDMRoll class
- Continued i18n refactoring and customized active effect changes UI
- Added missing i18n strings and Brazilian Portuguese translation
- Added revenue, expenses, wealth, and debt to character sheet
- Refactored inventory items title and added damage roll option for versatile weapons
- Renamed stats to abilities
- Refactored some chat utility functions
- Refactored UVG 1e skills to SDM attacks
- Refactored i18n in all macros and utility functions
- Updated system manifest and download link
- Added new fonts and system icon
- Started formatting gear sheets
- Added saving throw icons to all abilities, mental and social defenses and icons
- Added icons for reading and transferring an item
- Added a new notes tab to actors and changed the way exploding dice are marked
- Fixed some missing i18n messages
- Updated system compendiums
- Updated compendiums
- Initial commit

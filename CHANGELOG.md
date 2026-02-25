# CHANGELOG

## v0.12.2

- Removed caravan tokens from been added to the combat tracker
- Added support to a pet tab in the Token Action HUD SDM module

## v0.12.1

- Removed readied icon from cash items sheet
- Added burden penalty to NPC rolls
- Changed menu fonts
- Changed game paused font and color (uses chromatype setting)
- Fixed notification message displayed when background trait generator creates a trait and no character is selected

## v0.12.0

- Added support to burdens as powers (the weight of a malign knowledge)
- Added new config for alternate cash weight rules
- Improved UI for referee feature "Give Hero Dice"
- Improved UI for referee feature "Give/Take Cash"
- Added an option to evenly split a cash amount among selected characters
- Improved UI for referee feature "Give Experience"

## v0.11.0

- Add new gear and trait item types: affliction (a kind of burden), augment and pet
- Add steps to cure a burden. When the last step is marked the player is asked if the burden should be deleted
- Changed item features from plain text in item descriptions to a set of configurable options
- Updated all compendium items to use the new item features
- Versatile weapons now need the versatile feature
- The bonus from the Friends trait is now automated
- Automated cramping feature defense penalty (-1 per item with the feature)
- Added usage roll for items with the feature replenish
- Added an option to level up NPCs from their sheet (in the toggle controls menu ...)
- Added a burden generator (GM tool)
- Added "Wear and tear" to burdens compendium
- Added option for players to reroll their characters from the character sheet (in the toggle controls menu ...)
- Removed redundant token control icons (create burden, create NPCs, group initiative)

## v0.10.0

- Group initiative tiebreaking setting now defaults to false
- Added a character generator (GM only feature)
- Added new compendiums (strange items, strange items table, motive table, traits tables, and names tables)
- Corruption items (gears or traits) can now be used as a skill in relevant rolls
- The background trait generator no longer requires a selected token
- Added a corruption intensity table
- Dragging items from one sheet to another while pressing Ctrl will cause the item to be copied over

## v0.9.3

- Fixed initiative tie breaking config not working when disabled

## v0.9.2

- Added configuration to use or not a tiebreaking logic in group initiatives
- Changed group initiative button to behave like Roll All and Roll NPCs buttons (you need to reset initiative to roll group initiative again)
- Added a random decimal to combatants inside a same group, so initiatives orders inside a group won't always stay the same
- Added rolled dice to the dice oracles result chat card

## v0.9.1

- Added configuration options to customize hero dice, blood dice, tourist dice and oracle dice colors (Dice So Nice)
- Added new fonts for some 3D dice themes
- Added a referee button in the Actors tab to generate random NPCs
- Added a referee button in the Combat Tracker to roll group initiative

## v0.9.0

- Added support for dice oracles and a new Dice So Nice theme for oracle dice

## v0.8.0

- Added defeat rolls to the character sheet
- Added a set of defeat-related burdens to a compendium
- Added new 'corruption' type for items and traits
- When you drag a corruption item to a character sheet you can select either creating it as an item or a trait. Corruptions take one inventory slot and don't need to be readied (equipped)
- Also added the severe, moderate, and mild corruption rollable tables
- Added corruption severity roll to the character sheet

## v0.7.0

- Right-click items on the character sheet to add and remove charges (when max charges is not zero)
- Added a preview option for audio settings (specifically for the level-up sound)
- Added support for traits that make ability or attack rolls always use advantage or disadvantage (using `roll_mode` key in active effects)
- When you convert a gear item to cash, its name and image will now update automatically

## v0.6.2

- Add support for tracking item (gear) charges
- Add configurable integration with "Seasons & Stars" and "Seasons & Stars: SDM" modules
- Change the default value of the configuration that re-rolls initiative every combat round to true
- Allow level 0 (no-cost) powers in Albums of Power. This enables the album item itself to be used as an attack source, where the level 0 power represents its damage roll (e.g., swinging the album as if it were a magic sword)

## v0.6.1

- Fix how we get the default icons for actors and items
- Change trait, ward and skill default icons
- Allow active effects to be applied on item properties

## v0.6.0

- Add new time-related fields to the Caravan sheet (extra days tallied, weeks and month)
- Change default icons for NPC and Caravan actors
- Change default icons for Trait and Burden items
- Change default icon for power, album of power, armor, ward and weapon items

## v0.5.6

- Fix broken rollable table references to compendium items
- Add configuration to enable Lucky Seven rule

## v0.5.5

- Break down the Equipment compendium into multiple compendiums
- Group releated compendiums into thematic folders

## v0.5.4

- Fix burden penalty bonuses (a bonus that allow burdens to be ignored) been wrongly applied to roll results
- Fix typos in compendium items and traits
- Fix typo on item effects template

## V0.5.3

- Fixed item transfers from NPC actors not removing the original item from the actor
- Fixed incorrect chat card creation when the caravan Consume Supplies action is cancelled

## v0.5.2

- Fix random NPC generator not creating level 0 NPCs
- Add Trait Items (240 items, 6 weapon forms, and 2 new powers)
- Add support for undead-type supply gear

## v0.5.1

- Fix a bug that prevented roll results from being applied as damage to NPC tokens

## v0.5.0

- Add new Traits to the system Compendium
- Add support for Blood Dice and Tourist Dice
- Add support for Borrowed Life and Temporary Life
- Add new color palettes: electricBlue, ice, mint, neonRose, neonYellow, roseGold, sky, tangerine
- Add new Dice so Nice color themes: SDM Warm Dice, SDM Cool Dice, SDM Dark Dice, SDM Light Dice, SDM Romantic Dice
- Updated Neon Dice and Luxury Dice color themes
- Fixed players not been able to edit active effects

## v0.4.5

- Add starting kit to Equipment compendium
- Fix drop-down boxes style in dark theme

## v0.4.4

- Add new SDM color themes to Dice So Nice
- Applying Damage or Healing now creates a history card in the chat
- Caravan supply consumption now creates a history card in the chat

## v0.4.3

- Item and Cash transfers now create a history card in the chat
- Many Referee actions now create a history card in the chat (Give Hero Dice, Give XP, Give/Take Cash)

## v0.4.2

- Add support to right-clicked action on the Token Action HUD (right-click Hero Dice button)

## v0.4.1

- Add support to Token Action HUD module

## v0.4.0

- GM transfer item can also charge money from an actor (editable amount, using unit price as default value). For supply items, quantity can also be selected
- Adjust give/take cash API calls to accept parameters and execute without opening a dialog
- Add supply flag and supply type to gear items
- Add caravan button to consume supply; if the gear has an active effect, copy the effect to the actor when the supply is consumed
- Add right-click context menu options to gear items to split and merge item stacks
- Caravan cash transfer will enforce a maximum cash item stack size of 2,500
- Dropping or transferring multiple supply items of sack size to a caravan sheet will split those supplies into multiple items of quantity 1
- Drag and drop items between owned actors will no longer duplicate items
- Add support for the Item Piles module in a separate **“Item Piles: SDM”** companion module

## v0.3.3

- Move all system settings into submenus for better organization
- Fix issues in pt-BR localization

## v0.3.2

- Add support for tracking the learning of new traits, skills, and powers

## v0.3.1

- Add support for marking gear resources (ammo, battery) as running low or run out
- Add test cases to cover Hero Dice usage options and validate expected results
- Add system setting to reroll group initiatives every round
- Add system setting to choose whether players are grouped with friendly tokens during group initiative rolls

## v0.3.0

- Fix unnecessary Bonus Hero Dice Pool update notifications
- Improve Hero Dice usage: now supports complex expressions such as advantage, disadvantage, and multipliers

## v0.2.12

- Move many item utility buttons to a context menu. Right-click an item in any inventory to open the available options
- Add support for using Hero Dice to decrease roll results
- Characters can right-click the Hero Dice label on their sheet to add Hero Dice to a shared bonus dice pool
- Every time a character clicks on **Use Hero Dice** in a chat roll result, all dice from the shared bonus pool (if any) will be added to their roll
- Add support for marking a gear as a Starting Kit. You can unpack (right-click the item in the inventory) up to 10 items before the kit disappears

## v0.2.11

- Allow users to spend Hero Dice without rolling by right-clicking their Hero Dice label
- Allow users to add bonus Hero Dice (granted by other players or the referee) when modifying a roll result
- Add missing localization for referee feature buttons in the token controls menu
- Add warning when the referee uses the Group Initiative feature without selecting any tokens
- Fix an issue caused by an empty power name when creating new powers in Albums of Power
- Add a label to the NPC sheet for rolling saving throws

## v0.2.10

- Fix issues related to “Blind GM Rolls” and usage of Hero Dice
- Fix issues related to “Blind GM Rolls” and chat card context menu to apply damage or healing

## v0.2.9

- Move Referee utility functions from macros to buttons in the token controls left menu
- Add Ctrl+Click shortcut to make rolls in blind GM mode”
- Add missing description to the “You Go” drink gear
- Update 3D and 2D dice fonts
- Update Chromatype palettes for better 3D dice contrast

## v0.2.8

- Allow referees to extract (copy) a power from an Album of Power
- Update some color palettes in the Chromatype system setting
- Add (neon) Lime Chromatype color option
- Add all Referee and Player utility macros to the system API
- Hallmark experience field now supports math expressions, like other experience fields
- Fix an issue with packed_item_slots_bonus (a bonus for not readied items that don’t take item slots)

## v0.2.7

- Fix bugs on hallmark item limits check
- Add new font to the project for 3D and 2D dice results

## v0.2.6

- Fix the “SDM Compatible” icon appearing unintentionally on the character sheet
- Fix the hallmark limit check when editing an item
- Add a separate configuration for Dice So Nice Chromatype color
- Change the font of the “SDM Chromatype Dice” theme

## v0.2.5

- Add support to flag items as hallmark (hallmark item leveling is not automated)
- Add a Chromatype configuration option for clients to choose a main color for UI elements
- Users of the “Dice So Nice” module will find a special “SDM Chromatype Dice” theme to color their 3D dice according to their chromatype

## v0.2.4

- Add support for marking items as notched and broken
- Highlight caravan cargo drop areas when starting to drag an item

## v0.2.3

- Increment route location letters alphabetically in the routes tab
- Improve caravan cargo tab: drag and drop using real containers based on caravan capacity
- Add the total value and number of slots in each sack container
- Overloading a caravan now adds a visual indication in the capacity field

## v0.2.2

- Added an experience field for NPCs (pets, sidekicks). NPC leveling is not automated, but you can track the invested XP
- NPCs can also use skills and traits in their rolls (same as characters)
- Fixed pt-BR localization in the caravan sheet

## v0.2.1

- Fixed a bug in the "slots taken" calculation for readied soap-sized items

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

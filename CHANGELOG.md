# CHANGELOG

## v1.11.0

- **Investing XP**: a new button next to Player XP on the character sheet lets players invest their Player XP in the character, in one of its hallmark items or in one of their pets, or donate it to another player's Player XP. The dialog shows how much XP each one needs to level up, and every investment is recorded in the chat
  - Only the Referee can edit XP fields directly (Player XP, character XP, NPC XP and hallmark XP)
  - Hallmark items get their level from their XP; hallmark and NPC levels are no longer edited by hand (mount and vehicle levels are unchanged)
  - NPCs gain levels when their XP reaches the next level (stats from the table they were created from, or the generic table); the Level Up button also raises their XP to the new level
  - NPCs created at a level (generators, spawned from items) start with that level's XP
  - Referee: the cog next to an NPC's level shows and changes the table it levels up with. **Custom** means no table: levelling up only changes the level and the Referee updates the other values. Animated items can use it too
  - Hovering NPC and hallmark XP shows the XP needed to level up, as for characters
- **Level-up upgrades**: every level a character or hallmark gains leaves an upgrade to choose (a pulsing badge next to the level, and on the hallmark in the inventory). The player chooses it when they want and it is consumed
  - Character: a new trait, power or pet (dragged in, a power or pet item becoming a trait, a random trait, or a brand new one created by name with its type), improve a trait (skilled → expert → master, up to builder with the extended skill ranks setting; a plain trait becomes expert), or +1 to an ability score. Life and hero dice still come with the level
  - Hallmark: +1 to every damage die, +1 defense, a mod as the upgrade (from the Mods & Effects compendium; it does not use a mod slot), a new item feature, a new trait with a name and description (for example Lich-bane), or a power (it goes into the item's album, which gains a slot; an item without an album gets one with one slot). The hallmark's sheet lists everything it gained (traits expand to their description) and hovering its star in the inventory shows the same list. XP pays for it: the material cost (€5 × item level for damage, €10 × item level for defense, mod cost × number of mods or the item's cost if higher for a mod) is only taken from the character's cash when **Charge material cost** is ticked in the dialog. The chat and the progress history say whether it was paid
- **Progress history**: the clock button next to the level lists every XP investment and level-up upgrade, grouped by what changed: the character, each hallmark, each pet and donations. Each group can be collapsed (showing its latest entry and how many entries it has) and scrolls on its own; Expand all / Collapse all at the top. The Referee undoes each group on its own, latest first: its XP, money or pending upgrade comes back, and a pet goes back to the stats it had before the investment (level included). A hallmark's sheet opens its own history. Donations are given back by the receiver, while they still have that XP in their pool
- **Animated items**: the new "animated" item feature adds an Animation tab where the Referee picks the NPC table (generic by default), whether the item walks away (stops counting weight and is greyed out in the inventory) or stays as energy, and the creature's attributes (or fills them from the table)
  - Drop an NPC (sidebar or compendium) on the Animation tab to make it the item's creature: its table and stats (life, defense, morale, bonus, damage, initiative, capacity, size, speed) fill the tab
  - An item that comes from the compendium already linked to a compendium NPC (e.g. Soul Siphon Spear and its Spear Snake) imports its own copy of that NPC into the "Animated Items" folder the first time it is animated; the item keeps its own attributes
  - Items with charges can spend charges to come to life ("Charges to animate"); without enough charges they cannot be animated, and spending the last ones marks the item run out (one left of several: running low). A creature paid with charges does not wear its item (no notched/broken or running low/run out) and every charge spent brings it back with full life
  - An item that was equipped is equipped again when it turns back into the item, unless it is broken
  - Animate / Deanimate from the tab, the inventory right-click menu (right after View), or (deanimate) the creature token's HUD. The creature is an NPC owned by the character's players, kept in the "Animated Items" folder and reused every time; deanimating brings its state back to the item
  - A weapon (or an item with the weapon feature) can fight with its own damage; a versatile weapon also gives the creature a readied "Versatile damage" weapon. **Creature damage** in the Animation tab chooses the weapon or the creature damage of the tab; automatic uses the weapon, except with the custom table
  - Armor and ward items add their armor/ward bonus to the creature's defense, on top of the table (or Animation tab) defense, also after level-ups
  - Powers and power albums: the creature gets a copy of the power or album (refreshed every time it is animated), so it can use its own powers
  - A notched or running-low item comes to life with at most half its life
  - The item's features become traits of the creature, a glowing item sheds light like a torch, and the effects the item gives its bearer also work on the creature
  - Players can ask the Referee to animate their items (Animation tab or right-click); the Referee approves or declines
  - Optional: the creature turns back into the item when the combat ends
  - The creature's level follows the item (the hallmark level for hallmarks, otherwise the level the Referee sets) and never levels up on its own
  - The creature's life wears the item: at half life a creature that walked away notches the item and an energy creature leaves it running low; at 0 life the item is broken or has run out and the creature turns back into the item. A broken or run-out item cannot be animated until it is repaired or recharged. Repairing or recharging the item heals its creature back to full life
- Character generator no longer gives the same trait or skill twice. The first repeat instead improves what the character has, once per character: a skill goes up one rank, a trait becomes an Expert skill. Rerolling an existing character now waits for its old items to be removed
- Starting kits show how many items are left to unpack, in parentheses, in the inventory of character, NPC and caravan sheets
- An NPC added to a caravan's crew, or linked as the pet of a character's item, becomes friendly (its prototype token disposition)
- Item mods have a **Mod Cost** field (effect configuration, when *Is Item Mod* is ticked)
- Fixed the danger roll of a dangerous power used by an NPC (for example an animated item): NPCs roll with their bonus
- The classic character and caravan sheets now open in **compact mode** until it's switched off (the compress button in the header). The choice is now kept **per client** (each browser remembers it per actor), so two people can view the same sheet one compact and one expanded, and anyone who can see the sheet can switch it. The V2 sheets already opened at their compact width
- Fixed: clicking an empty power album (also from Token Action HUD) threw an error; it now says the album is empty
- **Caravan free space**: next to Consume Supplies, the inventory shows the free space as whole sacks + stones (e.g. "Free: 3 sk + 4 st")
- **Automate Caravan Transport** is now on by default
- **Active effect references**: effects on items and on actors can use `@actor.<path>`, `@item.<path>` (the effect's own item; `system.` optional) and `@items.[<type>:]<identifier>.<path>` (the actor's items with that identifier, optionally of one item type: the highest value, 0 if none) or `@items.<id>.<path>` (one exact item). An item's identifier is the slug of its name (its original English name when translated); its Effects tab shows the reference with a copy button
- **Powers on regular items**: any gear with the *album* feature holds a list of powers (Album tab, 3 slots by default, drag powers onto it). The **Projector** mod now adds the album feature and one power slot. In the inventory the image keeps the item's own roll and features add icons: a **sword** rolls the damage of a non-weapon with the weapon feature (e.g. a power album that is also a weapon), a **book** rolls the album powers of other gear. Tooltips and animated items include those powers. The Album tab was redesigned: the list of powers on the left (long names take two lines, the tooltip shows the full name; it scrolls when long) and the selected power on the right in a compact layout, with overcharge and description shown as formatted text. From the list you can use a power (d20 on hover, when the item is readied on an actor), drag powers to reorder them or out of the album (to the sidebar, an actor or another album), and move between powers with ↑/↓ or W/S. Powers can be duplicated, the level goes from 0 with no maximum, a full album says so, the list highlights when something is dragged over it, and an empty overcharge stays collapsed behind a "+ Overcharge" link. Fixed the damage roll of gear with only the weapon feature not showing
- Compendium traits now scale on their own: Fighter, Defender, Noösphere Native, Citizen Maintainer and Veteran of the Psychic Wars (+3 per skill rank), Soldier and Pleasant (+2 per rank), Hunter (critical ×3/×4/×5) and Second Heart (temporary life equal to the level). Their "update the effect when…" notes were removed (also in Antimagus). My Bones Engraved notes that its endurance loss is not automated
- More compendium items automated:
  - **Friends**: pet slots equal to your level
  - **Purplelander**: a *Post-human* effect (+3 to saves) to enable against effects that target humans
  - **Deeply Embodied**: Oldtech uses strength and Fantascience uses endurance
  - **Grounded**, **Rancher** and **Strong**: one effect per choice, enable the one you picked (Grounded no longer gives both bonuses)
  - Mods: **Remapped** changes the item's ability (edit it in the effect), **Aetherial** adds the armor to mental defense, **Life Field** now grants temporary life (5 or the item level) instead of life
  - **Cad Bird**, **Golem Steed**, **Plug-In Chimeric** and **Walking Bed** are now mounts, **Articulated G-Wagon** and **Limousine Golem** vehicles, with level, capacity, speed and supply
- **Counters**: any item can keep counters (kills, skulls, hits…) in its Effects tab (a collapsible section: click its chevron or title; the counter being edited is highlighted): name, value, optional maximum, reset value and *reset after combat*. Click a counter on the inventory row for +1, right-click for −1; right-click the item to reset them. Effects use them as `@item.counters.<key>.value`; renaming a counter renames its key, so the reference shown next to it follows the name (effects that used the old one get a warning to update them). Death Hunger and I Am Legion count kills (reset after combat), The Spear Named Blood Drinker counts wounds and the Skull Garland its skulls. Counters can also reset **each round** or **each turn** in combat (the turn of their owner): Burner and Swift (once per turn), Devastator, Slayer and Fighting Woman or Man (once per round) have a *Used* counter that does. Once-per-session/day/scene traits (Personal Daimon, Informant, Legal Immunity, Intestinal Fortitude, Loyal, Ducky, Hexad Member, Old Friend's Head) have a *Used* counter to reset by hand
- **Item tooltips** on the actor sheets now include a short excerpt of the description (first paragraph, plain text, GM secrets left out); powers and power albums keep their own text
- **Recharge** fills an item's charges back to their maximum (items with replenish only clear running low / run out) and is offered whenever a charged item is below its maximum
- **Resources follow the rulebook**: a usage roll now marks the item — a natural 13 is always *running low* (one use left, even with replenish 13+), a roll at or under the replenish score is *run out* — for weapon attacks, casting a power from the item (a power or an album on an item with replenish), the item's *Usage roll* menu entry, Use and lighting. Using an item that is already running low is its last use: it runs out with no roll (a chat line says so). Weapons have a *Usage roll on attacks* checkbox next to replenish (on by default) for items whose replenish isn't spent by attacking
- **Item uses from a counter**: gear can keep its uses in one of its counters instead of charges (Effects tab, under the counters): *uses left* counts down to 0, *uses spent* counts up to the counter's maximum. Use, lighting and animating spend it with the charges rules (one use left of several: running low; none: run out; uses back from a reset, +1 or Recharge clear the mark), so a once-per-turn or once-per-combat item runs out and comes back with its counter
- **Usage roll to animate**: animated items with replenish can make each animation a use (usage roll; running low: last use); like charges, the creature then comes back with full life and does not wear the item
- **Charges and resources**: an item with more than one charge is *running low* on its last charge; removing the last charge of a consumable marks it *run out*; adding charges back clears running low / run out, except that 1 charge left of several is *running low*. Items with replenish keep their resources from the usage roll
- **Power cost is paid**: casting a power makes a character pay its cost (power cost × level, doubled when overcharged, minus the power cost bonus). The cast dialog shows the cost, with *Pay the cost* (ticked) and points from any abilities (one small field per ability; 1 point = 1 life); life pays the rest, and when life isn't enough the cast asks for more ability points. Life can drop to 0, which opens the defeat roll. A chat line shows what was paid. The cast dialog also warns when casting is dangerous: a dangerous power, a cost above the caster's level, or an overcharge whose cost would be (it follows the power picked in an album). World setting *Automate power cost* (on by default, Optional Automations in the Rules settings). The cost shown on cards, tooltips and power names now uses one formula everywhere
- **Animated items**: deleting an animated item also removes its creature (its tokens and its actor), unless another item still uses it (e.g. the item was moved to another actor)
- **Optional systems**: a new *Optional Automations* section in the Rules settings (below the core rules) holds *Automate power cost*, *Roll triggers*, *Counters*, *Damage boost* and *Item lights* (all on by default), letting the GM turn each off: its sections and roll options are hidden and its automation stops, while the data on items and actors is kept. With *Item lights* off nothing lights a token (items, powers, animated glowing items), the light controls and presets are hidden everywhere (Token HUD, menus, item and power sheets, Baseline Settings) and the lights that are on go out
- **API for modules**: `game.sdm.api.items` (`use`, `isUsable`, `useBlockedReason`, `rolls`), `game.sdm.api.lights` (`items`, `isLightSource`, `isLit`, `litEffect`, `light`, `putOut`, `toggle`) and `game.sdm.api.counters` (`get`, `step`, `reset`, `add`, `remove`), used by Token Action HUD WTF
- **Rest (one week)**: a bed icon next to the life label on character and NPC sheets opens the weekly rest: regain all missing life, fully restore one missing ability score, or remove one burden (the Referee confirms it). A chat line records it. Macros and modules can call `game.sdm.api.rest(actorOrUuid, { choice: 'life' | 'ability' | 'burden', ability, burdenId })` (without a choice it opens the dialog)
- **Restoratives**: new consumables from the book's faster recovery list — Healing Unguent (1d6 life), Restorative Tonic (1 ability point), Medical Pack (2d6 life or 1d3 ability points) and Full Heal Treatment (all life and ability points; a service bought and used in town, weightless). The Full-Heal Kit is now usable too: it restores all missing life (rebuilding a limb or organ stays a burden the Referee removes). Consumable formulas accept `full` (all missing life / every ability back to full)
- **Token light from items**: readied gear with the *light* category or *glowing* (feature or category) can light its bearer's token, from the flame button on the Token HUD (a small list when several items can light) or the item's right-click menu (*Light* / *Put out*); a lit item shows a flame on its inventory row (click to put it out). The light is an effect on the actor, so the token's own light comes back when it goes out and it follows the character between scenes; one light at a time. Lighting spends a usage roll (replenish) or one charge; lamps and glowing gear without either light for free. A broken, run-out or uncharged item can't be lit, and running out, breaking, unreadying or deleting it puts the light out. Items have a light preset (auto, torch, lantern, candle, glow, custom with radii in grid squares, color and animation). The GM can tune the torch, lantern, candle and glow presets (radii, color, color intensity, animation, speed, animation intensity) in the *Baseline Settings* menu. The *glowing* feature is now offered on every gear subtype (it was only on weapons and wards). **Powers that create light**: a power (also album powers) can have a *Light* preset; casting it lights the caster's token until it is put out (Token HUD flame or the Effects tab), spending nothing beyond the cast
- **Actor counters**: characters, NPCs and caravans can keep their own counters too, managed at the top of their Effects tab and shown as chips under the name in the header (click +1, right-click −1). Effects read them as `@actor.counters.<key>.value`; *reset after combat* works the same
- **More from consumables**: a consumable can restore only physical or only mental abilities, grant temporary life (as an effect that ends with the item's effects), cost life every time (harm), draw a roll table on every use, and make its effects last a set number of rounds, minutes, hours, days or weeks (removed when that time passes). Violet City Healotion restores a physical ability point, Black Light Lotus's charisma lasts a day, and Cat Coffee restores all mental ability points
- **Damage when run out**: weapons (and items with the weapon feature) can tick *Damage when run out* to keep rolling their damage while run out — a charged spear is still a plain spear — while its powers, Use, lighting and animating stay blocked until recharged; that damage roll makes no usage roll
- **Consumable** feature and **Use** (separate from the caravan's Consume Supply): a consumable restores life, restores ability points or copies its effects (as temporary effects you remove when they end) onto the targeted tokens, else the selected ones, else your character — when it has more than one, the user ticks which ones apply on each use (Black Light Lotus: smoke it to heal, apply it for the charisma, or both); its effects no longer apply while it is only carried. Using it spends a usage roll (replenish, charges untouched; a natural 13 marks it running low, a roll at or under the replenish score run out), a charge, or one of its quantity. The Use icon is hidden while the item is broken or run out; hovering it lists what the use does (restores, temporary life, effects, harm, roll table). Tick the *consumable* feature and set its formulas in the item header (mods and effects can add the feature too). Healotion, Blood Brandy, Patchflesh Parasite, Black Light Lotus, Healmachine, Felix Whizz, Sun's Caress and the buff consumables are set up
- **Damage boost** (a new boost starts neutral: multiplier 1, cost 1 when left blank): weapons can be boosted by paying life, an ability or hero dice (Piezo Mace 1d6 life ×2, Noetic Blade 1 aura ×3, Oldtech Dagger-Axe 1 life ×2); mandatory boosts are paid on every damage roll (Magnificent Fireball: 1 life per shot)
- **Roll triggers** (collapsible section in the Effects tab, like counters; the row being edited is highlighted; each action shows its options only once it is picked): gear, traits and burdens can list what happens on a roll result — on attacks (any, or only melee, ranged, fantascience or oldtech attacks), saves and ability checks (any ability, or one), defeat rolls, damage, power rolls (an album's triggers can name one of its powers), usage rolls, and the item's own counters (fires once when a counter reaches a value, a value or more/less, or its maximum); rolls not tied to an item check the actor's readied gear and all its traits and burdens; conditions: success / failure (saves, defeat, attacks against a target), natural d20 (exactly, N or higher, N or lower), total (exactly, N or higher, N or lower), a die showing a number, maximum or minimum damage, matching dice, and for usage rolls running low / run out. The chat card highlights the ones that fire, and each trigger can also act: draw a roll table, put one of the item's effects on the targeted tokens or on the roller (temporary), notch / break / run low / run out / repair one step / repair fully / recharge the item, change one of its counters (add, set to a value, or reset), use a power (a power item or an album power by name, this item or another on the actor; with the cast dialog and its cost, or *free*), use a consumable, or light / put out / toggle an item's light. Damage, power and usage triggers have a **From** field: this item, any item, or one item of the actor, so a trait or another readied item can react to that item's rolls (e.g. a trait firing on one weapon's damage); items are picked by name, so it works on copies and in compendiums. Actions can set off further triggers, up to a chain of 3. Set up on the weapons that describe them (Chain Sword, Golem Killer, Mazing Crown…); Autoportal Conflux draws its delay table, Arzax Lance, the Forty-Pound Uranium Rod and the Pleasure Thorn stun their target, and the Ur Gun flags its natural-13 critical hits
- **Armor size defense**: Armorborn and Redlander add defense per stone of readied armor (sizes added up, rounded up per item; they stack)
- **Unarmed damage steps**: Ur-War Program raises the Unarmed Damage dice one step
- **Boatmaster**: crew members with Boatmaster add their level in sacks to the caravan's boats (at most each boat's capacity)
- Glass Skull, Shrunken Head, Necrolexicon NEC and Tome of Metal B are now wards with the album feature (their ward bonus is their ward value), and the Scroll Disk Belt holds 3 powers
- **Single-use powers** and **catching powers**: a power can be marked *single use* (with a warning on hover); after it is used you are asked to remove it (from the album, or the power item is deleted). The chat card of a cast power has a **Catch** handle: drag it into an item with an album to store that power, single use. The Dead God Tooth now has an album with one slot for caught powers

## v1.10.0

- Active effect expiry now uses Foundry V14's built-in effect registry instead of the system's own round/turn check
  - Effects expire by rounds, turns, or world time (seconds, minutes, hours, days...). World time only moves when the Referee advances it (e.g. through Calendaria or Seasons & Stars); combat rounds do not advance it
  - Added the "Expired Effects" world setting (Combat settings menu): keep expired effects on the actor marked as expired (default), or delete them
  - New effects with a duration in rounds or turns and no expiry event now expire at the start of their owner's turn
  - Expired effects show "Expired" in the duration column of actor and item sheets
- Added the Effects Panel: shows the temporary effects and conditions of the selected token (or your assigned character) next to the sidebar, with their remaining duration. Click an effect to open it; right-click to remove it. Can be turned off in the client settings ("Show Effects Panel")
- Fixed expired effects being disabled by every connected client instead of only the Referee
- Fixed the "New Effect" button in the Temporary section creating effects with the old V13 duration format
- Added new sheets (V2) for characters, NPCs, items and caravans, now the default sheets. The classic sheets can still be chosen in "Configure Sheet"
  - Compact layout with soft colors, light and dark themes, and the player's configured color as accent
  - Character: ability cards and attack icons use the colors of the configured ability; sword icon for melee attacks; ultraviolet corruption icon; item and trait slot meters; inventory columns scroll on their own; compact burden column; effects, biography and notes tabs; name, species and profile fields are edited only in edit mode
  - NPC: round portrait and compact initiative
  - Item: fields grouped in cards (item type first, then inventory) with no gaps between them
  - Caravan: layout follows the window width (icon-only tabs and fewer columns when narrow) and the compact button switches between the narrow and wide sizes; lean header; route cards; crew split into Characters and NPCs sections with type icons; cargo area highlighted while dragging items
  - Long field labels wrap instead of being cut off
- Added a "GM Notes" tab to all items, visible only to the Referee
- Item sheets now show the item's integrity (notched/broken) and resources (running low/run out): an icon on the item image (broken items are greyed out, run out items faded) and buttons to change the state, shown only when the item is not intact or not full
- Item chat cards show small integrity and resources icons, with the state on hover
- Added "Remove from Container" to the right-click menu of items inside a container, on character and caravan sheets (before, only drag and drop did this)
- Money values are shown with thousands separators (display only): cash, cost and wealth fields, item rows, tooltips, chat cards and the Compendium Browser. XP and other numbers are unchanged
- Item description and GM notes editors now grow with their content, on classic and new sheets
- Compendium Browser: new look, results bar with sorting, active filter badges and a drag hint; the filter list no longer scrolls inside the sidebar; the "All Items" tab is now "Items"; fixed the right-click menu being covered by the result cards
- Container capacity label is now "Capacity (st)" (pt-BR "Capacidade (mo)"); pt-BR "Máx. de Poderes"
- Money fields on character, NPC and caravan sheets show the cash symbol in front of the field
- Caravan crew placement:
  - Characters are always placed before NPCs
  - Referee buttons on the caravan Crew tab to place only the characters or only the NPCs
  - The caravan token HUD button gathers the crew members that are on the scene (including ones placed from the sheet) and deploys only when none are there, instead of showing an error
- Skill traits: the "Skill Modifier" label is now "Modifier"
- pt-BR: "desmorto" instead of "morto-vivo"
- Removed unused image files
- Fixed the "vorpal" weapon feature appearing twice in the feature list

## v1.9.2

- Fixed mounts and vehicles not being droppable on the caravan "Mounts & Vehicles" tab: they can now be dropped anywhere in the tab (from compendiums, sidebar or other actors), and the tab is highlighted while dragging
- Fixed "null" tooltip when hovering the caravan capacity in the header
- Fixed an untranslated key in the caravan capacity breakdown
- Mounts list: wider speed column and "New Mount" button that no longer wraps; pt-BR "Nova Montaria"

## v1.9.1

- Items with the Vessel feature now get the Charges feature and a capacity of 12 doses automatically
- Fixed compendium items that lost data in the v14 migration:
  - Restored replenish scores on gadgets and trait items that only had them in the description text
  - Restored the Kingshead Flask's 12 charges
  - Restored missing features on the Alarwurm Box, Invisibilly Bomb, and Tome of Metal B
- Fixed item names with extra spaces (Porcelain Walker, Monochrome Mirror, Cordwood™ Jumpsuit & Headset) and the "Full Archaic Auto Destruction" macro name
- Removed feature rules repeated in item descriptions (Antimagic Mouth, Empty Glasses, Savehead Jar)
- pt-BR: fixed the "no Blood Dice" and "Use Hero/Blood Dice" messages, plus spelling fixes ("heroico", "Bônus", "húbris")

## v1.9.0

- Added Mount and Vehicle item types, with level, capacity, speed, cost, supply, and features
- Added the "Mounts & Vehicles" compendium pack
- Added the "Automate Caravan Transport" world setting (Caravan settings menu, off by default). When enabled, caravan capacity and speed are derived from its mounts and vehicles, and the header inputs become read-only
  - Capacity: unassigned mounts carry their own capacity; a vehicle counts only if its assigned mounts pull enough (carting ×3, dragging ×2); automatic (self-propelled) vehicles always count
  - Speed: slowest vehicle (a pulled vehicle's speed plus its slowest mount's) plus slowest unassigned mount, plus the speed bonus. Speed is no longer capped and shows its real value with the nearest description (e.g. "Very Fast (+4)")
- Redesigned the caravan "Mounts & Vehicles" tab when automation is on: vehicle and mount lists with inline speed and supply edits, pull mode and vehicle assignment dropdowns, drag a mount onto a vehicle to assign it, drag-and-drop sorting, feature tags, and capacity/speed breakdown tooltips
- Added mount and vehicle features (all-terrain, cart, sled, flying, golem, undead, water, and more). A vehicle's Cart or Sled feature sets the pull mode of the mounts pulling it
- Compendium Browser: added a "Transport" tab for mounts and vehicles with transport filters; the "All Gear" tab is now "All Items"; cards without a description no longer show "null" on hover
- Mount and vehicle chat cards and compendium cards display cost, capacity, speed, and supply
- "Count Crew Weight" is now enabled by default for new worlds

## v1.8.0

- Added a button to the Caravan tokens HUD to gather/deploy crew tokens in the active scene

## v1.7.1

- Fixed GitHub issue #3: "Caravan capacity active effect gets double counted"
- Fixed incorrect Item fields being suggested for Actor-related active effect changes

## v1.7.0

- Reduced bundle download size
- Added "Mods & Effects" compendium pack
- Added support for @item and @actor references in active effect values
- Active Effect changes show different available keys depending on whether the effect will be transferred to the Actor that owns an item containing the effect. For transfer: true effects, show Actor property keys; for transfer: false, show Item property keys.
- Items will count and limit the number of installed mods
- Item Mods are active effects flagged as an item mod
- Pet items that have a linked actor will display an icon to open that Actor sheet in the Item sheet, and a button to unlink the Actor
- When applying damage to an Actor that has items with the Flare feature, a pop-up will be displayed to ask if the damage should be limited to the Flare amount
- When you roll damage from items with the Draining item mod, you gain temporary life.
- Added the "# range" and "ward" options to item features
- Targeted attacks will display the target resistances in the chat card

## v1.6.0

- Added new Oracle type: 2d12 Order & Chaos

## v1.5.6

- Fix many compendium items wrongly marked as human supply.

## v1.5.5

- Improved Compendium Browser performance by loading an index when game world is loaded
- Added a button on Caravan Sheets to open the Compendium Browser

## v1.5.4

- Fixed issue causing the compendium browser not to open

## v1.5.3

- Fixed issue on compendium browser features filters

## v1.5.2

- Fixed issue on caravan sheet

## v1.5.1

- Fixed duplicate features in item sheets.
- Added Token tag to Actor sheets for unlinked actors (prototype token that is not linked to Actor data).
- Added tooltip informing how much XP a character needs in order to level up.
- Added crew members' cash in the caravan wealth tooltip.
- Added a function to automate incrementing a caravan's extra days tallied value.

## v1.5.0

- Fixed active effect property field not displaying options
- Fixed compendium browser wrongly displaying versatile damage for non-versatile weapons
- Added size and unit fields to pet item sheets
- Added a configuration to display and deduct crew weight from caravan inventory slots
- Allowed decimal values for capacity on NPC sheets
- Added size and unit to track weight on all Actors (editable with active effects and defaulted to 1 sack)
- Added the system object into available roll-data for Characters and NPCs
- Fixed inventory sacks' labels always displaying "sack 2 label"

## v1.4.0

- Added the Compendium Browser
- Added icons to open the Compendium Browser from Actor sheets
- Added a "Display in Chat" button on Item sheets
- Automates Usage Rolls for items with the replenish feature when you roll the item's damage
- Added more information to item chat cards when you Display an Item in Chat

## v1.3.0

- Added support to Group Checks
- Added Group Chase rolls to character sheets
- Added Relife rolls to character sheets

## v1.2.1

- Fixes some missing features in many compendium items

## v1.2.0

- Adds area feature
- Fixes Bullet Plate Weave armor type to heavy

## v1.1.3

- Small fix to system version

## v1.1.2

- Small fix to system version

## v1.1.1

- Fixes gear features missing in v14
- Fixes long range weapons always changing to medium range

## v1.1.0

- Renames the system to When Time Fades (WTF)
- Updates logo, links and display text to reflect the system rename

## v1.0.1

- Fixes an issue where equipment with a weapon feature does not display the damage roll icon (v14)

## v1.0.0

- V14 support

## v0.23.0

- Added new Oracle type: 2d12 Order & Chaos

## v0.22.3

- Improved Compendium Browser performance by loading an index when game world is loaded
- Added a button on Caravan Sheets to open the Compendium Browser

## v0.22.2

- Fixed issue on compendium browser features filters

## v0.22.1

- Fixed duplicate features in item sheets.
- Added Token tag to Actor sheets for unlinked actors (prototype token that is not linked to Actor data).
- Added tooltip informing how much XP a character needs in order to level up.
- Added crew members' cash in the caravan wealth tooltip.
- Added a function to automate incrementing a caravan's extra days tallied value.

## v0.22.0

- Fixed compendium browser wrongly displaying versatile damage for non-versatile weapons
- Added size and unit fields to pet item sheets
- Added a configuration to display and deduct crew weight from caravan inventory slots
- Allowed decimal values for capacity on NPC sheets
- Added size and unit to track weight on all Actors (editable with active effects and defaulted to 1 sack)

## v0.21.0

- Added the Compendium Browser
- Added icons to open the Compendium Browser from Actor sheets
- Added a "Display in Chat" button on Item sheets
- Automates Usage Rolls for items with the replenish feature when you roll the item's damage
- Added more information to item chat cards when you Display an Item in Chat
- Ends the development of new features for FoundryVTT v13

## v0.20.0

- Added support to Group Checks
- Added Group Chase rolls to character sheets
- Added Relife rolls to character sheets

## v0.19.1

- Fixes some missing features in many compendium items

## v0.19.0

- Adds area feature
- Fixes Bullet Plate Weave armor type to heavy

## v0.18.2

- Merges v13 compendium fixes and updates system version

## v0.18.0

- Renames the system to When Time Fades (WTF)
- Updates logo, links and display text to reflect the system rename

## v0.17.3

- Fixes an issue where equipment with a weapon feature does not display the damage roll icon

## v0.17.2

- Fixed corruption roll enricher on danger roll chat card result

## v0.17.1

- Hotfix for Calendaria integration on Caravan sheet

## v0.17.0

- Added support to calendaria: SDM module

## v0.16.0

- Added support to many [text enrichers](https://github.com/luizrcb/foundryvtt-sdm/wiki/Text-Enrichers)
- Added corruption roll enricher button to the failed danger roll chat card
- Added defeat roll enricher button to the apply damage chat card when actor's current life is reduced to 0
- Added burden item references to failed corruption rolls chat cards (you can drag and drop the burden item from the chat into a character sheet)
- Added instructions about dropping actors on pet items to create a link

## v0.15.0

- Refactored Agents & Helpers tab on Caravan sheets
- Added support to place Caravan Crew tokens on the scene canvas using the Place Crew Members button
- Inventory roll icons were moved to item images on hover
- When the usage of a power is dangerous, you can click the dangerous tag to perform a Danger Roll

## v0.14.0

- Added compact mode to Character and Caravan sheets

## v0.13.7

- Added cash utility functions to Actors

## v0.13.6

- Fixed item chat cards wrongly displaying the dangerous tag
- Added an optional biography field to the NPC generator dialog

## v0.13.5

- Fixed some pt-BR localization
- Fixes some small UI issues on custom results chat cards (morale, reaction, corruption)
- Fixed some typos on corruption tables

## v0.13.4

- Hotfix on caravan actors prepareData

## v0.13.3

- Fixed steps to learn not working correctly for power traits
- Added support to mark a power as dangerous
- When using a power whose cost is higher than the actor level, a dangerous flag will be added to the chat card
- Reordered some d10 oracle results, higher values should be better.

## v0.13.2

- Added Capacity (in sacks) to NPC sheets
- Reordered the positions of some fields on NPC sheets
- Improved UI for item and cash transfers
- Added missing ward type to Dusty Orb item

## v0.13.1

- Random Generated Humans NPCs without a name will get a random name rolled from names tables (thanks to _TheGiftOfGabes_ for the feature suggestion)
- Added default game world settings on startup
- Fixed wrong DiceSoNice hook used to register custom dice themes, causing oracle dices to get no texture
- Small fix to new game world initial messages order

## v0.13.0

- Added new gear type: container
- Added context menu option (sheet item right-click) to delete container and all its contents
- When a container is dropped or transferred to another actor, all content in the container will follow along
- Users can drop pet items from Actor sheets into the scene canvas to create a pet token
- Added referee settings to allow/block players from rerolling their characters and dropping pet items to the scene canvas
- Added initial system message with links to Luka Rejec's platforms
- Added initial system message with links to Luber's platforms
- Added upper limit to: trait's sources to learn, and burden's steps to cure
- Minor style changes to system icon
- Allowed gear pets to be sent to caravan sheets
- New fonts on chat messages for fumble, critical success and usage roll results
- Removed caravan tokens from being added to the combat tracker
- Added support for a pet tab in the Token Action HUD SDM module

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
- Change the font of the “WTF Chromatype Dice” theme

## v0.2.5

- Add support to flag items as hallmark (hallmark item leveling is not automated)
- Add a Chromatype configuration option for clients to choose a main color for UI elements
- Users of the “Dice So Nice” module will find a special “WTF Chromatype Dice” theme to color their 3D dice according to their chromatype

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

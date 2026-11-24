# CHANGELOG

## v1.12.0

- **Auras** (optional, on by default): an effect can be an aura (effect sheet: *Aura*). It radiates from its actor's tokens to the tokens in reach: a zone band of the scene (close, short, medium) or a distance of its own; allies, enemies or everyone; walls can block it; only in combat; its reach shown or only on the Regions layer. Tokens inside get a copy of the effect (marked "Aura from Bob"), removed when they leave; the aura's own changes don't apply to its actor unless *applies to its actor too*. *Values from the source* reads @actor / @item on the source; auras of the same name that don't stack: only the best one applies (*best by* formula, else the sum of its values). The Referee's game does the work, on the scenes people are on. Off while the Aura Effects module is active (a warning tells the Referee)
  - Soldier's *Ally Defense Bonus* is now an aura: allies next to the Soldier add the Soldier's charisma to their defense, the best Soldier only (run npm run build:packs)
- **Areas**: items with an area have a *Shape* (circle, square, cone, line, ring — a wall one square thick — or around the user — a burst around its token, nothing to place), *Affects* (everyone, enemies only, allies only: no friendly fire when set) and *Vehicle size*. Sizes follow the item, not the scene: the book's area table mixed with the d20 grid rules, in 1.5 m (5 ft) squares and checked against the book's numbers of targets — circles and squares 2 / 6 / 10 squares across (4 / 32 / 80 squares for circles); rings 3 / 7 / 13 across (8 / 24 / 48 squares of wall: around one creature, a small group, a crowd); cones 3 / 6 / 11 long (7 / 24 / 71 squares); lines 4 / 12 / 24 long, one wide (vehicles: circles ~10 / 50 / 150 m across, cones and lines five times as long)
  - On square grids an area is made of squares: those it covers more than half of (or whose middle it covers), so a circle isn't drawn as a square; any token on one of them is inside. Circles and squares always snap to grid intersections, rings to the middle of a square (around a creature), their wall closed at the diagonals; the squares show while placing. Cones and lines are fixed patterns in eight directions (the nearest to the cursor), from the side of the user's token (straight) or its corner (diagonal), placed with Foundry's outline and measurements as a guide: a line is one row of squares (a staircase on the diagonal), a cone is as wide as it is far (rows of 1, 3, 3, 5, 5…; diagonal: a fan of 6 / 20 / 64 squares). Splashes in a cone or behind the target use the same patterns. Gridless and hex scenes keep the exact shape and the tokens' centers
  - The attack card of an item with an area has **Place area**: Foundry's region placement (wheel rotates, click places, right-click cancels; cones and lines start at the attacker's token and point at the cursor). A card compares the attack with every defense inside (hit, miss, critical, force or fail) and targets the hits — a tie gets *Sacrificed* / *No sacrifice* for the Referee, and a sacrifice adds it to the hits and to the damage; its **Roll damage** button rolls once for the whole area, on the tokens targeted when it's clicked (the hits, plus or minus what you Shift+T): with *Apply damage automatically* every token hit takes it (a line and an Undo each), otherwise a button per token hit applies its share. Conditions and triggers act on the hits. **Target hits** and **Remove area** on the card; the area stays on the map until removed
  - **Draw an area** (scene controls, Tokens): a shape and a size placed on the map with no item, roll or card (cones, lines and around the user from the selected token); the same button removes the drawn areas (your own; the Referee's: all on the scene)
    - The Referee also sets a **Hazard** there (when, damage, condition, uses): with damage or a condition the area gets a Hazard behavior (a trap in two clicks)
  - Consumables with an area (grenades): Use places the area first, and the tokens inside are the Use's targets (saves included)
  - Powers (and each power of an album) have an *Area* and *Shape*: attacks with them place the area like weapons, and the power's card has **Place area**: a card lists who is inside, targets them, and has a button per token to apply the power's roll
    - An attack made with a power that has an area places the area once: the power's roll from the area card (damage or healing) isn't placed again and has a damage and a heal button per token hit; a power that rolls nothing is used at once after the attack, on those hit (or everyone inside, for a save)
  - A circle or square placed beyond the item's range (its zone) gets a warning, also on the card; cones and lines start at the attacker; ranges written as text aren't checked
  - Fire Breath is a cone (run npm run build:packs)
  - **Lingers** (gear and powers): the area stays on the map and whoever stands in it has the item's effects (not its mods, nor those it gives its bearer), following *Affects*; it lasts its *Rounds* in combat (0: until removed). A consumable used in one doesn't also copy its effects. Uses the Auras automation
    - *Light* (none, its reach, torch, lantern, candle, glow): the lingering area sheds light while it lasts (reach: to its edge; color and animation from the item's light); when it follows the user, the user's token lights up instead
    - an effect of the item with *Damage each round* (to the tokens in its aura) hurts whoever is in the lingering area at the start of each round (a wall of fire, burning ground); *Follows the user*: the area moves with its user's token (a blessing around you)
  - **Across**: a size of its own in the world unit (two squares on a 5 ft grid: 10), instead of small / medium / large
  - The power's area card has a damage and a heal button per token (a healing wave); a consumable's *Harm* in an area takes Bystander's level off
  - The attack dialog shows the area of the chosen item
  - Hero dice on an area's damage correct every token it was applied to
  - **Area first**: rolling an attack or power with an area places the area before the roll (right-click or Esc cancels the roll, nothing paid; with no token for a cone or line it rolls and **Place area** stays on the card); the card shows everyone inside, with **Reposition area** (placed again, everyone checked again) and **Remove area**. Hero dice on the attack check everyone again with the new total
  - **Resolved by a save** (gear and powers): instead of the attack, everyone inside saves (an ability or their choice, and a difficulty); the card shows each result. A passed save avoids it, takes half damage (rounded up) or gets shorter effects (1 round); a failed one takes the full damage and the item's effects; a tie gets the sacrifice buttons. Consumables used with a save area post the area card: Harm by each save, Life and cures for everyone
- **Damage each round**: an effect can deal damage at the start of each combat round, to the tokens in its aura or to the last foe its actor attacked
  - Glowing Skeleton: *Radiant Bones (unclothed)*, switched on by hand: adjacent creatures lose life equal to your level each round
  - Irresistible: your level in damage each round to the last foe you attacked, hit or miss
  - Bystander: takes its level off an area's damage
- **Colonist**: drop up to five creatures on the trait's sheet to form the hexad; *Night with the hexad* gives each one temporary life equal to your level
- **Splash** (weapons): more creatures than the target, once per attack (hit or miss), each one against its own defense (natural 1 misses all, natural 20 hits all; a tie gets *Sacrificed* / *No sacrifice* for the Referee). Shape: around the target (adjacent), a cone from the attacker (placed: a cleave), or behind the target (a line or a cone continuing the attack: a piercing shot, a blast through), with a size (small / medium / large or Across) and *Affects*. Damage: a formula, the weapon's damage, or half of it. A button on the attack card rolls it once and applies it to those hit. Mouth of the Void splashes 1d6 around the target (run npm run build:packs)

- **Line of effect**: areas don't go through walls (those that block movement, closed doors included): a square (on gridless and hex scenes, a token's middle) is in the area only when nothing blocks the line from the area's origin — the middle of a circle, square or ring, the user's token for cones, lines and around the user. Placing, the squares placed, lingering areas and splashes (around the target: no wall between them) follow it
- **Hazard** (region behavior, *Perigo*): add it to any region (Regions layer, or one drawn with *Draw an area*) for traps and damaging zones — on entering, at the start of the token's turn and/or of the round; a damage formula (Bystander takes its level off), a condition for some rounds (0: until removed), an optional save (ability, difficulty; a passed save avoids it, halves the damage or shortens the condition to 1 round; ties and hero dice as for other saves), *Affects* by disposition and *Uses* (it switches off when spent: a trap that fires once). In combat a token is hit at most once per round. The Referee's game resolves it
  - Lingering areas (gear and powers) have *Damage each round* (none, the item's damage, a formula), *Also on entering* and a *Condition* with its rounds: placing the area puts a Hazard on its region with the area's save; those it just hit aren't hit again for entering
- **Applying damage**: the card buttons (−N, ½, ×2, heal) and the chat card's right-click menu act on the **targeted tokens, else the selected ones**; players apply only to tokens they own (a warning says how many were left for the Referee). *Apply damage automatically* still applies to any target
  - Area cards: **Apply to all** / **Heal all** (each its own share, Bystander and saves counted); what was applied stays on the card as a line with an **Undo** each; the roller applies to their own tokens, the Referee to all
- **NPC defense from effects**: NPCs take `system.defense_bonus` (the same key as characters) on top of their typed defense, and `mental_defense_bonus` / `social_defense_bonus` against those attacks; the sheet edits the typed defense and shows the total beside it. Corroded and slowed use `defense_bonus` for everyone. No migration (the new values start at 0)
- **Effects panel**: shows auras — those the actor radiates (round, dashed border) and those it receives ("Aura from …"); right-click removal is for the Referee only, and never on a received aura
- An actor's own auras show in its Effects tab again (to edit or delete them)
- Damage each round (auras, lingering areas), lingering areas' rounds and hazards work with a combat not linked to a scene
- Life cards name the aura, area or hazard that did it
- Ties on area and splash cards: *Sacrificed* / *No sacrifice* side by side under the line
- **Aura reach in grid spaces**: an aura's *Distance of its own* is now *Spaces* (squares or hexes beyond the token's edge: 1 = the spaces next to it); auras with the older distance (feet or meters) keep it. Auras are drawn along the grid, following the scene's *Grid Diagonals*
- **Aura light**: an aura can light its source token (not those who get it) — its reach (dim to the edge, bright half), a light preset (torch, lantern, candle, glow) or custom (bright / dim in spaces), with an optional animation; its color is the aura's. It follows the aura (combat only, off, removed)
- **Effects panel**: an aura the actor radiates has a solid round border when it also applies to its actor, a dashed one when only to the others ("Aura — on itself too / not on itself" on hover); hovering an aura also shows the start of its description
- **Leave a light on the map**: a lit item in hand can be left on the token's square (Token HUD light palette, or the item's right-click menu). With Item Piles it goes into a pile whose token sheds its light (it moves with the pile and goes with it) and whoever picks it up gets it back lit; without, an ambient light and the item's image mark the square under the token, the item stays in the inventory greyed and marked as left (it takes no slots and can't be lit), and *Pick up* on the owner's token HUD next to it brings it back lit. Leaving and picking it up spend nothing — only lighting does; the chat says so (Item Piles posts its own pick-ups)
- **Item Piles**: an item dropped on the map keeps its effects on (its aura radiates from the pile), and picking it up keeps them on (the aura now radiates from its new bearer; items already in a pile before this change: drop them again once); a pile created by dropping any item takes its dropper's disposition (an aura for allies helps the dropper's side; the Referee's game sets it, so the Referee must be connected)
- Damage each round (auras, lingering areas, the last foe) and hazards leave alone tokens at 0 life or defeated
- Damage and power cards from an area keep only their per-token buttons and *Apply to all* (no −N / ½ / ×2 / heal row too)
- An area card with nobody inside says why when *Affects* is set: "Nobody inside (enemies only)"
- Rerolling a character no longer fails ("ActiveEffect … does not exist!") when deleting its items also removed some of its effects (a light, an aura's)
- Empty fields look empty: settings no longer show placeholders that read as values (formulas, numbers, colors); the hints that remain (drop a table, any power…) are italic and faded in every sheet and dialog
- Auras: *Best by* is now *Best aura by*, and it and *Stacks* explain how auras with the same name compete
- **World Settings**: the Referee's 11 settings menus are now one window with tabs (Rules, Characters, Combat & movement, NPCs, Systems, Caravan & money, Advanced; rainbow icons). Each tab has its sections; Save stores every tab, Reset only resets the tab in view. Setting values are kept. Client Settings (players) is unchanged
- **Once abilities**: an item's *Once ability* is run by the system and used up by its *Used* counter — **Second Chance** (falling to 0 life, fall to 1 instead), **Fake Out** (falling to 0 life, the player may spend a hero die: the blow didn't connect) and **Recast** (a button on the character's power cards casts the power again for free). Compendium: Second Chance, Fake Out, Recast
- **Counters**: *Also reset* **each session** (the Referee's **New session** button in the Actors sidebar, or `game.sdm.api.newSession()`); a counter marked **Hero die** is recharged by spending one (right-click the item). Personal Daimon, Informant and Legal Immunity reset each session; Hexad Member, Ducky and Old Friend's Head each day
- **Consumables**: **Overdose** (a condition or one of the item's effects, saved against once a target took more than the free doses per day or week; escalating makes each dose one step harder), **Purge** (removes other consumables' effects from the targets) and **Meant for** (a reminder of who it's for). You Go, Injectable Fodder, Healmachine and Synthetic Blood set up
- **Trigger actions**: **Ability damage** (lower an ability of the targets or yourself; *choose* lets the attacker pick) and **Purge**. Cerebral Purge purges its targets
- **Mods with triggers**: an item mod can carry roll triggers that work as its item's while installed. Atrophic, Stunning, Crippling and Saboteur now act on a hit (ability damage; stunned, slowed or prone with a save)
- **Free area placement**: hold **Shift** while placing an area on a square grid — cones and lines aim at any angle from the edge of the user's token, circles, squares and rings go anywhere (no snapping; the wheel rotates squares). Free cones use the same squares rule as circles (more than half covered, or the middle); a free line takes every square its middle passes through, not those it only grazes at a corner. Without Shift nothing changes
- **Mod triggers editor**: an item mod's effect sheet has a **Triggers** tab, the same editor as the item's (rolls, conditions, actions)
- **Damage against conditions**: gear and traits can multiply their damage against a target with chosen conditions (*Damage against*); the damage dialog suggests the multiplier and says why. Stabber deals ×2 against surprised targets (run npm run build:packs)
- **Use actions**: a consumable's Use section has the trigger action list (condition, effect, counters, charges, cast, light, life, ability damage, purge, roll, hero dice, animate, table, summon), run on the Use's targets every time it's used
- **Summoning**: a **Summon** trigger action (also a Use action) brings creatures next to the one who rolled: drop an NPC, or a roll table whose results are NPCs (one draw each); how many (a formula), level (blank: its own), rounds (0: until dismissed), up to how many at once, placed **nearby** (the nearest free squares, not through walls) or **by hand** (right-click skips one), and *Gone at 0 life* (they leave when the summoner drops to 0). The Referee's game makes them: each NPC is copied once per level into a **Summons** folder, tokens unlinked, on the summoner's side and owned by the summoner's players; in a running fight they join it and roll initiative, and with rounds they leave when those are over (or the fight ends). The card lists who came with **Target** and **Dismiss all**; the Token HUD has **Dismiss**
- **API for modules**: `game.sdm.api.items.actions(item)` (an item's actions: usage roll, charges, recharge, hero die recharge, animate, deploy / recall a ride, hallmark upgrade), `items.markers(item)` (single use, lit, upgrade available) and `items.describeUse(item)`. Token Action HUD SDM 0.7.0 shows them in an *Item actions* group
- The Table field of mod triggers takes a dropped roll table too
  - Summoned creatures are marked: a *Summoned* effect with its own icon on the token (also in the Effects tab and the effects panel: by whom, with what, how long) and a mark next to the name on the sheet. The card shows the rolls for how many and the level, with Target and Dismiss all side by side. A copy in the Summons folder made before its NPC last changed is brought up to date on the next summon (stats, token, items, effects)
- **Item mods at a glance**: mod effects have a puzzle-piece mark in the item's and the actor's Effects tabs (hover: mod or hallmark upgrade, off, the start of its description); the installed-mods track names the mod in each slot, and on the item sheet lists the mods under it (click opens one); hallmark mod upgrades show their description
- **Hero dice on initiative**: every initiative card of the round (a group's roll or a single one) has *Use Hero Dice* until the round's first turn ends; any character can raise or lower it, and the new total goes to everyone that roll set, each keeping its tie-break decimals. Initiative cards no longer get damage buttons
- **NPC temporary life**: NPCs have temporary life like characters (on the sheet when on, in the token's life bar and HUD, taken before life), so consumables, Colonist's night and effects give it to them too
- **Hazard rolls**: a hazard's damage is rolled to the chat for the Referee only (3D dice; reveal it from the message's menu)
- **Splash preview**: before a splash is rolled its squares show on the map and a dialog lists who it reaches (hit, tie, miss) to confirm or cancel; the damage lands once the dice finish rolling
- **Power cost on attacks**: an attack made with a power (chosen in *With*) casts it, so its cost is paid on the attack, hit or miss (the attack dialog shows the cost box while a power is chosen); the power rolled from the attack's card costs nothing more (overcharging pays only the difference)
- **Visibility labels on every message**: blind, Referee only and private show in the header of messages that aren't the system's cards (plain rolls, summons, splashes, hazard rolls)
- **Grid Diagonals**: the system's default for Foundry's *Grid Diagonals* is now **alternating 1 / 2 / 1** (worlds that picked a value keep it; relaunch the world). Lines on a perfect diagonal cover as many squares as their length allows by the rule set (3 / 8 / 16 with alternating, 4 / 12 / 24 with equidistant) and their guide ends where the squares end; the area range warning measures by the rule too, like the other range checks. Circles, squares, rings and cones keep their shapes
- **Draw an area** remembers the shape, size, width and color each user picked last, and has a **color** picker (the area's color; first time the user's)
- **Lines and Grid Diagonals, with Shift too**: a line aimed freely with Shift ends where its length does by the Grid Diagonals rule, like one aimed without Shift; the line's guide is measured by the grid (it ends at its squares and shows its full length, 18 m on the diagonal too) and is drawn as an outline only, so the squares lit up while placing are exactly those it hits
- **Width for lines and rings**: gear, powers, album powers and Draw an area have a *Width* (world unit; empty: one square) — lines become bands that many squares wide (straight, diagonal staircases side by side, free with Shift; an even width leans to the cursor's side), rings get a thicker wall growing inward
- **Shapeshifting (forms)**: an effect's **Form** tab — a look (shown name, token image, scale, size, portrait too), *Becomes* an NPC (its look, and its attacks and traits when *Grants* is empty), *Grants* items (claws, a bite, a trait; their uses fresh each time or remembered), *Keeps* everything, the mind only (own weapons, armor and wards set aside; own powers usable or set aside) or nothing, and temporary life (a formula; optionally ends when it runs out). While the effect is on, the tokens take the look, granted items are added (no slots, marked), own gear is set aside and the sheet shows a form banner with **End form**; ending (switched off, deleted, expired, temporary life gone, End form) puts it all back. One form at a time; forms show in the effects panel. Works on characters and NPCs, from Use, triggers, powers or by hand
- **Cooldown counters**: a counter can come back to its reset value N rounds (or its owner's turns) after each use or after it runs out, in combat; an hourglass shows what is left, and it's back when the fight ends
- **Replenishers**: a consumable's *Replenishes* (anything, a small item of 1 stone or less, a weapon, a machine) recharges one item picked when it's used, among the targets' items with something to give back — run out, running low, spent charges, a uses counter not full, counters that recharge (reset rules, cooldown, hero die) or that count down from full; charges and uses are refilled, the marks cleared and those counters reset. Nothing that fits: it isn't used up
- Fixed: "ActiveEffect … does not exist!" errors when two clients removed the same effect (aura sync, lights, rest, Use, next roll, area saves, conditions, animated items, generator)

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
  - The Animation tab has two cards: *Animation* (when animated, cost to animate, turn back after combat) and *Creature* (the NPC, its table, level and stats, with the creature's size as a number and a unit)
  - Drop an NPC (sidebar or compendium) on the Animation tab to make it the item's creature: its table and stats (life, defense, morale, bonus, damage, initiative, capacity, size, speed) fill the tab
  - An item that comes from the compendium already linked to a compendium NPC (e.g. Soul Siphon Spear and its Spear Snake) imports its own copy of that NPC into the "Animated Items" folder the first time it is animated; the item keeps its own attributes. To make such an item, drop a compendium NPC on the Animation tab of the item in its (unlocked) compendium: it fills the tab and keeps only a link, nothing is imported into the world
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
- **Dead NPCs** (V2 sheet): grey portrait with the skull centered over it and a red *Dead* badge by the name, like characters (the small skull no longer sits off the portrait's corner)
- **Dead characters** (V2 sheet): the life card becomes a *Dead* card with a *Roll relife* button and the four relife options, the portrait turns grey with a skull over it, and a red *Dead* badge sits next to the name
- **More switches**: world settings to turn off NPC extras in the generator and NPCs entering lit
- **NPC traits compendium**: the 30 traits of the NPC tables are now items in a new *NPC Traits* compendium (description, and toggle effects or counters where they help: Teamwork, Tactical, Rockblood, Evasive, Frenzy, Feedback, Once Again); the NPC generator adds the item instead of a name-only trait
- **NPC extras**: the NPC generator can add rolled extras (none, by level, 1–3): special attacks (60: natural weapons with roll triggers — venomous bite, acid spit, tail sweep, crushing grip, shock lash, bleeding claws, fire breath, draining touch —, fitting weapons of the compendium, and attacks from the corruption tables such as needle teeth, radula tongue, keratin tentacles), oddities (62: bioluminescent, armored hide, regenerates…, fitting traits and trait items of the compendium, and corruption mutations such as carapace, horn platelets, secondary form, alien organ, glowing spores), powers within the NPC's reach (64) and possessions (the 50 strange items), drawn from four roll tables in the new *NPC Extras Tables* compendium (new items in *NPC Extras*); world settings can point to your own tables. Everything the generator gives an NPC (its table trait and extras) comes readied
- **Natural light**: an NPC with a light trait enters the scene lit (with *Item lights* on)
- **NPC variability** (optional, off by default): NPCs can have an individual profile on top of their table (life %, defense / bonus / morale offsets, damage die steps, archetype: brute, agile, elite, weak, coward, fearless). The NPC generator rolls it (low / high variability, archetype none / random / chosen), unlinked tokens of NPCs without a profile roll their own when placed (Shift skips; NPCs with a profile are copied as they are), and level ups keep it. The cog next to the NPC's level shows it and can remove it
- **Item Piles built in**: the system sets up Item Piles itself (money as the currency, gear as loot, traits and burdens left out, quantity and cost, merchant item previews show descriptions), so the *Item Piles: SDM* companion module is no longer needed (if it is still active the Referee is told it can be disabled). The Item Piles currency follows the *Currency name* and *Currency image* settings, also when they change
- Changing the *Currency name* or *Currency image* setting also renames / re-pictures the money already in inventories (actors, unlinked tokens, the Items sidebar) that still had the old name / image
- **Pets from compendiums**: a pet item in a compendium can link a compendium actor (drop it on the unlocked item; it keeps its name and description). When the item joins an actor, the Referee's game imports its own copy into the Pets folder (owned by the actor's owners, linked token, friendly for characters) and links it; dropping a compendium actor on a character's pet item is accepted the same way. Deleting the item deletes that copy and its tokens unless another item still uses it. Pet Bird and Vicious Bird come linked to their creatures
- Deleting an actor removes it from every caravan's crew
- **Conditions**: the token status list is now the WTF conditions taken from the game's texts (item features, the defeat roll, items, traits and powers): Dead, Unconscious, Asleep, Stunned, Paralyzed, Confused, Mad, Nauseated, Slowed, Weakened, Blinded, Deafened, Frightened, Prone, Grabbed, Invisible, Petrified, Poisoned, Bleeding, Burning, Corroded, Flying — translated, with a short rule on hover in the Token HUD and the effects panel
- **Automate conditions** (optional, off by default): bleeding (1 life) and burning (1d4) cost life at the start of the turn; stunned, paralyzed, unconscious, asleep and petrified lose the turn; grabbed and frightened get a reminder; stunned, blinded and confused last a round; asleep wakes when hurt; corroded (−1) and slowed (−2) lower defense; the defeat roll knocks out (7, until the fight ends) or stuns (8–11); the roll dialog preselects advantage / disadvantage from the roller's and the target's conditions; weakened notes half damage on damage rolls
- **Linked or unlinked at a glance** (Referee): a small link icon next to the name on character and NPC sheets shows whether the prototype token is linked (red on an unlinked character); hover explains, **Shift+click** switches it (for tokens placed from then on)
- **Token follows the actor**: changing an actor's image or name also changes its prototype token's image or name, when they were the same before (token art or a token name set on purpose is kept). Renaming an actor no longer renames a token that had its own name
- Roll triggers: the value, counter step and charges boxes are short again, an actions panel opened or closed by hand stays that way while editing, and the cost and boost resource lists read Life / Hero dice like the abilities
- The classic character and caravan sheets now open in **compact mode** until it's switched off (the compress button in the header). The choice is now kept **per client** (each browser remembers it per actor), so two people can view the same sheet one compact and one expanded, and anyone who can see the sheet can switch it. The V2 sheets already opened at their compact width
- Fixed: usage roll triggers now act after the item is marked running low / run out, so a "runs out" trigger can recharge it; the last use of a running-low item (no roll) also fires its "runs out" triggers
- **Roll preview**: the roll dialog of attacks, ability checks, damage and powers shows what each button will roll (one-handed / two-handed, overcharge), updated as the options change: modifier, multiplier, ability, skill, advantage, exploding dice, the album's power and the damage boost ("Rolls: 1d12x + 2" once the boost is ticked). Saves (characters and NPCs), reaction (one line per button), corruption, defeat, group chase, relife and NPC morale show it too
- Fixed: the reaction, corruption, relife, defeat, dice oracle and consume-supply dialogs no longer cut off their buttons (they size to their content)
- **Chromatype preview**: in the client settings, a swatch next to *Chromatype* shows the chosen colour, and (with Dice So Nice) a dice button next to each dice colour list (Chromatype, Dice So Nice Chromatype, hero, blood, tourist and oracle dice) rolls in that theme (a d20 and a d6; a d6 for hero, blood and tourist dice), only on your screen and without a chat message, so you can see it before saving
- Fixed: the accent color (chromatype), Dice So Nice, hero, blood, tourist and oracle dice color lists in the client settings are sorted by their names in the user's language (they kept the English order); *Same as the Chromatype* and each list's default style come first
- Fixed: hero, blood, tourist and oracle dice set to *Same as the Chromatype* rolled with Dice So Nice's default look (the option was saved with a typo); saved settings are corrected on load
- Fixed: items whose image is one of the system's default icons (e.g. a weapon with the fire icon) no longer have it swapped for their type's default when they are moved to a sheet, readied or otherwise updated; the default icon only follows the item when its type changes
- Fixed: clicking an empty power album (also from Token Action HUD) threw an error; it now says the album is empty
- **Movement and range zones** (the book's *Movement and Range*): distance is close, short, medium or long, and reaching an enemy takes 1 round at short, 2 at medium and 3+ at long (then it's a chase)
  - **Zone scales**: where close, short and medium end for each kind of scene, in feet (meters): battlemap — d20 maps: adjacent, a 30 ft move, two moves (5 / 30 / 60 ft; 1.5 / 9 / 18 m), indoors (5 / 20 / 50 ft; 2 / 6 / 15 m), underground (5 / 25 / 80; 2 / 8 / 25), forest (10 / 30 / 100; 3 / 10 / 30), on foot — the book's standard (10 / 30 / 130; 3 / 10 / 40), mounted (15 / 90 / 450; 5 / 30 / 150), vehicles — the book's autogolem scale (30 / 150 / 600; 10 / 50 / 200), ships (30 / 90 / 450; 10 / 30 / 150) and air / fast craft (60 / 300 / 1500; 20 / 100 / 500). A zone is both a range and movement, so scales shrink for tight places and grow only with how fast the fight moves, not because a place is open (a desert on foot is On foot). A new *Zones* menu edits them and picks the world default (Battlemap)
  - **Per scene**: the Grid tab of the scene configuration has a *Zones* block: pick a scale (or the world default) and, if needed, change any of the three numbers for that scene only. Under the list: what the scale is for, the grid it suits (e.g. 5 ft per square for Battlemap, 30 ft for Vehicles), how many squares each zone is on this scene's grid, and a warning when the grid doesn't suit the scale. Distances are converted from the scene's grid units (ft, m, mi, km, yd)
  - **None (travel map)**: a scene scale for overland maps (pointcrawls, regions, the caravan's journey): no zones, colored ruler, range check, free attack note or HUD zones there
  - **Distance unit** (world setting in the Zones menu): feet (default, the grid the system always used) or meters. Every zone number and the scene settings use it; new scenes get 5 ft or 1.5 m squares. Changing it converts every scene in feet or meters (5 ft ↔ 1.5 m, 10 ft ↔ 3 m, 15 ft ↔ 5 m, 30 ft ↔ 10 m, 60 ft ↔ 20 m; other sizes at 1 ft = 0.3 m), the zone scales table and each scene's zone numbers: zones cover the same squares, only the numbers change
  - **Speed** on character and NPC sheets (on the right of *Defense* on character sheets), in zones per round: normal 1, fast 2, very fast 3, slow 1 every 2 rounds, very slow 1 every 3… (hover for the meaning; red when lowered). Characters change it in edit mode, NPCs any time. With *Automate conditions*, **slowed** also lowers speed by 1
  - **Target's zone in the roll dialog** (optional, on): with a token targeted, attack, weapon damage and power dialogs show the target's zone and distance and warn when the weapon or power doesn't reach (a melee attack reaches close) or a thrown weapon goes beyond short. A Melee attack only reaches close, whatever the item: with the target farther away the dialog says so ("A melee attack only reaches close: Bob is at short") and preselects disadvantage in case the Referee allows it. No penalty is applied: the Referee decides
  - **Free attack warning on the ruler** (optional, on): in combat, while a token is dragged, the ruler label warns when the path leaves the close zone of an enemy ("leaves Bob's reach (free attack if careless)"), before the move, so the player can go around or withdraw carefully. Any other disposition is an adversary (friendly, neutral, hostile or secret); tokens of the same disposition are allies; hidden tokens only count when the Referee moves; defeated tokens are left out. The label shows the warning on the move being planned (not on moves already made this turn). Conditions: an adversary that is dead, unconscious, asleep, stunned, paralyzed, petrified or mad can't take it; a flying token gets out of reach of one that doesn't fly; an adversary that is blinded, poisoned, prone, confused or nauseated, or a token moving away invisible (unless the adversary has Eerie Sense), shows "Bob attacks with disadvantage: …" (the adversary's attack, not the token's); a frightened adversary shows "may not attack" (an NPC: "its morale decides"; characters have no morale); a Springer is reminded it provokes none if it jumps away after attacking
  - **Free attack note to the Referee** (optional, off): on a token's own turn, moving out of an enemy's close zone whispers the Referee that the enemy may make a free attack if it disengaged carelessly, once per enemy per turn
  - **Ruler colored by rounds** (optional, on): dragging a token colors the path by the rounds the move takes at the token's speed: green this round, yellow next round, red 3+ (a chase). Distances are proportional within zones, so a slow token gets halfway to the edge of short in a round and covers in two rounds what a normal one does in one; beyond medium each medium-sized step counts as another zone, so a fast token dragged far still turns yellow and red
  - **Zones button in the Token HUD** (optional, on): shows the zones around the token on the map (close green, short yellow, medium orange), measured like attacks; only the user who clicked sees them, they follow the token and go away when it is released. Gridless scenes and huge scales get rings
- **New chat cards**: attack, damage, power, ability, save, hero dice, save request, usage, danger, morale, reaction, defeat, corruption, group chase and relife cards share one look — a title with chips (ability, skill, modifiers, roll mode, two-handed, a power's range / target / duration) instead of the bracket line; a roll box with the total large, the formula and the dice faces (dropped dice faded, a die's maximum marked; click for the full breakdown); a result strip with the target's portrait and defense, or the save target, and the outcome (HIT / MISS / CRITICAL / FORCE OR FAIL, SAVED…) with its margin ("by 8"), colored by result; notes as tags (depleted resources, reach, a save's condition, fired triggers); **Roll damage** as the main button; the hero dice button and a power's catch handle in a footer with the hero dice left. Hero dice results show an attack's outcome before → after ("MISS → HIT"). Damage and power cards have quick **apply** buttons (−N, ½, ×2, heal) for the selected tokens, as in the right-click menu. **Apply damage automatically** (Optional Automations, off): damage rolled with a target, or from the Roll damage button of an attack that hit (the hit target travels with the button, also after hero dice turn a miss into a hit), is applied to that target at once — through the Referee's game when the player doesn't own it — and the card shows "14 damage applied to Bob" with an Undo for the roller and the Referee. Triggers of that damage roll (a Condition or Effect, with or without save) act on the same target the card carried, even with no token targeted; other rolls keep using the targeted tokens. NPC attacks are just *Attack* now (their sheet called them melee): no "Melee attack" title or melee-only range rule, and their attack triggers fire whatever attack type they name
  - The cards keep their light colors with the dark interface theme (Foundry's chat has no dark mode)
  - The welcome card's LinkedIn link opens LinkedIn (it pointed at the Foundry server)
  - Short titles: an attack made with an item is titled with the item's name (the attack kind as a chip: melee, ranged…); a save against a condition is "Save · Bolas" with the ability as a chip; the ward bonus is a chip. Titles are a bit smaller, and long outcome words (FORCE OR FAIL) take a smaller size instead of breaking the target's name
  - Natural 20, 1, 13 and 7 on save and other result cards are a tag inside the card (no line under it); a trigger without a text lists its condition or effect ("Burning (save)"); a trigger's "X on Bob" message, the life change card and the hero dice result use the same look (the hero dice result shows the hero dice and the original dice); "1 hero die"
  - **Hero dice for healing** (left-click on the sheet): the card has a **Heal** button that heals the roller (its owner or the Referee), then says how much was healed, with an Undo for the Referee; the quick apply buttons are there too for the selected tokens
  - Roll dialog: only the checkbox toggles *Exploding dice* (clicking its label, next to the Roll button, did too)
  - Result cards (save, morale, usage…): the message goes under the target and outcome, full width; outcomes in capitals; morale colored by the NPC's side (keeps fighting green, last push amber, breaks red)
  - Critical success: the hit's green with more emphasis (thicker edge, stronger background, larger word); its tag is bold green
  - The Roll damage / Roll power button shows what it rolls (a weapon's damage with its bonus, both damages of a versatile weapon, a power's roll) and the critical multiplier
  - **Save equal to its target** against a condition or effect: nothing is put on; the Referee clicks **Sacrificed** (avoided) or **No sacrifice** (put on). Hero dice that change it remove the buttons and the new card decides (an equal result asks again)
  - Roll, save, danger, morale, reaction, corruption, defeat and group chase dialogs, hero dice dialogs, the flare question and the escalator die no longer block the screen (not modal)
  - pt-BR: the flare question says "característica"
  - With Dice So Nice, what follows a roll (damage applied, a trigger's condition, a failed save's condition) waits for its dice to land, so its message comes after the roll's card
  - A condition or effect put on or taken off reads "Bob: Grabbed" / "Bob: no longer Grabbed", in the name of the one who got it; after a save (failed, no sacrifice, hero dice) there is no extra message, the save card says it
  - pt-BR: the Referee is *Mediador* in the system's texts; Foundry's own terms (Blind GM roll) keep GM / Mestre
  - The hero dice result takes the place of the card it changed: an attack's shows the target (portrait, name, defense), the item's feature buttons when the new result hits (Entangle…) and natural 20 notes (vorpal); a damage roll's has the apply buttons and corrects damage applied automatically by the difference ("+4 damage applied to Bob (now 12)"), with its own Undo
  - Undone lines show what was undone struck through, then "· Undone"; the life change card of an undo or a hero dice correction is titled *Damage undone*, *Healing undone*, *Damage corrected* or *Correction undone* (not *Healing* / *Damage*)
  - **Use trigger** (consumables): fires every time the item is used, with or without a usage roll; From works as for damage (this item, any item, one item); its actions act on the Use's targets, before the item is spent
  - **Save difficulty**: a trigger's Condition or Effect save, and gear with entangling, petrifying or heat (new *Save difficulty* field), can be Very easy (target −4), Easy (−2), Standard, Hard (+2), Very hard (+4) or a fixed **Target**; the save card shows the moved target and a chip. On a character's save request the Referee can change it (or type the target) before the roll
  - A trigger that fires with no target gets a "<condition> → targeted tokens" button on the card: target the token and click to apply its Condition / Effect (save, difficulty and duration included)
  - Radiothermal Horn: its hits make the target Nauseated unless it passes a hard save (run npm run build:packs)
- **Declared actions** (the book's *Actions*): new token conditions for what a combatant declares — **Charging** (its attack has advantage, attacks against it too), **Careless** (attacks with advantage; attacking it notes it may counterattack), **Furious** (attacks against it have advantage), **Defending** and **Protected** (attacks against it have disadvantage), **In cover** (ranged attacks against it have disadvantage), **Suppressed** (its attacks and ability checks have disadvantage) and **Ready attack** (attacking it notes it strikes when its trigger happens). They always set the roll dialog's suggested advantage / disadvantage (with or without *Automate conditions*), with a line saying why; in combat they last until the start of its next turn, and the combat tracker shows them as chips. New icons for *In cover* and *Protected*
  - When a combat ends, the Referee's game deletes the conditions that expired during it (on everyone who was in it)
- **Next roll** (Referee): a dice button in the Token HUD opens a small dialog to give a token's next roll — or the next attack against it — a bonus or penalty (+1, +3, +6, +1d6, Adv / −1, −3, −6, −1d6, Dis). The roll dialog starts with it filled in (changeable) and the roll uses it up; the dialog lists the pending ones, each removable
- **Mounts and vehicles**:
  - **Ride mods**: a new *Ride* mod type (only rides take them, and gear doesn't) and a *Ride Mods* folder in the Mods & Effects compendium with the book's 60 mods, numbered 01–60 (capacity, speed, supply, life, defense…). A ride takes up to its level + 1 mods, shown by the *Installed mods* track on its sheet (as on gear); *cost per capacity* mods multiply their cost by the ride's capacity. Mods that add to or multiply the supply work on numbers (run npm run build:packs)
  - **Ride stats**: a card on the mount and vehicle sheet with life, defense, bonus and damage from the book's ride table at the ride's level (sentient rides use an NPC table and get morale: by default Brick Bastions for vehicles, the generic creature for mounts, any other can be picked; semi-sentient rides keep the ride table and get the generic table's morale); the stats follow the level and mods, can be edited, and the refresh button fills them again
  - Compendium mounts and vehicles have their stats filled from their table at their level (run npm run build:packs); sentient vehicles use Brick Bastions
  - **Deploy / Recall**: a ride can take the field as a creature (no feature or cost needed) with its stats, speed, size, capacity, cost and supply (always the ride's, mods included); the Referee deploys it from the caravan's transport rows (flag icon), the right-click menu or the ride's sheet, and recalls it the same way, from its token HUD or by deleting its token; players ask the Referee. At 0 life it is broken and goes back to the caravan; optional: recalled when the combat ends
  - The caravan's transport rows show notched and broken rides on their image
- **Animated items**: deleting a creature's last token turns it back into its item (as Deanimate)
- **Inventory rows**: the Use button only shows on readied items; an unlit light source shows an unlit flame — click to light it; an animatable item shows a faded ghost (before its charges) — click to animate it (Referee) or ask to (owner); a walking creature's ghost deanimates it on click (Referee)
- **Features tab** (item sheets): the feature checkboxes are locked so moving around the sheet doesn't tick one by mistake; the pencil at the top unlocks them, and changing tab locks them again
- Zones Settings: the menu entry has no description line; the distance unit hint's example is now 10 ft ↔ 3 m
- New default icons for caravans, mounts, vehicles, skills, powers and wards
- Token Action HUD: only readied consumables are listed
- **Show zones (hold)**: hold a key (Z by default) to see the zones around your selected token, or your main character's token on the scene; released, they go (zones turned on from the Token HUD stay). Set the key in the Client Settings menu (or Configure Controls); no key turns it off; the Token HUD's zones button mentions the key on hover
- **Compendium Browser shortcut**: now Shift+B by default (Ctrl+Shift+B clashed with the browsers' bookmarks shortcut); its key can be set in the Client Settings menu too, and the "loaded" message shows the key each player has
- **Bonus / penalty buttons** (the book's *Bonus and Penalty*): d20 roll dialogs (attacks, ability checks, saves, relife, group chase) get a row under the Modifier with its typical modifiers — +1 / −1 (tiny), +3 / −3 (moderate, a skill's worth), +6 / −6 (significant), +1d6 / −1d6 (random) and Adv / Dis, bonuses on one line and penalties under them — that fill the Modifier or the roll mode in one click (again to clear). Out of range by one zone, or a thrown weapon beyond short, still preselects disadvantage and now highlights −1 / −3 / −6 / −1d6 as alternatives (picking one sets the roll mode back to normal). When the target is out of reach (two or more zones beyond, or a Melee attack beyond close) the Roll buttons get a warning icon and a red line above them says the attack shouldn't be rolled unless the Referee allows it (the buttons still work) A Modifier typed with a sign (−6, −1d6) keeps it in the formula
- **Attacks with a weapon or power**: the attack dialog has a **With** list: readied weapons and powers (not broken ones, nor run-out ones unless they work when run out — like the inventory's roll buttons), power traits (traits are always readied), the selected power of each readied album or gear with the *album* feature (a weapon with powers is listed twice: as the weapon and as its power) (each with its range and what it rolls, the chosen one's image before the selector: "Spear (close, 1d8 / 1d10)", "Fireball (power, medium, 3d6)"), and **Unarmed Damage** for any of the four attacks (close in melee, short in the others; suggested only when nothing else fits); left empty (—) the attack works as before. It starts on the attack's **favorite weapon or power** (set with the gear next to the attack in edit mode, alongside its ability and skill), or, without one, a suggestion: with a target, a readied item that fits the attack and reaches it; else melee picks a close weapon, ranged a weapon of short range or more, fantascience a power or fantascience item, oldtech an oldtech item or a power — these two never fall back to a plain weapon, only to unarmed. The roll preview shows the chosen item's damage (or power roll) and range under the formula ("Damage 1d3 close"; a power's range as written, such as "touch", is shown but never checked: the Referee rules on it). The chosen item gives the range warning and goes in the roll's title ("Melee (with Spear)"); the attack formula is unchanged. With a target one zone beyond the item's range (or a thrown weapon beyond short) the dialog opens with **disadvantage** suggested (combined with conditions and the attack's default; changing the item re-suggests it); two or more zones beyond says it doesn't reach (disadvantage still preselected, and the Roll button warns). Weapon damage and power dialogs show the same range notes. The attack's chat card gets a **Roll damage (Spear)** button (**Roll power** for a power, power trait or album power) that opens that item's damage or power dialog; a hero dice result for the attack carries the same button, counting the 20s hero dice made (a die bumped to 20 counts as natural and explodes again). On consecutive natural 20s the button shows the critical multiplier (one 20: the base ×2; each 20 more doubles it: ×4, ×8…) and the damage dialog starts with it selected (Shift+click applies it). With an item chosen, the attack triggers of the *other* weapons and powers don't fire (the chosen item's, other gear's, traits' and burdens' still do); with — they all fire as before. Attack triggers get a **From** setting, like damage and power triggers: from this item (default, as above), any item, one item (by identifier) or **unarmed**, so a trait can fire on "a ranged attack with the Rifle" or "an unarmed melee attack". NPC attack dialogs start on the NPC's own **Damage (1d8)**, and list its readied items too; an NPC attack with its own damage gets a **Roll damage** button for it
- **Item features on attacks** (the item chosen in the attack dialog's *With*):
  - *clumsy* suggests disadvantage; *armor piercing* suggests advantage against a heavily armored target (wearing readied heavy or golem armor, characters and NPCs alike); the dialog notes why
  - *backfiring* (natural 1) and *vorpal* (natural 20) add a note to the card; on a hit, condition buttons: *blinding* **Blind target (1 round)** (and a note on a critical: it may be permanent), *confusing* **Confuse target (1 round)**, *slumber* **Put target to sleep**, *entangling* **Entangle target (if its save fails)** (grabbed), *petrifying* **Petrify target (if its save fails)**, *mad* **Drive target mad**, *heat* **Set target on fire (if flammable and its save fails)**, *fearsome* **Target tests its morale** on an NPC or **Frighten target** on a character (characters have no morale); *burdening* adds a **Burden target** button on a hit (gives it a burden item); an unarmed attack on a target with readied *spiked* armor adds a **Take 1d3 damage** button for the attacker. Condition buttons work for anyone who sees the card (a target the user doesn't own is changed by the Referee's game); the burden, spiked and morale buttons for the Referee or the owner of whoever they affect
  - items have an **attack bonus** of their own (shown on the weapon sheet when not 0), raised by their own effects and mods: attacks made **with** that item add it, others don't. The compendium's Spear Named Blood Drinker (+3 per wound) and the *Precision* mod (+1) now put their bonus on the item instead of the bearer (copies already in worlds keep their old effect until replaced)
  - melee and ranged no longer suggest fantascience or oldtech weapons: those are used through the Fantascience and Oldtech attacks (they can still be picked)
- **Reach** ("longer, so it attacks first in close combat"): in combat, moving into the close zone of an adversary holding a readied reach weapon warns on the ruler ("enters Bob's reach (it strikes first)") and, with the free attack note on, whispers the Referee; a melee attack on an adversary with reach whose turn hasn't come yet this round notes in the dialog and on the card that it strikes first (resolve its attack before this one). Not when the attacker / mover has reach too, nor when the reach wielder can't act. Combatants with a readied reach weapon get a reach badge in the combat tracker — and in tracker modules that tag combatants with their id (carousel / dock trackers)
- **Triggers apply conditions**: a new **Condition** action puts any condition of the Token HUD list on the targeted tokens or on the one who rolled, without an effect on the item (targets you don't own go through the Referee's game). With the new **always** condition (attacks, saves, ability checks, defeat, damage and power), a weapon's damage or a power can apply a condition on every roll — e.g. a damage trigger *always → Bleeding on targets*
- **New conditions** from the compendium texts: **Hidden** (stealth: its attacks have advantage, attacks against it disadvantage; it's seen — removed — once it attacks), **Surprised** (loses its first turn, then it's over; attacks against it have advantage until then), **Controlled** (charmed or commanded: a reminder) and **Sees invisible** (cancels invisibility and hiding both ways; its tokens also get Foundry's *See Invisibility* vision, so invisible tokens show on the map for them — taken away again when the status ends, unless it was set by hand). Hidden, Surprised and Mad have their own icons (Mad no longer looks like Hidden on sheets). Fixed: an item whose effect carries a condition (Eerie Sense) broke the item's data preparation An **invisible** attacker now has advantage too, unless the target sees invisible. With *Automate conditions* these feed the roll modes; rest clears Hidden and Surprised. Compendium: Eyes of Akaula (casting it gives Sees invisible; a power with no roll now fires its *always* power triggers), Eerie Sense (Sees invisible while the NPC has it), Many Eyes (immune to Surprised), Secondary Brain and Mental Shackles (immune to Controlled)
- **Saves against conditions**: when a save is allowed, the target saves first and gets the condition only if it fails. An NPC target rolls its save at once (in the Referee's game when the user doesn't own it); a character target gets a **save request** card in chat with one button per ability — the suggested one marked (the book's static abilities resist: Endurance for the body, Aura for madness, fear, confusion and sleep) — that its owner or the Referee clicks to roll. The save card says *Failed: Grabbed* or *Resisted*, and hero dice that change the outcome put the condition on or take it off. Used by the *entangling*, *petrifying* and *heat* feature buttons (now "Entangle Bob (save)") and by triggers: the Condition and Effect actions have a **save** checkbox with the suggested ability (by condition, or one; an effect without a condition suggests Endurance), so "the target saves or gets −2 Strength" works too (a consumable's Use stays without a save). Compendium: Venomous Bite, Fire Breath, Tail Sweep and Stun Baton Wand now allow the save their text mentions
- **Condition duration on triggers**: the Condition action has a duration (rounds, minutes, hours, days or weeks; blank = until removed). Rounds end with the turn; longer ones follow the world time, so a calendar module expires them (Eyes of Akaula: Sees invisible for 1 day). Fixed: the 1-round conditions of the feature buttons (blinded, confused) didn't get their duration
- **Triggers remove conditions**: the Condition action has **put on** / **take off** (a trigger can end a condition on its targets or on the roller)
- **Consumables cure conditions**: a **Cures** field (item header) lists conditions that Use removes from its targets every time (a bandage stops bleeding, an antidote cures poison); the chat lists what it cures. Only conditions put on the actor, not those given by its items
- **Immunities**: gear (while readied) and traits have an **Immune to** list (Effects tab): the bearer can't get those conditions — putting one on (Token HUD, triggers, feature buttons, effects) is refused with a chat note ("Bob is immune to poisoned (Chaos Skeleton)")
- **Compendium conditions**: the natural weapons of the NPC extras (Venomous Bite, Crushing Grip, Tail Sweep, Bleeding Claws, Shock Lash, Fire Breath, Radula Tongue, Needle Teeth, Keratin Tentacles) and the Arzax Lance, Stun Baton Wand, Forty-Pound Uranium Rod and Pleasure Thorn now put their condition on with the trigger's Condition action, instead of a disabled copy of the condition on the item (Acid Spit and Corrosive Secretion keep theirs: their −1 defense works without *Automate conditions*). The Flasher blinds and nauseates on a hit. Shock Lash has the reach feature (its text says so); Fire Breath has the area feature (small); Flies gives the Flying condition while the NPC has it Immunities: Nasal Filters (nauseated), Chaos Skeleton (bleeding, poisoned), Hypermobile Joints (grabbed), Rationalised (frightened)
- **Hero dice re-check triggers**: when hero dice improve an attack, ability check or save, the triggers that match the new result (a die bumped to 20 is natural; a hit / save that now succeeds) but didn't match the roll fire on the hero dice card
- **Rest ends short-term conditions**: a week of rest also removes stunned, confused, nauseated, slowed, weakened, blinded, deafened, frightened, prone, asleep, unconscious, grabbed, bleeding, burning, poisoned, hidden and surprised from the actor (a checkbox in the rest dialog, ticked by default, lists them; the chat says "No longer: …"). Dead, mad, corroded, petrified, invisible and flying stay, and so do conditions given by a carried item. A character with only conditions to shake off can rest too
- Fixed: the effects panel now slides along with the right sidebar when it collapses, expands, changes tab or is resized (it jumped to a stale position)
- Fixed: on the V2 sheet and in Token Action HUD, an attack set to Charisma or Thought had a lime / red icon instead of the colour of that ability (sky / royal)
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
- **Item tooltips** on the actor sheets now include a short excerpt of the description (first paragraph, plain text, Referee secrets left out); powers and power albums keep their own text
- **Recharge** fills an item's charges back to their maximum (items with replenish only clear running low / run out) and is offered whenever a charged item is below its maximum
- **Resources follow the rulebook**: a usage roll now marks the item — a natural 13 is always *running low* (one use left, even with replenish 13+), a roll at or under the replenish score is *run out* — for weapon attacks, casting a power from the item (a power or an album on an item with replenish), the item's *Usage roll* menu entry, Use and lighting. Using an item that is already running low is its last use: it runs out with no roll (a chat line says so). Weapons have a *Usage roll on attacks* checkbox next to replenish (on by default) for items whose replenish isn't spent by attacking
- **Item uses from a counter**: gear can keep its uses in one of its counters instead of charges (Effects tab, under the counters): *uses left* counts down to 0, *uses spent* counts up to the counter's maximum. Use, lighting and animating spend it with the charges rules (one use left of several: running low; none: run out; uses back from a reset, +1 or Recharge clear the mark), so a once-per-turn or once-per-combat item runs out and comes back with its counter
- **Usage roll to animate**: animated items with replenish can make each animation a use (usage roll; running low: last use); like charges, the creature then comes back with full life and does not wear the item
- **Charges and resources**: an item with more than one charge is *running low* on its last charge; removing the last charge of a consumable marks it *run out*; adding charges back clears running low / run out, except that 1 charge left of several is *running low*. Items with replenish keep their resources from the usage roll
- **Power cost is paid**: casting a power makes a character pay its cost (power cost × level, doubled when overcharged, minus the power cost bonus). The cast dialog shows the cost, with *Pay the cost* (ticked) and points from any abilities (one small field per ability; 1 point = 1 life); life pays the rest, and when life isn't enough the cast asks for more ability points. Life can drop to 0, which opens the defeat roll. A chat line shows what was paid. The cast dialog also warns when casting is dangerous: a dangerous power, a cost above the caster's level, or an overcharge whose cost would be (it follows the power picked in an album). World setting *Automate power cost* (on by default, Optional Automations in the Rules settings). The cost shown on cards, tooltips and power names now uses one formula everywhere
- **Animated items**: deleting an animated item also removes its creature (its tokens and its actor), unless another item still uses it (e.g. the item was moved to another actor)
- **Optional systems**: a new *Optional Automations* section in the Rules settings (below the core rules) holds *Automate power cost*, *Roll triggers*, *Counters*, *Damage boost* and *Item lights* (all on by default), letting the Referee turn each off: its sections and roll options are hidden and its automation stops, while the data on items and actors is kept. With *Item lights* off nothing lights a token (items, powers, animated glowing items), the light controls and presets are hidden everywhere (Token HUD, menus, item and power sheets, Baseline Settings) and the lights that are on go out
- **API for modules**: `game.sdm.api.items` (`use`, `isUsable`, `useBlockedReason`, `rolls`), `game.sdm.api.lights` (`items`, `isLightSource`, `isLit`, `litEffect`, `light`, `putOut`, `toggle`) and `game.sdm.api.counters` (`get`, `step`, `reset`, `add`, `remove`), used by Token Action HUD WTF
- **Rest (one week)**: a bed icon next to the life label on character and NPC sheets opens the weekly rest: regain all missing life, fully restore one missing ability score, or remove one burden (the Referee confirms it). A chat line records it. Macros and modules can call `game.sdm.api.rest(actorOrUuid, { choice: 'life' | 'ability' | 'burden', ability, burdenId })` (without a choice it opens the dialog)
- **Restoratives**: new consumables from the book's faster recovery list — Healing Unguent (1d6 life), Restorative Tonic (1 ability point), Medical Pack (2d6 life or 1d3 ability points) and Full Heal Treatment (all life and ability points; a service bought and used in town, weightless). The Full-Heal Kit is now usable too: it restores all missing life (rebuilding a limb or organ stays a burden the Referee removes). Consumable formulas accept `full` (all missing life / every ability back to full)
- **Token light from items**: readied gear with the *light* category or *glowing* (feature or category) can light its bearer's token, from the flame button on the Token HUD (a small list when several items can light) or the item's right-click menu (*Light* / *Put out*); a lit item shows a flame on its inventory row (click to put it out). The light is an effect on the actor, so the token's own light comes back when it goes out and it follows the character between scenes; one light at a time. Lighting spends a usage roll (replenish) or one charge; lamps and glowing gear without either light for free. A broken, run-out or uncharged item can't be lit, and running out, breaking, unreadying or deleting it puts the light out. Items have a light preset (auto, torch, lantern, candle, glow, custom with radii in grid squares, color and animation). The Referee can tune the torch, lantern, candle and glow presets (radii, color, color intensity, animation, speed, animation intensity) in the *Baseline Settings* menu. The *glowing* feature is now offered on every gear subtype (it was only on weapons and wards). **Traits that light**: a trait can have a *Light* preset (none by default; Glowing Skeleton glows); the player lights and puts it out like a lamp, for free, from the Token HUD flame, the trait's right-click menu, its row or Token Action HUD. **Powers that create light**: a power (also album powers) can have a *Light* preset; casting it lights the caster's token until it is put out (Token HUD flame or the Effects tab), spending nothing beyond the cast
- **Actor counters**: characters, NPCs and caravans can keep their own counters too, managed at the top of their Effects tab and shown as chips under the name in the header (click +1, right-click −1). Effects read them as `@actor.counters.<key>.value`; *reset after combat* works the same
- **More from consumables**: a consumable can restore only physical or only mental abilities, grant temporary life (as an effect that ends with the item's effects), cost life every time (harm), draw a roll table on every use, and make its effects last a set number of rounds, minutes, hours, days or weeks (removed when that time passes). Violet City Healotion restores a physical ability point, Black Light Lotus's charisma lasts a day, and Cat Coffee restores all mental ability points
- **Damage when run out**: weapons (and items with the weapon feature) can tick *Damage when run out* to keep rolling their damage while run out — a charged spear is still a plain spear — while its powers, Use, lighting and animating stay blocked until recharged; that damage roll makes no usage roll
- **Consumable** feature and **Use** (separate from the caravan's Consume Supply): a consumable restores life, restores ability points or copies its effects (as temporary effects you remove when they end) onto the targeted tokens, else the selected ones, else your character — when it has more than one, the user ticks which ones apply on each use (Black Light Lotus: smoke it to heal, apply it for the charisma, or both); its effects no longer apply while it is only carried. Using it spends a usage roll (replenish, charges untouched; a natural 13 marks it running low, a roll at or under the replenish score run out), a charge, or one of its quantity. The Use icon is hidden while the item is broken or run out; hovering it lists what the use does (restores, temporary life, effects, harm, roll table). Tick the *consumable* feature and set its formulas in the item header (mods and effects can add the feature too). Healotion, Blood Brandy, Patchflesh Parasite, Black Light Lotus, Healmachine, Felix Whizz, Sun's Caress and the buff consumables are set up
- **Damage boost** (a new boost starts neutral: multiplier 1, cost 1 when left blank): weapons can be boosted by paying life, an ability or hero dice (Piezo Mace 1d6 life ×2, Noetic Blade 1 aura ×3, Oldtech Dagger-Axe 1 life ×2); mandatory boosts are paid on every damage roll (Magnificent Fireball: 1 life per shot)
  - A boost can also replace the damage (*Damage becomes*: Swagger Stick, 1 life for 1d12 instead of 1d4), and a cost of 0 makes it a free situational bonus with a *When* note (Stakehammer ×2 vs vampires, Shipgun ×3 vs unarmored targets, Wire-Ghoul Hammer-Axe ×2 vs heavily armored enemies, Bane Coat mod ×2)
- More compendium items automated with this version's features: Felix Whizz Six-Pack (6 charges of 1d4 temporary life), Flarestick (torch light), Suspended in the Light (glow when cast), Porcelain Walker (animated, walks, usage roll to animate) and Full Archaic (animated, fights without you), Fortunate One (natural 1 reminders on attacks, saves and checks), Yellow Dart (glow) and Vidy Unity Box (soft blue glow); with trigger costs: Glass Cannon, In-Arm Pistol and Power Scroll Printer offer to pay 3 / 1 / 1d6 life to reload when they run out, Stun Baton Wand offers to pay 1 life to stun on damage, and The Spear Named Blood Drinker counts its wounds on every damage roll
- **Counter values in amounts**: consumable amounts (life, abilities, temporary life, harm), damage boost cost / extra / damage and trigger value, counter step, charges and cost take formulas that read counters and other values with the effect references (`@item.counters.kills.value`, `@actor.counters.<key>.value`, `@actor.level`, `@items.…`), also in dice: `(@item.counters.hits.value)d6`, `1d@actor.level`. Trigger values, counter steps and charge amounts became text fields (old numbers carry over). The trigger cost question and the boost option in the damage dialog show the current values ("pay 3d6 life"); dice are rolled when the cost is paid
- **Roll triggers** (collapsible section in the Effects tab, like counters; the row being edited is highlighted; each action shows its options only once it is picked): gear, traits and burdens can list what happens on a roll result — on attacks (any, or only melee, ranged, fantascience or oldtech attacks), saves and ability checks (any ability, or one), defeat rolls, damage, power rolls (an album's triggers can name one of its powers), usage rolls, the item's own counters or the character's counters (traits, burdens and readied gear can watch them), and the item's charges: *value =* fires when the value lands on the number, *≥* / *≤* on every change while true (or only when they become true, with *once*), *full* / *empty* when reached, and *changes* / *goes up* / *goes down* on every change, optionally multiplying add and spend actions by the size of the change (+2 kills → +2 charges); the counter action can also change a character counter; rolls not tied to an item check the actor's readied gear and all its traits and burdens; the condition list shows only what fits the roll: success / failure (saves, defeat, attacks against a target), natural (the face of the die rolled: exactly, N or higher, N or lower), total (exactly, N or higher, N or lower; *result* on usage rolls, *value* on counters and charges), a die showing a number, all dice max / min, matching dice, and for usage rolls running low / run out (old *reaches its maximum* triggers become *is full*). The chat card highlights the ones that fire, each trigger can have a **cost** paid first (life, an ability or hero dice, a number or formula; optionally *ask first*, so the player chooses; declined or unaffordable skips the actions), and can act: draw a roll table, put one of the item's effects on the targeted tokens or on the roller (temporary), notch / break / run low / run out / repair one step / repair fully / recharge the item, change one of its counters (add, set to a value, or reset), spend / add / set charges (on this item or another; uses counters too), use a power (a power item or an album power by name, this item or another on the actor; with the cast dialog and its cost, or *free*), use a consumable, or light / put out / toggle an item's light. Damage, power and usage triggers have a **From** field: this item, any item, or one item of the actor, so a trait or another readied item can react to that item's rolls (e.g. a trait firing on one weapon's damage); items are picked by name, so it works on copies and in compendiums. Actions can set off further triggers, up to a chain of 3. Set up on the weapons that describe them (Chain Sword, Golem Killer, Mazing Crown…); Autoportal Conflux draws its delay table, Arzax Lance, the Forty-Pound Uranium Rod and the Pleasure Thorn stun their target, and the Ur Gun flags its natural-13 critical hits
- **Armor size defense**: Armorborn and Redlander add defense per stone of readied armor (sizes added up, rounded up per item; they stack)
- **Unarmed damage steps**: Ur-War Program raises the Unarmed Damage dice one step
- **Boatmaster**: crew members with Boatmaster add their level in sacks to the caravan's boats (at most each boat's capacity)
- Glass Skull, Shrunken Head, Necrolexicon NEC and Tome of Metal B are now wards with the album feature (their ward bonus is their ward value), and the Scroll Disk Belt holds 3 powers
- **Single-use powers** and **catching powers**: a power can be marked *single use* (with a warning on hover); after it is used you are asked to remove it (from the album, or the power item is deleted). The chat card of a cast power has a **Catch** handle: drag it into an item with an album to store that power, single use. The Dead God Tooth now has an album with one slot for caught powers
- **Chat card fixes**: the Catch handle sits on the card's title line; titles read "Kind · Name" on every card ("Usage · Gear"); white SVG item icons are darker on item cards; the footer no longer shows the hero dice count (the Use Hero Dice button stays, centered when alone); a **Blind** / **GM only** / **Private** label on system cards
- **Apply buttons on plain rolls**: `/r 1d6`, `/r 3`… get the −N, ½, ×2 and heal buttons in one row under the roll, for the roller and the Referee
- **Hero dice again on a hero dice result**: the Use Hero Dice button stays on the latest hero dice card, and new hero dice act on the dice as the previous ones left them (bump a result again, by the same or another player)
- **Hero die on a natural 20** (Core Rules, off by default): a character's natural 20 on an ability check, save or attack gives 1 hero die (up to the maximum) to **the roller** or to **all players** (each player's assigned character; the Referee's game adds them). The card says "+1 hero die" or "Hero dice full". Results changed by hero dice never award one
- **Temporary life on tokens**: the life bar shows temporary life as a blue segment after life (the bar is scaled to max life + temporary life); the combat tracker shows "+N" next to life; the Token HUD has a small blue input for temporary life beside the life one (a number sets it, +N / −N changes it). Fixed: temporary life above its maximum was capped at the borrowed life maximum
- **Single-use powers**: an hourglass on the inventory row of a single-use power (or an album holding one), and on the title of cards that cast it or attack with it
- **Animated items**:
  - A world NPC dropped on the Animation tab is copied into the *Animated Items* folder; the dropped NPC is never changed
  - Wear follows the mode only: walking items get notched / broken, energy items running low / run out (also for coming to life at half life and for healing on repair or recharge)
  - **Linked token** option (on by default): off, each token placed is a creature of its own; deanimating takes its state back from the token
  - The creature's generated weapon (versatile damage) and power copies take no slots
  - Fixed: the **Creature damage** choice went back to automatic after any other change
  - The item's owner configures the Animation tab; placing the token can be cancelled (right-click or Esc) before anything is spent; players ask the Referee to deanimate (right-click, Token HUD)
  - Players whose Foundry role can create and delete tokens **animate without approval**: they place the token and the Referee's game animates the item there
- **Replenish**: an attack made with a replenish item rolls its usage once, with the attack; the damage or power that follows doesn't roll again and isn't blocked if the attack ran it out. Powers with no roll spend their item's use
- **Consumables: Rest on use**: every use opens the rest dialog for its targets. Red Nutrislurry is usable and rests
- **Trigger actions**: **Life** (heal or damage the targets or yourself, a number or formula), **Roll** (a formula to chat), **Hero dice** (gain, or lose with a negative number), **Light → flares** (lit for a set time, then out on its own) and **Animate** (animate or deanimate an animated item)
- **Attack triggers with albums**: the power name picks one power of an album (the album's selected one when attacking)
- **Counters**: *Also reset* can be **on rest** or **each day** (when the game date changes)
- **Custom lights** set their animation speed and intensity (they were fixed at 5)
- **Compendium Browser**: searches on Enter, the search button or leaving the field (not while typing). The Referee can right-click a result → **Add to selected token**: name, image and price (the item's cost, editable; empty or 0 is free) charged to the actor
- **Slots in active effects**: adding to or multiplying an item's *slots override* starts from its slots by size
- **Effect references**: an effect reading an actor value calculated after effects (defense, armor, ward, slots, wealth) gets a console warning: use what it is made from (abilities, defense bonus)
- **Dice So Nice** shows side rolls (dice costs, consumable amounts, trigger amounts, burning)
- Fixed: players' rerolled characters reset their XP and level; caravan crew abilities in order; "Free" on one line; album tooltip spacing; actor and item names in normal case (the title font has capitals only); pt-BR "Rola" → "Rolagem"
- Compendium: Healing Unguent weighs 5 soaps (was 1 stone)

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

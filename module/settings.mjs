export function registerSystemSettings () {
  /* -------------------------------------------- */
  /*  System settings registration                */
  /* -------------------------------------------- */

  game.settings.register("sdm", "initiativeFormula", {
    name: "SMD.settings.initiativeformula",
    hint: "SMD.settings.initiativeformulahint",
    scope: "world", // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: String, // Data type: String, Number, Boolean, etc
    default: "2d6 + @abilities.agi.final_current + @initiative_bonus",
    requiresReload: true,
  });

  game.settings.register("sdm", "currencyName", {
    name: "Currency name",
    hint: "The primary currency used in the game world",
    scope: "world", // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: String, // Data type: String, Number, Boolean, etc
    default: "cash",
    onChange: value => {
      // Optional: Code to run when setting changes
    }
  });

  game.settings.register("sdm", "escalatorDie", {
    name: "Escalator Die",
    hint: "Every roll will be increased by this amount",
    scope: "world", // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 0,
    onChange: value => {
      // This will now be called automatically
      updateEscalatorDisplay();
    }
  });

  game.settings.register("sdm", "baseDefense", {
    name: "Base Defense",
    hint: "Base physical defense value for characters",
    scope: "world", // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 7,
  });

  game.settings.register("sdm", "baseMentalDefense", {
    name: "Base Mental Defense",
    hint: "Base mental defense value for characters",
    scope: "world", // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 7,
  });

  game.settings.register("sdm", "baseSocialDefense", {
    name: "Base Social Defense",
    hint: "Base social defense value for characters",
    scope: "world", // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 7,
  });

  game.settings.register("sdm", "baseTraitSlots", {
    name: "Base Trait Slots",
    hint: "Base number of trait slots for a character",
    scope: "world", // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 7,
  });

  game.settings.register("sdm", "baseItemSlots", {
    name: "Base Item Slots",
    hint: "Base number of item slots for a character",
    scope: "world", // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 7,
  });

  game.settings.register("sdm", "baseBurdenSlots", {
    name: "Base Burden Slots",
    hint: "Base number of burden slots for a character",
    scope: "world", // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 20,
  });

  game.settings.register("sdm", "npcBaseMorale", {
    name: "NPC Base Morale",
    hint: "Base number for NPCs morale value",
    scope: "world", // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 3,
  });

  game.settings.register("sdm", "healingHouseRule", {
    name: "Healing House Rule",
    hint: "Allows for rolling healing hero dice with advantage (roll twice and keep the highest result)",
    scope: "world", // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Boolean, // Data type: String, Number, Boolean, etc
    default: false,
  });
}

export function updateEscalatorDisplay() {
  const value = game.settings.get("sdm", "escalatorDie");
  const container = document.getElementById("escalator-die");
  const display = document.getElementById("escalator-value");

  if (!container || !display) return;

  display.textContent = value;
  container.style.display = value > 0 ? "block" : "none";

  // Optional: Change icon color when active
  const img = container.querySelector("img");
  img.style.filter = value > 0
    ? "drop-shadow(0 0 4px #FF0000)"
    : "drop-shadow(0 0 4px rgba(0,0,0,0.5))";
}

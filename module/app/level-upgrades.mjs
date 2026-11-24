import { ActorType, GearType, ItemType, TraitType } from '../helpers/constants.mjs';
import { $fmt, $l10n } from '../helpers/globalUtils.mjs';
import { addRandomTrait } from '../macros/gm/characterGenerator.mjs';
import { removeCashFromActor } from '../macros/gm/giveCash.mjs';
import { syncAnimationLevel } from '../helpers/animatedItems.mjs';
import { logProgress } from './progress-log.mjs';
import PowerDataModel from '../data/power-data.mjs';

/**
 * Level-up upgrades. Every level gained leaves one pending upgrade on the character or the
 * hallmark; the player chooses it here and the pending upgrade is consumed.
 *  - Character: a new trait (chosen or random), improve a trait (skilled → expert → master;
 *    a plain trait counts as skilled), or +1 to an ability score.
 *  - Hallmark: +1 to every damage die (€5 × item level), +1 defense (€10 × item level),
 *    or a mod. XP pays for it; the material cost is only charged when "Charge material cost"
 *    is ticked when choosing (the history records whether it was paid).
 * Life and hero dice already come with the character's level.
 */

const { DialogV2 } = foundry.applications.api;
const HALLMARK_EFFECT_FLAG = 'hallmarkUpgrades';
/** Item flag: features gained as hallmark upgrades. Effect flag: traits gained as hallmark upgrades. */
export const HALLMARK_FEATURES_FLAG = 'hallmarkFeatures';
export const HALLMARK_TRAIT_FLAG = 'hallmarkTrait';
/** Item flag: names of the powers gained as hallmark upgrades. */
export const HALLMARK_POWERS_FLAG = 'hallmarkPowers';
/** Highest skill rank: master, or builder when the world uses the extended skill ranks. */
const maxSkillRank = () => (game.settings.get('sdm', 'extendedSkillRanks') ? 5 : 3);
const esc = text => foundry.utils.escapeHTML?.(String(text ?? '')) ?? String(text ?? '');
const rankLabel = rank =>
  $l10n({ ...CONFIG.SDM.skillMod, ...CONFIG.SDM.extraSkillMod }[rank] ?? 'SDM.SkillSkilled');

async function chat(actor, text) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><i class="fa-solid fa-angles-up"></i> ${text}</p>`
  });
}

/* -------------------------------------------- */
/*  Character                                   */
/* -------------------------------------------- */

/** Trait subtypes a new trait can be created as: a plain trait, a power or a pet. */
const NEW_TRAIT_TYPES = ['', TraitType.POWER, TraitType.PET];
const traitTypeLabel = type => $l10n(type ? CONFIG.SDM.traitType[type] : 'TYPE.Trait');
/** "Name" for a plain trait, "Name (Power)" for the other subtypes. */
const traitText = (name, type) => (type ? `${name} (${traitTypeLabel(type)})` : name);

/** A trait, or a power or pet of another item type (it is gained as a trait, like dropping it on the sheet as a trait). */
function isTraitUpgradeSource(item) {
  if (item.type === ItemType.TRAIT) return true;
  return [TraitType.POWER, TraitType.PET].includes(item.system?.type);
}

/** Traits that can be improved: skills below master, and plain traits (worth a skilled skill). */
function improvableTraits(actor) {
  return actor.items
    .filter(item => item.type === ItemType.TRAIT)
    .map(item => {
      const type = item.system.type ?? '';
      const rank = Number(item.system.skill?.rank) || 0;
      if (type === 'skill' && rank < maxSkillRank()) return { item, from: rank || 1, to: (rank || 1) + 1 };
      if (type === '') return { item, from: 1, to: 2 };
      return null;
    })
    .filter(Boolean);
}

export async function openCharacterUpgradeDialog(actor) {
  if (!actor || actor.type !== ActorType.CHARACTER || !actor.isOwner) return;
  const pending = actor.system.pending_upgrades ?? 0;
  if (pending <= 0) return;

  const improvable = improvableTraits(actor);
  const abilities = CONFIG.SDM.getOrderedAbilities(game.i18n.lang);
  // No ability cap for now (the Referee decides)
  const abilityOptions = Object.entries(abilities)
    .map(([key, label]) => {
      const base = actor.system.abilities[key]?.base ?? 0;
      return `<option value="${key}">${esc($l10n(label))} (${base} → ${base + 1})</option>`;
    })
    .join('');
  const improveOptions = improvable
    .map(
      ({ item, from, to }) =>
        `<option value="${item.id}">${esc(item.name)} (${esc(rankLabel(from))} → ${esc(rankLabel(to))})</option>`
    )
    .join('');

  const content = `
    <div class="sdm-upgrade">
      <p class="sdm-upgrade-pending">${$fmt('SDM.Upgrade.Pending', { count: pending })}</p>
      <label class="sdm-upgrade-choice"><input type="radio" name="choice" value="newTrait" checked /> ${$l10n('SDM.Upgrade.NewTrait')}</label>
      <div class="sdm-upgrade-detail">
        <div class="sdm-upgrade-drop" data-upgrade-drop>${$l10n('SDM.Upgrade.DropTrait')}</div>
        <input type="hidden" name="traitUuid" />
        <label><input type="checkbox" name="randomTrait" /> ${$l10n('SDM.Upgrade.RandomTrait')}</label>
        <div class="sdm-upgrade-new-trait">
          <input type="text" name="newTraitName" placeholder="${esc($l10n('SDM.Upgrade.NewTraitName'))}" />
          <select name="newTraitType">${NEW_TRAIT_TYPES.map(
            type => `<option value="${type}">${esc(traitTypeLabel(type))}</option>`
          ).join('')}</select>
        </div>
      </div>
      <label class="sdm-upgrade-choice"><input type="radio" name="choice" value="improve" ${improvable.length ? '' : 'disabled'} /> ${$l10n('SDM.Upgrade.ImproveTrait')}</label>
      <div class="sdm-upgrade-detail">
        ${improvable.length ? `<select name="improveId">${improveOptions}</select>` : `<span class="hint">${$l10n('SDM.Upgrade.NothingToImprove')}</span>`}
      </div>
      <label class="sdm-upgrade-choice"><input type="radio" name="choice" value="ability" ${abilityOptions ? '' : 'disabled'} /> ${$l10n('SDM.Upgrade.Ability')}</label>
      <div class="sdm-upgrade-detail"><select name="ability">${abilityOptions}</select></div>
    </div>`;

  const data = await DialogV2.prompt({
    window: { title: $fmt('SDM.Upgrade.Title', { name: actor.name }), icon: 'fa-solid fa-angles-up' },
    position: { width: 480 },
    content,
    rejectClose: false,
    render: (event, dialog) => {
      bindTraitDrop(dialog.element);
      bindChoiceFocus(dialog.element);
    },
    ok: {
      label: $l10n('SDM.Upgrade.Confirm'),
      icon: 'fa-solid fa-check',
      callback: (event, button) => {
        const f = button.form.elements;
        return {
          choice: f.choice.value,
          traitUuid: f.traitUuid?.value,
          randomTrait: f.randomTrait?.checked,
          newTraitName: f.newTraitName?.value?.trim(),
          newTraitType: f.newTraitType?.value ?? '',
          improveId: f.improveId?.value,
          ability: f.ability?.value
        };
      }
    }
  });
  if (!data) return;

  const before = new Set(actor.items.map(i => i.id));
  const undo = { choice: data.choice };
  if (data.choice === 'improve') {
    const item = actor.items.get(data.improveId);
    undo.itemId = data.improveId;
    undo.prevType = item?.system.type ?? '';
    undo.prevRank = Number(item?.system.skill?.rank) || 0;
  } else if (data.choice === 'ability') {
    undo.ability = data.ability;
  }

  const result = await applyCharacterUpgrade(actor, data);
  if (!result) return;
  if (data.choice === 'newTrait') undo.createdIds = actor.items.filter(i => !before.has(i.id)).map(i => i.id);

  await actor.update({ 'system.pending_upgrades': Math.max((actor.system.pending_upgrades ?? 1) - 1, 0) });
  const text = $fmt('SDM.Upgrade.ChatCharacter', { actor: actor.name, upgrade: result });
  await logProgress(actor, { type: 'upgrade', text, ...undo });
  await chat(actor, text);
}

/** Show the dropped document in the drop zone, with an × to clear it again. */
function showDropped(zone, input, name) {
  const placeholder = zone.dataset.placeholder ?? zone.textContent;
  zone.dataset.placeholder = placeholder;
  zone.innerHTML = '';
  const label = document.createElement('span');
  label.textContent = name;
  const clear = document.createElement('a');
  clear.className = 'sdm-upgrade-clear';
  clear.dataset.tooltip = $l10n('SDM.Upgrade.Clear');
  clear.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  clear.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    input.value = '';
    zone.textContent = placeholder;
    zone.classList.remove('has-item');
  });
  zone.append(label, clear);
  zone.classList.add('has-item');
}

/** Accept an item mod (an effect from "Mods & Effects" or another item) dragged into the dialog. */
/** Customization cost of gaining this mod on the item: mod cost × number of mods, or the item cost if higher. */
function modUpgradeCost(item, mod) {
  const mods = item.effects.filter(e => e.system?.isItemMod).length + 1;
  const modCost = Number(mod.system?.modCost) || 0;
  const itemCost = Number(item.system.cost) || 0;
  return { mods, modCost, itemCost, total: Math.max(modCost * mods, itemCost) };
}

function describeModCost(item, mod) {
  const { mods, modCost, itemCost, total } = modUpgradeCost(item, mod);
  const symbol = $l10n('SDM.CashSymbol');
  return modCost * mods >= itemCost
    ? $fmt('SDM.Upgrade.ModCostByMods', { symbol, modCost, mods, total })
    : $fmt('SDM.Upgrade.ModCostByItem', { symbol, total });
}

function bindModDrop(root, item) {
  const zone = root?.querySelector('[data-upgrade-drop-mod]');
  const input = root?.querySelector('input[name="modUuid"]');
  if (!zone || !input) return;
  zone.addEventListener('dragover', event => {
    event.preventDefault();
    zone.classList.add('is-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', async event => {
    event.preventDefault();
    zone.classList.remove('is-over');
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    const effect = data?.uuid ? await fromUuid(data.uuid) : null;
    if (!effect || effect.documentName !== 'ActiveEffect' || !effect.system?.isItemMod) {
      ui.notifications.warn($l10n('SDM.Upgrade.OnlyMods'));
      return;
    }
    input.value = effect.uuid;
    showDropped(zone, input, `${effect.name} (${describeModCost(item, effect)})`);
    const radio = root.querySelector('input[name="choice"][value="mod"]');
    if (radio) radio.checked = true;
  });
}

/** Accept a power (gear, trait or burden power) dragged into the hallmark dialog. */
function bindPowerDrop(root) {
  const zone = root?.querySelector('[data-upgrade-drop-power]');
  const input = root?.querySelector('input[name="powerUuid"]');
  if (!zone || !input) return;
  zone.addEventListener('dragover', event => {
    event.preventDefault();
    zone.classList.add('is-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', async event => {
    event.preventDefault();
    zone.classList.remove('is-over');
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    const power = data?.uuid ? await fromUuid(data.uuid) : null;
    if (!power || power.documentName !== 'Item' || power.system?.type !== 'power') {
      ui.notifications.warn($l10n('SDM.Upgrade.OnlyPowers'));
      return;
    }
    input.value = power.uuid;
    showDropped(zone, input, power.name);
    const radio = root.querySelector('input[name="choice"][value="power"]');
    if (radio) radio.checked = true;
  });
}

/** Using a field of an option (focus, opening a dropdown, clicking) selects that option. */
function bindChoiceFocus(root) {
  for (const detail of root?.querySelectorAll('.sdm-upgrade-detail') ?? []) {
    // The option's radio is in the closest choice label before its fields
    let label = detail.previousElementSibling;
    while (label && !label.classList.contains('sdm-upgrade-choice')) label = label.previousElementSibling;
    const radio = label?.querySelector('input[type="radio"]');
    if (!radio) continue;
    const select = () => {
      if (!radio.disabled) radio.checked = true;
    };
    detail.addEventListener('focusin', select);
    detail.addEventListener('pointerdown', select);
  }
}

/** Accept a trait (any subtype: skill, power, pet...) dragged from a compendium, the sidebar or another sheet. */
function bindTraitDrop(root) {
  const zone = root?.querySelector('[data-upgrade-drop]');
  const input = root?.querySelector('input[name="traitUuid"]');
  if (!zone || !input) return;
  zone.addEventListener('dragover', event => {
    event.preventDefault();
    zone.classList.add('is-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', async event => {
    event.preventDefault();
    zone.classList.remove('is-over');
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    const item = data?.uuid ? await fromUuid(data.uuid) : null;
    if (!item || item.documentName !== 'Item' || !isTraitUpgradeSource(item)) {
      ui.notifications.warn($l10n('SDM.Upgrade.OnlyTraits'));
      return;
    }
    input.value = item.uuid;
    showDropped(zone, input, item.name);
    const radio = root.querySelector('input[name="choice"][value="newTrait"]');
    if (radio) radio.checked = true;
  });
}

async function applyCharacterUpgrade(actor, data) {
  if (data.choice === 'newTrait') {
    if (data.randomTrait) {
      const trait = await addRandomTrait(actor);
      if (!trait) {
        ui.notifications.warn($l10n('SDM.Upgrade.RandomFailed'));
        return null;
      }
      return $fmt('SDM.Upgrade.ChatNewTrait', { trait: trait.name ?? trait.title ?? '' });
    }
    // A brand new trait: created empty with that name, details filled in later
    if (!data.traitUuid && data.newTraitName) {
      const type = NEW_TRAIT_TYPES.includes(data.newTraitType) ? data.newTraitType : '';
      await actor.createEmbeddedDocuments('Item', [
        { name: data.newTraitName, type: ItemType.TRAIT, system: { type } }
      ]);
      return $fmt('SDM.Upgrade.ChatNewTrait', { trait: traitText(data.newTraitName, type) });
    }
    const source = data.traitUuid ? await fromUuid(data.traitUuid) : null;
    if (!source) {
      ui.notifications.warn($l10n('SDM.Upgrade.ChooseTrait'));
      return null;
    }
    if (!isTraitUpgradeSource(source)) {
      ui.notifications.warn($l10n('SDM.Upgrade.OnlyTraits'));
      return null;
    }
    const itemData = source.toObject();
    itemData.name = itemData.name.replace(/^\d+\.\s*/, '');
    // A power or pet gear/burden becomes a trait with the same subtype
    itemData.type = ItemType.TRAIT;
    await actor.createEmbeddedDocuments('Item', [itemData]);
    return $fmt('SDM.Upgrade.ChatNewTrait', { trait: traitText(itemData.name, itemData.system?.type ?? '') });
  }

  if (data.choice === 'improve') {
    const item = actor.items.get(data.improveId);
    const entry = improvableTraits(actor).find(e => e.item.id === data.improveId);
    if (!item || !entry) return null;
    await item.update({ 'system.type': 'skill', 'system.skill.rank': entry.to });
    return $fmt('SDM.Upgrade.ChatImprove', { trait: item.name, rank: rankLabel(entry.to) });
  }

  if (data.choice === 'ability') {
    const ability = actor.system.abilities[data.ability];
    if (!ability) return null;
    await actor.update({
      [`system.abilities.${data.ability}.base`]: ability.base + 1,
      [`system.abilities.${data.ability}.current`]: ability.current + 1
    });
    return $fmt('SDM.Upgrade.ChatAbility', {
      ability: $l10n(CONFIG.SDM.abilities[data.ability]),
      value: ability.base + 1
    });
  }
  return null;
}

/* -------------------------------------------- */
/*  Hallmark                                    */
/* -------------------------------------------- */

function hallmarkKinds(item) {
  const features = item.system.features;
  const has = key => typeof features?.has === 'function' && features.has(key);
  const type = item.system.type;
  return {
    weapon: type === GearType.WEAPON || has('weapon'),
    armor: type === GearType.ARMOR || has('armor'),
    ward: type === GearType.WARD || has('ward')
  };
}

export async function openHallmarkUpgradeDialog(item) {
  if (!item?.system?.is_hallmark || !item.isOwner) return;
  const hallmark = item.system.hallmark;
  const pending = hallmark.pending_upgrades ?? 0;
  if (pending <= 0) return;

  // The level this upgrade comes from: the oldest pending one when several levels were gained at once
  const reached = Number(hallmark.upgrades_level ?? hallmark.level) || 0;
  const level = Math.max(reached - pending + 1, 1);
  const kinds = hallmarkKinds(item);
  // Material cost (only charged when ticked): price × the level the upgrade comes from
  const damageCost = 5 * level;
  const defenseCost = 10 * level;
  // e.g. "€5 × level 3 = €15"
  const cost = perLevel =>
    $fmt('SDM.Upgrade.CostPerLevel', { symbol: $l10n('SDM.CashSymbol'), perLevel, level, total: perLevel * level });
  const canDefense = kinds.armor || kinds.ward;
  // Features of this kind of item (as on its Features tab) that it does not have yet
  const featureOptions = itemFeatureChoices(item)
    .map(choice => choice.value)
    .filter((feature, index, all) => all.indexOf(feature) === index)
    .filter(feature => !item.system.features?.has?.(feature))
    .map(feature => ({ feature, label: $l10n(`SDM.ItemFeature.${feature}`) }))
    .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang))
    .map(({ feature, label }) => `<option value="${feature}">${esc(label)}</option>`)
    .join('');

  const content = `
    <div class="sdm-upgrade">
      <p class="sdm-upgrade-pending">${$fmt('SDM.Upgrade.Pending', { count: pending })}</p>
      ${kinds.weapon ? `<label class="sdm-upgrade-choice"><input type="radio" name="choice" value="damage" checked /> ${$l10n('SDM.Upgrade.Damage')} (${cost(5)})</label>` : ''}
      ${canDefense ? `<label class="sdm-upgrade-choice"><input type="radio" name="choice" value="defense" ${kinds.weapon ? '' : 'checked'} /> ${$l10n('SDM.Upgrade.Defense')} (${cost(10)})</label>` : ''}
      <label class="sdm-upgrade-choice"><input type="radio" name="choice" value="mod" ${kinds.weapon || canDefense ? '' : 'checked'} /> ${$l10n('SDM.Upgrade.Mod')} (${$l10n('SDM.Upgrade.ModCost')})</label>
      <p class="hint sdm-upgrade-hint">${$l10n('SDM.Upgrade.ModHint')}</p>
      <div class="sdm-upgrade-detail">
        <div class="sdm-upgrade-drop" data-upgrade-drop-mod>${$l10n('SDM.Upgrade.DropMod')}</div>
        <input type="hidden" name="modUuid" />
      </div>
      <label class="sdm-upgrade-choice"><input type="radio" name="choice" value="feature" ${featureOptions ? '' : 'disabled'} /> ${$l10n('SDM.Upgrade.Feature')}</label>
      <div class="sdm-upgrade-detail">
        ${featureOptions ? `<select name="feature">${featureOptions}</select>` : `<span class="hint">${$l10n('SDM.Upgrade.NoFeatureLeft')}</span>`}
      </div>
      <label class="sdm-upgrade-choice"><input type="radio" name="choice" value="trait" /> ${$l10n('SDM.Upgrade.Trait')}</label>
      <div class="sdm-upgrade-detail">
        <input type="text" name="traitName" placeholder="${esc($l10n('SDM.Upgrade.TraitName'))}" />
        <textarea name="traitDescription" rows="3" placeholder="${esc($l10n('SDM.Upgrade.TraitDescription'))}"></textarea>
      </div>
      <label class="sdm-upgrade-choice"><input type="radio" name="choice" value="power" /> ${$l10n('SDM.Upgrade.Power')}</label>
      <div class="sdm-upgrade-detail">
        <div class="sdm-upgrade-drop" data-upgrade-drop-power>${$l10n('SDM.Upgrade.DropPower')}</div>
        <input type="hidden" name="powerUuid" />
      </div>
      <label class="sdm-upgrade-charge" data-tooltip="${esc($l10n('SDM.Upgrade.ChargeHint'))}"><input type="checkbox" name="charge" /> ${$l10n('SDM.Upgrade.Charge')}</label>
    </div>`;

  const data = await DialogV2.prompt({
    window: { title: $fmt('SDM.Upgrade.Title', { name: item.name }), icon: 'fa-solid fa-angles-up' },
    position: { width: 480 },
    content,
    rejectClose: false,
    render: (event, dialog) => {
      bindModDrop(dialog.element, item);
      bindPowerDrop(dialog.element);
      bindChoiceFocus(dialog.element);
    },
    ok: {
      label: $l10n('SDM.Upgrade.Confirm'),
      icon: 'fa-solid fa-check',
      callback: (event, button) => {
        const f = button.form.elements;
        return {
          choice: f.choice.value,
          text: f.text?.value?.trim(),
          modUuid: f.modUuid?.value,
          charge: !!f.charge?.checked,
          feature: f.feature?.value,
          traitName: f.traitName?.value?.trim(),
          traitDescription: f.traitDescription?.value?.trim(),
          powerUuid: f.powerUuid?.value
        };
      }
    }
  });
  if (!data) return;

  const owner = item.parent;
  // XP pays for the upgrade; money only when the material cost is charged
  // (a feature or a trait has no material cost in the rules)
  const noCost = !data.charge || ['text', 'feature', 'trait', 'power'].includes(data.choice);
  let price = data.choice === 'damage' ? damageCost : data.choice === 'defense' ? defenseCost : 0;

  if (data.choice === 'text' && !data.text) {
    ui.notifications.warn($l10n('SDM.Upgrade.DescribeUpgrade'));
    return;
  }
  if (data.choice === 'feature' && !data.feature) return;
  const powerSource = data.choice === 'power' && data.powerUuid ? await fromUuid(data.powerUuid) : null;
  if (data.choice === 'power' && powerSource?.system?.type !== 'power') {
    ui.notifications.warn($l10n('SDM.Upgrade.ChoosePower'));
    return;
  }
  let powerUndo = null;
  if (data.choice === 'trait' && !data.traitName) {
    ui.notifications.warn($l10n('SDM.Upgrade.TraitNameNeeded'));
    return;
  }
  // Install the mod first: the item checks its type and mod slots, and nothing is spent if it refuses
  let modEffectId = null;
  let modName = '';
  if (data.choice === 'mod') {
    const mod = data.modUuid ? await fromUuid(data.modUuid) : null;
    if (!mod) {
      ui.notifications.warn($l10n('SDM.Upgrade.ChooseMod'));
      return;
    }
    const modData = mod.toObject();
    delete modData._id;
    // Gained as the level's upgrade: it does not use one of the item's mod slots
    modData.system = { ...(modData.system ?? {}), isItemMod: true, isHallmarkUpgrade: true };
    const [created] = await item.createEmbeddedDocuments('ActiveEffect', [modData]);
    if (!created) return;
    modEffectId = created.id;
    modName = created.name;
    // Customization cost = mod cost × total number of upgrades (mods), or the item's cost if higher
    const installed = item.effects.filter(e => e.system?.isItemMod).length;
    const modCost = Number(created.system?.modCost) || 0;
    price = Math.max(modCost * installed, Number(item.system.cost) || 0);
    // (same as shown when the mod was dropped: the new mod is now counted among the installed ones)
    if (!noCost && price > 0) {
      const paid = owner ? await removeCashFromActor(owner, price) : false;
      if (paid === false) {
        // Not enough money: take the mod out again, nothing is spent
        await item.deleteEmbeddedDocuments('ActiveEffect', [created.id]);
        ui.notifications.warn($fmt('SDM.Upgrade.NotEnoughCash', { cost: price }));
        return;
      }
    }
  }
  if (!noCost && price > 0 && data.choice !== 'mod') {
    const paid = owner ? await removeCashFromActor(owner, price) : false;
    if (paid === false) {
      ui.notifications.warn($fmt('SDM.Upgrade.NotEnoughCash', { cost: price }));
      return;
    }
  }

  let upgrade;
  if (data.choice === 'damage') {
    await addHallmarkEffectChanges(item, [
      { key: 'system.weapon.damage.base', type: 'custom', value: 'boost', priority: 60, phase: 'initial' },
      { key: 'system.weapon.damage.versatile', type: 'custom', value: 'boost', priority: 60, phase: 'initial' }
    ]);
    upgrade = $l10n('SDM.Upgrade.Damage');
    // An animated weapon's creature fights with the improved damage
    await syncAnimationLevel(item);
  } else if (data.choice === 'defense') {
    const key = kinds.armor ? 'system.armor.value' : 'system.ward.value';
    await addHallmarkEffectChanges(item, [{ key, type: 'add', value: 1, priority: 60, phase: 'initial' }]);
    upgrade = $l10n('SDM.Upgrade.Defense');
    // An animated armor's creature gets the higher defense
    await syncAnimationLevel(item);
  } else if (data.choice === 'mod') {
    upgrade = $fmt('SDM.Upgrade.ChatMod', { mod: modName });
    await syncAnimationLevel(item);
  } else if (data.choice === 'feature') {
    // Recorded on the item so undo removes only this feature, and the item lists it as an upgrade
    const gained = [...(item.getFlag('sdm', HALLMARK_FEATURES_FLAG) ?? []), data.feature];
    await item.update({
      'system.features': [...(item.system.features ?? []), data.feature],
      [`flags.sdm.${HALLMARK_FEATURES_FLAG}`]: gained
    });
    upgrade = $fmt('SDM.Upgrade.ChatFeature', { feature: $l10n(`SDM.ItemFeature.${data.feature}`) });
    await syncAnimationLevel(item);
  } else if (data.choice === 'power') {
    // The power goes into the item's album: one more slot, or a new album with one slot
    const source = item._source.system;
    const hadAlbum = source.type === GearType.POWER_ALBUM || (source.features ?? []).includes('album');
    const power = {
      ...new PowerDataModel().toObject(),
      ...foundry.utils.duplicate(powerSource.system.power ?? {}),
      name: powerSource.name,
      img: powerSource.img,
      description: powerSource.system.description ?? ''
    };
    const update = {
      'system.powers': [...foundry.utils.duplicate(source.powers ?? []), power],
      'system.max_powers': hadAlbum ? (Number(source.max_powers) || 0) + 1 : 1,
      [`flags.sdm.${HALLMARK_POWERS_FLAG}`]: [...(item.getFlag('sdm', HALLMARK_POWERS_FLAG) ?? []), power.name]
    };
    if (!hadAlbum) update['system.features'] = [...(source.features ?? []), 'album'];
    powerUndo = { name: power.name, addedAlbum: !hadAlbum, prevMaxPowers: Number(source.max_powers) || 0 };
    await item.update(update);
    upgrade = $fmt('SDM.Upgrade.ChatPower', { power: power.name });
    await syncAnimationLevel(item);
  } else if (data.choice === 'trait') {
    // A named trait with its description: an effect on the item (changes can be added to it later)
    const description = data.traitDescription
      ? `<p>${esc(data.traitDescription).replace(/\n/g, '<br>')}</p>`
      : '';
    const [created] = await item.createEmbeddedDocuments('ActiveEffect', [
      {
        name: data.traitName,
        img: 'icons/svg/aura.svg',
        description,
        // Stays on the item (tick "apply to actor" in the effect if it should affect the bearer)
        transfer: false,
        flags: { sdm: { [HALLMARK_TRAIT_FLAG]: true } }
      }
    ]);
    if (!created) return;
    modEffectId = created.id;
    upgrade = data.traitDescription
      ? $fmt('SDM.Upgrade.ChatTraitDescribed', { trait: data.traitName, description: data.traitDescription })
      : $fmt('SDM.Upgrade.ChatTrait', { trait: data.traitName });
  } else {
    await item.update({ 'system.hallmark.upgrade_notes': [...(hallmark.upgrade_notes ?? []), data.text] });
    upgrade = data.text;
  }

  await item.update({ 'system.hallmark.pending_upgrades': Math.max(pending - 1, 0) });
  // The history and chat say whether the material cost was paid (to undo and redo if it was wrong)
  const paid = !noCost && price > 0;
  const costText = paid
    ? ` (${$fmt('SDM.Upgrade.Paid', { cost: `${$l10n('SDM.CashSymbol')}${price}` })})`
    : ` (${$l10n('SDM.Upgrade.NotCharged')})`;
  const text = $fmt('SDM.Upgrade.ChatHallmark', { item: item.name, upgrade: `${upgrade}${costText}` });
  await logProgress(owner, {
    type: 'hallmark',
    text,
    itemId: item.id,
    choice: data.choice,
    changes: data.choice === 'damage' ? 2 : data.choice === 'defense' ? 1 : 0,
    note: data.choice === 'text' ? data.text : null,
    feature: data.choice === 'feature' ? data.feature : null,
    power: powerUndo,
    effectId: modEffectId,
    cost: paid ? price : 0,
    charged: paid
  });
  await chat(owner ?? null, text);
}

/** The features an item can have: base + its subtype's (weapon, armor, ward); mounts and vehicles their own list. */
function itemFeatureChoices(item) {
  const SDM = CONFIG.SDM;
  if ([ItemType.MOUNT, ItemType.VEHICLE].includes(item.type)) return [...(SDM.transportFeatures ?? [])];
  const base = [...(SDM.baseFeatures ?? [])];
  if (item.type !== ItemType.GEAR) return base;
  if (item.system.type === GearType.WARD) return [...base, ...(SDM.wardFeatures ?? [])];
  if (item.system.type === GearType.ARMOR) return [...base, ...(SDM.armorFeatures ?? [])];
  if (item.system.type === GearType.WEAPON) return [...base, ...(SDM.weaponFeatures ?? [])];
  return base;
}

/** All hallmark upgrades live in one effect on the item (not a mod: it does not use a mod slot). */
async function addHallmarkEffectChanges(item, changes) {
  const effect = item.effects.find(e => e.getFlag('sdm', HALLMARK_EFFECT_FLAG));
  if (effect) {
    await effect.update({ 'system.changes': [...(effect.system.changes ?? []), ...changes] });
    return;
  }
  await item.createEmbeddedDocuments('ActiveEffect', [
    {
      name: $l10n('SDM.Upgrade.EffectName'),
      img: item.img,
      transfer: false,
      system: { changes },
      flags: { sdm: { [HALLMARK_EFFECT_FLAG]: true } }
    }
  ]);
}

/**
 * What a hallmark gained from its level-ups, for its sheet and the inventory tooltip:
 * [{ icon, label, description }] (description: HTML, only for traits).
 */
export function getHallmarkUpgradeSummary(item) {
  if (!item?.system?.is_hallmark) return [];
  const list = [];
  const changes = item.effects.find(e => e.getFlag('sdm', HALLMARK_EFFECT_FLAG))?.system?.changes ?? [];
  const damage = changes.filter(c => c.key === 'system.weapon.damage.base').length;
  const defense = changes.filter(c => ['system.armor.value', 'system.ward.value'].includes(c.key)).length;
  if (damage) list.push({ icon: 'fa-solid fa-burst', label: $fmt('SDM.Upgrade.SummaryDamage', { count: damage }) });
  if (defense) list.push({ icon: 'fa-solid fa-shield', label: $fmt('SDM.Upgrade.SummaryDefense', { count: defense }) });
  for (const feature of item.getFlag('sdm', HALLMARK_FEATURES_FLAG) ?? []) {
    if (item.system.features?.has?.(feature)) {
      list.push({ icon: 'fa-solid fa-tag', label: $l10n(`SDM.ItemFeature.${feature}`) });
    }
  }
  for (const name of item.getFlag('sdm', HALLMARK_POWERS_FLAG) ?? []) {
    list.push({ icon: 'fa-solid fa-wand-magic-sparkles', label: name });
  }
  for (const effect of item.effects) {
    if (effect.system?.isItemMod && effect.system?.isHallmarkUpgrade) {
      list.push({ icon: 'fa-solid fa-puzzle-piece', label: effect.name, tooltip: $l10n('SDM.Upgrade.ModUpgradeTooltip'), description: effect.description || '' });
    } else if (effect.getFlag('sdm', HALLMARK_TRAIT_FLAG)) {
      list.push({ icon: 'fa-solid fa-star', label: effect.name, description: effect.description || '' });
    }
  }
  for (const note of item.system.hallmark?.upgrade_notes ?? []) list.push({ icon: 'fa-solid fa-star', label: note });
  return list;
}

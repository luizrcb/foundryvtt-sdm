import { ActorType, GearType, ItemType, TraitType } from '../helpers/constants.mjs';
import { $fmt, $l10n } from '../helpers/globalUtils.mjs';
import { addRandomTrait } from '../macros/gm/characterGenerator.mjs';
import { removeCashFromActor } from '../macros/gm/giveCash.mjs';
import { syncAnimationLevel } from '../helpers/animatedItems.mjs';
import { logProgress } from './progress-log.mjs';

/**
 * Level-up upgrades. Every level gained leaves one pending upgrade on the character or the
 * hallmark; the player chooses it here and the pending upgrade is consumed.
 *  - Character: a new trait (chosen or random), improve a trait (skilled → expert → master;
 *    a plain trait counts as skilled), or +1 to an ability score.
 *  - Hallmark: +1 to every damage die (€5 × item level), +1 defense (€10 × item level),
 *    or a new trait, power or complication (text). The Referee can waive the material cost.
 * Life and hero dice already come with the character's level.
 */

const { DialogV2 } = foundry.applications.api;
const HALLMARK_EFFECT_FLAG = 'hallmarkUpgrades';
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
    render: (event, dialog) => bindTraitDrop(dialog.element),
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

function describeModCost(item, mod, free) {
  if (free) return $l10n('SDM.Upgrade.NoCost');
  const { mods, modCost, itemCost, total } = modUpgradeCost(item, mod);
  const symbol = $l10n('SDM.CashSymbol');
  return modCost * mods >= itemCost
    ? $fmt('SDM.Upgrade.ModCostByMods', { symbol, modCost, mods, total })
    : $fmt('SDM.Upgrade.ModCostByItem', { symbol, total });
}

function bindModDrop(root, item, free) {
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
    showDropped(zone, input, `${effect.name} (${describeModCost(item, effect, free)})`);
    const radio = root.querySelector('input[name="choice"][value="mod"]');
    if (radio) radio.checked = true;
  });
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
    if (!item || item.documentName !== 'Item' || item.type !== ItemType.TRAIT) {
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
    const itemData = source.toObject();
    itemData.name = itemData.name.replace(/^\d+\.\s*/, '');
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
  const free = !!hallmark.free_upgrade;
  // Fixed price × level, or the item's cost if higher
  const itemCost = Number(item.system.cost) || 0;
  const damageCost = Math.max(5 * level, itemCost);
  const defenseCost = Math.max(10 * level, itemCost);
  // e.g. "€5 × level 3 = €15", or "item cost: €40" when the item costs more
  const cost = perLevel => {
    if (free) return $l10n('SDM.Upgrade.NoCost');
    const symbol = $l10n('SDM.CashSymbol');
    return perLevel * level >= itemCost
      ? $fmt('SDM.Upgrade.CostPerLevel', { symbol, perLevel, level, total: perLevel * level })
      : $fmt('SDM.Upgrade.ModCostByItem', { symbol, total: itemCost });
  };
  const canDefense = kinds.armor || kinds.ward;

  const content = `
    <div class="sdm-upgrade">
      <p class="sdm-upgrade-pending">${$fmt('SDM.Upgrade.Pending', { count: pending })}</p>
      ${kinds.weapon ? `<label class="sdm-upgrade-choice"><input type="radio" name="choice" value="damage" checked /> ${$l10n('SDM.Upgrade.Damage')} (${cost(5)})</label>` : ''}
      ${canDefense ? `<label class="sdm-upgrade-choice"><input type="radio" name="choice" value="defense" ${kinds.weapon ? '' : 'checked'} /> ${$l10n('SDM.Upgrade.Defense')} (${cost(10)})</label>` : ''}
      <label class="sdm-upgrade-choice"><input type="radio" name="choice" value="mod" ${kinds.weapon || canDefense ? '' : 'checked'} /> ${$l10n('SDM.Upgrade.Mod')} (${free ? $l10n('SDM.Upgrade.NoCost') : $l10n('SDM.Upgrade.ModCost')})</label>
      <p class="hint sdm-upgrade-hint">${$l10n('SDM.Upgrade.ModHint')}</p>
      <div class="sdm-upgrade-detail">
        <div class="sdm-upgrade-drop" data-upgrade-drop-mod>${$l10n('SDM.Upgrade.DropMod')}</div>
        <input type="hidden" name="modUuid" />
      </div>
      ${game.user.isGM && !free ? `<label><input type="checkbox" name="waive" /> ${$l10n('SDM.Upgrade.WaiveCost')}</label>` : ''}
    </div>`;

  const data = await DialogV2.prompt({
    window: { title: $fmt('SDM.Upgrade.Title', { name: item.name }), icon: 'fa-solid fa-angles-up' },
    position: { width: 480 },
    content,
    rejectClose: false,
    render: (event, dialog) => bindModDrop(dialog.element, item, free),
    ok: {
      label: $l10n('SDM.Upgrade.Confirm'),
      icon: 'fa-solid fa-check',
      callback: (event, button) => {
        const f = button.form.elements;
        return {
          choice: f.choice.value,
          text: f.text?.value?.trim(),
          modUuid: f.modUuid?.value,
          waive: !!f.waive?.checked
        };
      }
    }
  });
  if (!data) return;

  const owner = item.parent;
  const noCost = free || data.waive || data.choice === 'text';
  let price = data.choice === 'damage' ? damageCost : data.choice === 'defense' ? defenseCost : 0;

  if (data.choice === 'text' && !data.text) {
    ui.notifications.warn($l10n('SDM.Upgrade.DescribeUpgrade'));
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
  } else {
    await item.update({ 'system.hallmark.upgrade_notes': [...(hallmark.upgrade_notes ?? []), data.text] });
    upgrade = data.text;
  }

  await item.update({
    'system.hallmark.pending_upgrades': Math.max(pending - 1, 0),
    'system.hallmark.free_upgrade': false
  });
  const costText = !noCost && price > 0 ? ` (${$l10n('SDM.CashSymbol')}${price})` : '';
  const text = $fmt('SDM.Upgrade.ChatHallmark', { item: item.name, upgrade: `${upgrade}${costText}` });
  await logProgress(owner, {
    type: 'hallmark',
    text,
    itemId: item.id,
    choice: data.choice,
    changes: data.choice === 'damage' ? 2 : data.choice === 'defense' ? 1 : 0,
    note: data.choice === 'text' ? data.text : null,
    effectId: modEffectId,
    cost: !noCost && price > 0 ? price : 0
  });
  await chat(owner ?? null, text);
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

import { MAX_ATTRIBUTE_VALUE } from '../helpers/actorUtils.mjs';
import { ActorType, GearType, ItemType } from '../helpers/constants.mjs';
import { $fmt, $l10n } from '../helpers/globalUtils.mjs';
import { addRandomTrait } from '../macros/gm/characterGenerator.mjs';
import { removeCashFromActor } from '../macros/gm/giveCash.mjs';

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
const MAX_SKILL_RANK = 3;
const esc = text => foundry.utils.escapeHTML?.(String(text ?? '')) ?? String(text ?? '');
const rankLabel = rank =>
  $l10n({ 1: 'SDM.SkillSkilled', 2: 'SDM.SkillExpert', 3: 'SDM.SkillMaster' }[rank] ?? 'SDM.SkillSkilled');

async function chat(actor, text) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><i class="fa-solid fa-angles-up"></i> ${text}</p>`
  });
}

/* -------------------------------------------- */
/*  Character                                   */
/* -------------------------------------------- */

/** Traits that can be improved: skills below master, and plain traits (worth a skilled skill). */
function improvableTraits(actor) {
  return actor.items
    .filter(item => item.type === ItemType.TRAIT)
    .map(item => {
      const type = item.system.type ?? '';
      const rank = Number(item.system.skill?.rank) || 0;
      if (type === 'skill' && rank < MAX_SKILL_RANK) return { item, from: rank || 1, to: (rank || 1) + 1 };
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
  const abilityOptions = Object.entries(abilities)
    .filter(([key]) => (actor.system.abilities[key]?.base ?? 0) < MAX_ATTRIBUTE_VALUE)
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
          improveId: f.improveId?.value,
          ability: f.ability?.value
        };
      }
    }
  });
  if (!data) return;

  const result = await applyCharacterUpgrade(actor, data);
  if (!result) return;
  await actor.update({ 'system.pending_upgrades': Math.max((actor.system.pending_upgrades ?? 1) - 1, 0) });
  await chat(actor, $fmt('SDM.Upgrade.ChatCharacter', { actor: actor.name, upgrade: result }));
}

/** Accept a trait dragged from a compendium, the sidebar or another sheet. */
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
    zone.textContent = item.name;
    zone.classList.add('has-item');
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
    const source = data.traitUuid ? await fromUuid(data.traitUuid) : null;
    if (!source) {
      ui.notifications.warn($l10n('SDM.Upgrade.ChooseTrait'));
      return null;
    }
    const itemData = source.toObject();
    itemData.name = itemData.name.replace(/^\d+\.\s*/, '');
    await actor.createEmbeddedDocuments('Item', [itemData]);
    return $fmt('SDM.Upgrade.ChatNewTrait', { trait: itemData.name });
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
    if (!ability || ability.base >= MAX_ATTRIBUTE_VALUE) return null;
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

  const level = Math.max(Number(hallmark.level) || 0, 1);
  const kinds = hallmarkKinds(item);
  const free = !!hallmark.free_upgrade;
  const damageCost = 5 * level;
  const defenseCost = 10 * level;
  const cost = value =>
    free ? $l10n('SDM.Upgrade.NoCost') : `${$l10n('SDM.CashSymbol')}${value}`;
  const canDefense = kinds.armor || kinds.ward;

  const content = `
    <div class="sdm-upgrade">
      <p class="sdm-upgrade-pending">${$fmt('SDM.Upgrade.Pending', { count: pending })}</p>
      <label class="sdm-upgrade-choice"><input type="radio" name="choice" value="damage" ${kinds.weapon ? 'checked' : 'disabled'} /> ${$l10n('SDM.Upgrade.Damage')} (${cost(damageCost)})</label>
      <label class="sdm-upgrade-choice"><input type="radio" name="choice" value="defense" ${canDefense ? (kinds.weapon ? '' : 'checked') : 'disabled'} /> ${$l10n('SDM.Upgrade.Defense')} (${cost(defenseCost)})</label>
      <label class="sdm-upgrade-choice"><input type="radio" name="choice" value="text" ${kinds.weapon || canDefense ? '' : 'checked'} /> ${$l10n('SDM.Upgrade.Text')}</label>
      <div class="sdm-upgrade-detail"><input type="text" name="text" placeholder="${esc($l10n('SDM.Upgrade.TextPlaceholder'))}" /></div>
      ${game.user.isGM && !free ? `<label><input type="checkbox" name="waive" /> ${$l10n('SDM.Upgrade.WaiveCost')}</label>` : ''}
    </div>`;

  const data = await DialogV2.prompt({
    window: { title: $fmt('SDM.Upgrade.Title', { name: item.name }), icon: 'fa-solid fa-angles-up' },
    position: { width: 480 },
    content,
    rejectClose: false,
    ok: {
      label: $l10n('SDM.Upgrade.Confirm'),
      icon: 'fa-solid fa-check',
      callback: (event, button) => {
        const f = button.form.elements;
        return { choice: f.choice.value, text: f.text?.value?.trim(), waive: !!f.waive?.checked };
      }
    }
  });
  if (!data) return;

  const owner = item.parent;
  const noCost = free || data.waive || data.choice === 'text';
  const price = data.choice === 'damage' ? damageCost : data.choice === 'defense' ? defenseCost : 0;

  if (data.choice === 'text' && !data.text) {
    ui.notifications.warn($l10n('SDM.Upgrade.DescribeUpgrade'));
    return;
  }
  if (!noCost && price > 0) {
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
  } else if (data.choice === 'defense') {
    const key = kinds.armor ? 'system.armor.value' : 'system.ward.value';
    await addHallmarkEffectChanges(item, [{ key, type: 'add', value: 1, priority: 60, phase: 'initial' }]);
    upgrade = $l10n('SDM.Upgrade.Defense');
  } else {
    await item.update({ 'system.hallmark.upgrade_notes': [...(hallmark.upgrade_notes ?? []), data.text] });
    upgrade = data.text;
  }

  await item.update({
    'system.hallmark.pending_upgrades': Math.max(pending - 1, 0),
    'system.hallmark.free_upgrade': false
  });
  const costText = !noCost && price > 0 ? ` (${$l10n('SDM.CashSymbol')}${price})` : '';
  await chat(owner ?? null, $fmt('SDM.Upgrade.ChatHallmark', { item: item.name, upgrade: `${upgrade}${costText}` }));
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

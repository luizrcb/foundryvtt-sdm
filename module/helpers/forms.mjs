import { rollAmount } from './formulas.mjs';
import { $fmt, $l10n } from './globalUtils.mjs';
import { ActorType, GearType, ItemType } from './constants.mjs';

/**
 * Shapeshifting: a form is an effect marked Form (its Form tab) that changes what a creature is while
 * it is on, for characters and NPCs alike, and undoes itself when it ends.
 *
 * - Look: the tokens take the form's image, scale, size and shown name (the portrait too, if ticked);
 *   a creature dropped on the form gives its look and its attacks and traits when the form has none.
 * - Numbers: the effect's own changes, as any effect.
 * - Life: the form's temporary life (a formula), taken before the user's life; optionally the form ends
 *   when it runs out.
 * - Granted items (claws, bite, a trait): copies added while it lasts, marked with the form, no slots;
 *   their uses fresh each time or remembered.
 * - Keeps: everything, the mind only (own weapons, armor and wards set aside; powers usable or not)
 *   or nothing (all own gear set aside). Set-aside items stay in the inventory, unreadied.
 * - One form at a time: a new one ends the old one. The Referee's game does the work.
 */

const ACTIVE_FLAG = 'form'; // on the actor: { effect, saved: { tokens, prototype, portrait }, setAside, traitEffects, tempLife }
const GRANT_FLAG = 'fromForm';
const SET_ASIDE_FLAG = 'formSetAside';
const USES_FLAG = 'formUses';
const TEMP_LIFE_FLAG = 'formTempLife';

const esc = text => foundry.utils.escapeHTML(String(text ?? ''));
const isActiveGM = () => game.user.isGM && game.users.activeGM?.isSelf;

/** The actor an effect applies to (an actor's own, or one transferred from its item). */
function effectActor(effect) {
  const parent = effect?.parent;
  if (parent?.documentName === 'Actor') return parent;
  if (parent?.documentName === 'Item' && effect.transfer) return parent.actor ?? null;
  return null;
}

/** A form effect that is on: marked Form, not disabled or suppressed, applying to an actor. */
export function isForm(effect) {
  return !!effect?.system?.form?.enabled;
}
function formIsOn(effect) {
  return isForm(effect) && !effect.disabled && !effect.isSuppressed && !!effectActor(effect);
}

/** The actor's current form effect, or null. */
export function currentForm(actor) {
  const id = actor?.getFlag?.('sdm', ACTIVE_FLAG)?.effect;
  if (!id) return null;
  return fromUuidSync(id) ?? null;
}

/** The tokens of an actor: its own (unlinked) or every linked one on every scene. */
function actorTokens(actor) {
  if (actor.isToken) return actor.token ? [actor.token] : [];
  return game.scenes.contents.flatMap(scene => scene.tokens.filter(token => token.actorLink && token.actorId === actor.id));
}

/** The creature the form makes its user into (an NPC dropped on it), or null. */
async function formCreature(form) {
  if (!form.creature) return null;
  const creature = await fromUuid(form.creature);
  return creature?.documentName === 'Actor' ? creature : null;
}

/** The look a form gives: image, scale, size and name (from the form, else its creature). */
function formLook(effect, form, creature) {
  const proto = creature?.prototypeToken;
  return {
    img: form.img || proto?.texture?.src || '',
    scale: Number(form.scale) > 0 ? Number(form.scale) : 0,
    size: Number(form.size) > 0 ? Number(form.size) : creature ? Number(proto?.width) || 0 : 0,
    name: form.name || creature?.name || ''
  };
}

/** The items a form grants: its Grants list, else (becoming a creature) the creature's attacks and traits. */
async function grantedSources(form, creature) {
  const sources = [];
  for (const uuid of form.grants ?? []) {
    const item = await fromUuid(uuid);
    if (item?.documentName === 'Item') sources.push(item);
  }
  if (!sources.length && creature) {
    for (const item of creature.items) {
      if (item.type === ItemType.TRAIT || (item.type === ItemType.GEAR && [GearType.WEAPON, GearType.POWER].includes(item.system?.type))) sources.push(item);
    }
  }
  return sources;
}

/** The user's own items the form sets aside (unreadied while it lasts). */
function itemsToSetAside(actor, form) {
  const keeps = form.keeps || 'mind';
  if (keeps === 'everything') return [];
  return actor.items.filter(item => {
    if (item.getFlag('sdm', GRANT_FLAG) || item.type !== ItemType.GEAR || !item.system?.readied) return false;
    if (keeps === 'nothing') return true;
    const type = item.system?.type;
    if ([GearType.WEAPON, GearType.ARMOR, GearType.WARD].includes(type)) return true;
    // Mind only: powers too when the form says they can't be used
    return form.powers === 'off' && [GearType.POWER, GearType.POWER_ALBUM].includes(type);
  });
}

/* -------------------------------------------- */
/*  Starting and ending (the Referee's game)    */
/* -------------------------------------------- */

async function startForm(effect) {
  const actor = effectActor(effect);
  if (!actor) return;
  const active = actor.getFlag('sdm', ACTIVE_FLAG);
  if (active?.effect === effect.uuid) return;
  // One form at a time: the old one ends (its effect goes)
  if (active?.effect) {
    const old = fromUuidSync(active.effect);
    await endForm(actor);
    if (old && old.uuid !== effect.uuid) await removeFormEffect(old);
  }
  const form = effect.system.form;
  const creature = await formCreature(form);
  const look = formLook(effect, form, creature);

  // The look: every token, the prototype token of a linked actor, and the portrait if asked
  const saved = { tokens: {}, prototype: null, portrait: null };
  for (const token of actorTokens(actor)) {
    saved.tokens[token.uuid] = { src: token.texture.src, scaleX: token.texture.scaleX, scaleY: token.texture.scaleY, width: token.width, height: token.height, name: token.name };
    await token.update(lookUpdate(look), { sdmForm: true });
  }
  if (!actor.isToken) {
    const proto = actor.prototypeToken;
    saved.prototype = { src: proto.texture.src, scaleX: proto.texture.scaleX, scaleY: proto.texture.scaleY, width: proto.width, height: proto.height, name: proto.name };
  }
  const actorUpdate = {};
  if (!actor.isToken) Object.assign(actorUpdate, Object.fromEntries(Object.entries(lookUpdate(look)).map(([k, v]) => [`prototypeToken.${k}`, v])));
  if (form.portrait && look.img) {
    saved.portrait = actor.img;
    actorUpdate.img = look.img;
  }

  // Own gear set aside (unreadied: their effects off, out of the attack lists)
  const aside = itemsToSetAside(actor, form);
  if (aside.length) await actor.updateEmbeddedDocuments('Item', aside.map(item => ({ _id: item.id, 'system.readied': false, [`flags.sdm.${SET_ASIDE_FLAG}`]: true })));

  // Granted items: copies marked with the form (uses fresh or remembered)
  const remembered = form.uses === 'remembered' ? actor.getFlag('sdm', USES_FLAG)?.[formKey(effect)] ?? {} : {};
  const sources = await grantedSources(form, creature);
  const take = form.take ?? {};
  // The NPC's own damage: a natural attack while in the form
  const natural = creature && take.damage !== false && foundry.dice.Roll.validate(`${creature.system?.damage ?? ''}`.trim()) ? naturalAttack(creature) : null;
  if (sources.length || natural) {
    const data = sources.map(source => {
      const copy = source.toObject();
      delete copy._id;
      foundry.utils.setProperty(copy, `flags.sdm.${GRANT_FLAG}`, effect.uuid);
      if (copy.type === ItemType.GEAR) copy.system.readied = true;
      const kept = remembered[source.name];
      if (kept) {
        if (kept.charges !== undefined) foundry.utils.setProperty(copy, 'system.charges.value', kept.charges);
        for (const [key, value] of Object.entries(kept.counters ?? {})) foundry.utils.setProperty(copy, `system.counters.${key}.value`, value);
      }
      return copy;
    });
    if (natural) {
      foundry.utils.setProperty(natural, `flags.sdm.${GRANT_FLAG}`, effect.uuid);
      data.push(natural);
    }
    await actor.createEmbeddedDocuments('Item', data, { sdmKeepReadied: true });
  }
  // The NPC's numbers while in the form (read in the actor's data preparation): defense, speed, its
  // attack bonus (an NPC in the form)
  const numbers = {};
  if (creature) {
    if (take.defense !== false && Number.isFinite(Number(creature.system?.defense))) numbers.defense = Number(creature.system.defense);
    if (take.speed !== false && Number.isFinite(Number(creature.system?.speed))) numbers.speed = Number(creature.system.speed);
    if (take.bonus !== false && actor.type === ActorType.NPC && Number.isFinite(Number(creature.system?.bonus))) numbers.bonus = Number(creature.system.bonus);
  }

  // Temporary life (a formula, read on the user)
  let tempLife = 0;
  // None set: the NPC's life, when the form takes it
  const lifeFormula = `${form.tempLife ?? ''}`.trim() || (creature && take.life !== false ? `${Number(creature.system?.life?.max) || 0}` : '');
  if (lifeFormula && lifeFormula !== '0') {
    tempLife = Math.max((await rollAmount(lifeFormula, { actor })).total, 0);
    if (tempLife > 0 && actor.system?.temporary_life && 'enabled' in actor.system.temporary_life) {
      await actor.createEmbeddedDocuments('ActiveEffect', [
        {
          name: $fmt('SDM.Form.TempLifeEffect', { form: effect.name }),
          img: effect.img || 'icons/svg/regen.svg',
          origin: effect.uuid,
          transfer: false,
          system: {
            changes: [
              { key: 'system.temporary_life.enabled', type: 'override', value: true, phase: 'initial', priority: null },
              { key: 'system.temporary_life.max', type: 'add', value: tempLife, phase: 'initial', priority: null }
            ]
          },
          flags: { sdm: { [TEMP_LIFE_FLAG]: effect.uuid } }
        }
      ]);
      const temp = actor.system.temporary_life;
      actorUpdate['system.temporary_life.value'] = Math.min((Number(temp.value) || 0) + tempLife, Math.max(Number(temp.max) || 0, 0));
    }
  }

  actorUpdate[`flags.sdm.${ACTIVE_FLAG}`] = { effect: effect.uuid, name: effect.name, img: look.img || effect.img, saved, numbers, endsAtZero: !!form.endsAtZero && tempLife > 0 };
  await actor.update(actorUpdate, { sdmForm: true });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><i class="fa-solid fa-paw"></i> ${$fmt('SDM.Form.Started', { actor: esc(saved.prototype?.name || actor.name), form: esc(effect.name) })}${tempLife ? ` ${esc($fmt('SDM.Form.TempLife', { amount: tempLife }))}` : ''}</p>`
  });
}

/** The NPC's own damage as a weapon while in the form ("Wolf: 1d6"), close range. */
function naturalAttack(creature) {
  return {
    name: $fmt('SDM.Form.NaturalAttack', { creature: creature.name }),
    type: ItemType.GEAR,
    img: creature.img || 'icons/svg/claw.svg',
    system: { type: GearType.WEAPON, readied: true, weapon: { damage: { base: `${creature.system.damage}`.trim() } } }
  };
}

/** The numbers the actor's form sets (defense, speed, bonus), applied at the end of its data preparation. */
export function applyFormNumbers(actor) {
  const numbers = actor?.flags?.sdm?.[ACTIVE_FLAG]?.numbers;
  if (!numbers) return;
  const data = actor.system;
  if (Number.isFinite(numbers.defense)) data.defense = numbers.defense;
  if (Number.isFinite(numbers.speed)) data.speed = numbers.speed;
  if (Number.isFinite(numbers.bonus)) data.bonus = numbers.bonus;
}

function lookUpdate(look) {
  const update = {};
  if (look.img) update['texture.src'] = look.img;
  if (look.scale) Object.assign(update, { 'texture.scaleX': look.scale, 'texture.scaleY': look.scale });
  if (look.size) Object.assign(update, { width: look.size, height: look.size });
  if (look.name) update.name = look.name;
  return update;
}

/** A key for a form's remembered uses: its name (copies of the same form share it). */
const formKey = effect => (effect?.name || 'form').slugify?.() ?? effect?.name ?? 'form';

async function endForm(actor) {
  const active = actor?.getFlag('sdm', ACTIVE_FLAG);
  if (!active) return;
  const effect = fromUuidSync(active.effect);
  const saved = active.saved ?? {};

  // The look back
  for (const [uuid, look] of Object.entries(saved.tokens ?? {})) {
    const token = fromUuidSync(uuid);
    if (!token) continue;
    await token.update({ 'texture.src': look.src, 'texture.scaleX': look.scaleX, 'texture.scaleY': look.scaleY, width: look.width, height: look.height, name: look.name }, { sdmForm: true });
  }
  const update = { [`flags.sdm.-=${ACTIVE_FLAG}`]: null };
  if (saved.prototype) {
    const p = saved.prototype;
    Object.assign(update, { 'prototypeToken.texture.src': p.src, 'prototypeToken.texture.scaleX': p.scaleX, 'prototypeToken.texture.scaleY': p.scaleY, 'prototypeToken.width': p.width, 'prototypeToken.height': p.height, 'prototypeToken.name': p.name });
  }
  if (saved.portrait) update.img = saved.portrait;

  // Granted items go (their uses remembered when the form says so)
  const granted = actor.items.filter(item => item.getFlag('sdm', GRANT_FLAG) === active.effect);
  if (granted.length) {
    if (effect?.system?.form?.uses === 'remembered') {
      const uses = {};
      for (const item of granted) {
        uses[item.name] = {
          charges: item.system?.charges?.value,
          counters: Object.fromEntries(Object.entries(item.system?.counters ?? {}).map(([key, counter]) => [key, counter.value]))
        };
      }
      update[`flags.sdm.${USES_FLAG}.${formKey(effect)}`] = uses;
    }
    await actor.deleteEmbeddedDocuments('Item', granted.map(item => item.id));
  }
  // Set-aside gear readied again
  const aside = actor.items.filter(item => item.getFlag('sdm', SET_ASIDE_FLAG));
  if (aside.length) await actor.updateEmbeddedDocuments('Item', aside.map(item => ({ _id: item.id, 'system.readied': true, [`flags.sdm.-=${SET_ASIDE_FLAG}`]: null })));
  // Its temporary life goes (what is left of it is capped by the lower maximum)
  const lifeEffects = actor.effects.filter(e => e.getFlag('sdm', TEMP_LIFE_FLAG) === active.effect).map(e => e.id);
  if (lifeEffects.length) await actor.deleteEmbeddedDocuments('ActiveEffect', lifeEffects);
  await actor.update(update, { sdmForm: true });
  const temp = actor.system?.temporary_life;
  if (temp && (Number(temp.value) || 0) > (Number(temp.max) || 0)) await actor.update({ 'system.temporary_life.value': Math.max(Number(temp.max) || 0, 0) });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><i class="fa-solid fa-paw"></i> ${$fmt('SDM.Form.Ended', { actor: esc(actor.name), form: esc(active.name ?? '') })}</p>`
  });
}

/** The form's effect goes (an actor's own is deleted; one from an item is switched off). */
async function removeFormEffect(effect) {
  if (!effect) return;
  try {
    if (effect.parent?.documentName === 'Actor') await effect.delete();
    else await effect.update({ disabled: true });
  } catch (error) {
    console.warn('SDM | Could not remove the form effect', error);
  }
}

/** End the actor's form (its End form button): the form's effect goes, and with it the form. */
export async function dismissForm(actor) {
  const effect = currentForm(actor);
  if (!game.user.isGM && !actor?.isOwner) return;
  if (effect) {
    if (game.user.isGM || effect.isOwner) return removeFormEffect(effect);
  }
  if (game.user.isGM) return endForm(actor);
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

async function onEffectChanged(effect) {
  if (!isActiveGM() || !isForm(effect)) return;
  const actor = effectActor(effect);
  if (!actor) return;
  const current = actor.getFlag('sdm', ACTIVE_FLAG)?.effect;
  try {
    if (formIsOn(effect)) await startForm(effect);
    else if (current === effect.uuid) await endForm(actor);
  } catch (error) {
    console.error('SDM | Form failed', error);
  }
}

async function onEffectDeleted(effect) {
  if (!isActiveGM()) return;
  const parent = effect.parent;
  const actor = parent?.documentName === 'Actor' ? parent : parent?.actor;
  if (actor && actor.getFlag('sdm', ACTIVE_FLAG)?.effect === effect.uuid) await endForm(actor);
}

/** Its temporary life ran out: a form that ends then ends. */
async function onUpdateActor(actor, changes) {
  if (!isActiveGM() || foundry.utils.getProperty(changes, 'system.temporary_life.value') === undefined) return;
  const active = actor.getFlag('sdm', ACTIVE_FLAG);
  if (!active?.endsAtZero || (Number(actor.system.temporary_life?.value) || 0) > 0) return;
  const effect = fromUuidSync(active.effect);
  if (effect) await removeFormEffect(effect);
  else await endForm(actor);
}

/** The sheet: a banner with the form (and End form); granted items marked, set-aside items faded. */
function onRenderActorSheet(app, html) {
  const actor = app.document ?? app.actor;
  const active = actor?.getFlag?.('sdm', ACTIVE_FLAG);
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  root.querySelector('.sdm-form-banner')?.remove();
  if (active) {
    const content = root.querySelector('.window-content') ?? root;
    const temp = actor.system?.temporary_life;
    const banner = document.createElement('div');
    banner.className = 'sdm-form-banner';
    banner.innerHTML =
      `${active.img ? `<img src="${esc(active.img)}" alt="" />` : '<i class="fa-solid fa-paw"></i>'}` +
      `<span class="sdm-form-name">${esc($fmt('SDM.Form.Banner', { form: active.name ?? '' }))}</span>` +
      (temp?.enabled ? `<span class="sdm-form-life" data-tooltip="${esc($l10n('SDM.TemporaryLife'))}"><i class="fa-solid fa-heart"></i> ${Number(temp.value) || 0}</span>` : '') +
      (actor.isOwner ? `<button type="button" class="sdm-form-end"><i class="fa-solid fa-person-walking-arrow-loop-left" inert></i> ${esc($l10n('SDM.Form.End'))}</button>` : '');
    banner.querySelector('.sdm-form-end')?.addEventListener('click', event => {
      event.preventDefault();
      dismissForm(actor);
    });
    content.prepend(banner);
  }
  for (const row of root.querySelectorAll('[data-item-id]')) {
    const item = actor?.items?.get(row.dataset.itemId);
    if (!item) continue;
    if (item.getFlag('sdm', GRANT_FLAG)) row.classList.add('sdm-form-granted');
    // The item whose form its bearer is in: a paw by its name
    if (active && fromUuidSync(active.effect)?.parent === item && !row.querySelector('.sdm-form-source')) {
      const mark = document.createElement('i');
      mark.className = 'fa-solid fa-paw sdm-form-source';
      mark.dataset.tooltip = $fmt('SDM.Form.Banner', { form: active.name ?? '' });
      (row.querySelector('.item-name') ?? row).append(mark);
    }
    if (item.getFlag('sdm', SET_ASIDE_FLAG)) row.classList.add('sdm-form-set-aside');
  }
}

export function setupForms() {
  Hooks.on('createActiveEffect', onEffectChanged);
  Hooks.on('updateActiveEffect', (effect, changes) => {
    if ('disabled' in changes || foundry.utils.hasProperty(changes, 'system.form.enabled')) onEffectChanged(effect);
  });
  Hooks.on('deleteActiveEffect', onEffectDeleted);
  Hooks.on('updateActor', onUpdateActor);
  Hooks.on('renderActorSheetV2', onRenderActorSheet);
}

/* -------------------------------------------- */
/*  Forms an item carries (a trait, a hide)     */
/* -------------------------------------------- */

/** The forms an item gives its bearer (its form effects applied to the bearer, switched off until taken). */
export function itemForms(item) {
  if (!item?.actor) return [];
  return (item.effects?.contents ?? []).filter(effect => isForm(effect) && effect.transfer);
}

/** The bearer is in one of this item's forms now. */
export function itemFormOn(item) {
  const current = currentForm(item?.actor);
  return !!current && current.parent === item;
}

/** Take one of the item's forms (picked when it has several): its effect is switched on. */
export async function takeItemForm(item) {
  const forms = itemForms(item).filter(effect => effect.disabled || currentForm(item.actor) !== effect);
  if (!forms.length) return;
  let effect = forms[0];
  if (forms.length > 1) {
    const options = forms.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');
    const id = await foundry.applications.api.DialogV2.prompt({
      window: { title: item.name, icon: 'fa-solid fa-paw' },
      content: `<div class="form-group"><label>${esc($l10n('SDM.Form.Title'))}</label><select name="form">${options}</select></div>`,
      ok: { label: 'SDM.Form.Take', icon: 'fa-solid fa-paw', callback: (event, button) => button.form.elements.form.value },
      rejectClose: false
    });
    if (!id) return;
    effect = forms.find(f => f.id === id) ?? effect;
  }
  if (!game.users.activeGM) return ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
  await effect.update({ disabled: false });
}

/** Granted copies take no slots (itemUtils). */
export function isFormGranted(item) {
  return !!item?.getFlag?.('sdm', GRANT_FLAG);
}

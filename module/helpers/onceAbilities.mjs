import { ActorType, GearType, ItemType } from './constants.mjs';
import { featureEnabled } from './features.mjs';
import { $fmt, $l10n } from './globalUtils.mjs';

/**
 * Once-per-session abilities (H6). Counters can reset when the Referee starts a new session, and
 * some can be recharged with a hero die. Items with a once ability (`system.once_ability`) keep
 * its use in one of their counters (used up at its maximum):
 * - Second Chance: falling to 0 life, you fall to 1 instead.
 * - Fake Out: falling to 0 life, spend a hero die and the blow didn't connect (asked to its owner).
 * - Recast: cast a power again for free, from its chat card.
 */

const FAKE_OUT_QUERY = 'sdm.fakeOut';
const esc = text => foundry.utils.escapeHTML(String(text ?? ''));

/** The counter that keeps a once ability's use: one with a maximum ("used" first). */
function useCounter(item) {
  const entries = Object.entries(item?.system?.counters ?? {}).filter(([, c]) => Number.isFinite(c.max) && c.max !== null && c.max > 0);
  return entries.find(([key]) => key === 'used') ?? entries[0] ?? null;
}

/** The item's once ability can be used now (its counter is below its maximum; none: always). */
function available(item) {
  const entry = useCounter(item);
  if (!entry) return true;
  return (Number(entry[1].value) || 0) < entry[1].max;
}

async function markUsed(item) {
  const entry = useCounter(item);
  if (!entry) return;
  const [key, counter] = entry;
  await item.update({ [`system.counters.${key}.value`]: Math.min((Number(counter.value) || 0) + 1, counter.max) });
}

/** Items of the actor with that once ability: traits, burdens, and readied gear. */
function onceItems(actor, ability) {
  return (actor?.items ?? []).filter(
    item => item.system?.once_ability === ability && (item.type !== ItemType.GEAR || item.system.readied)
  );
}

function chat(actor, text) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p><i class="fa-solid fa-star"></i> ${text}</p>` });
}

/* -------------------------------------------- */
/*  Falling to 0 life                           */
/* -------------------------------------------- */

/**
 * A character is about to fall to 0 life (actor.applyDamage, on the client applying it). Fake Out
 * first (its owner chooses to spend a hero die: nothing happens), then Second Chance (1 life).
 * @returns {Promise<{ignore?: boolean, life?: number}|null>}
 */
export async function zeroLifeRescue(actor) {
  if (actor?.type !== ActorType.CHARACTER) return null;
  const fakeOut = onceItems(actor, 'fakeOut').find(available);
  if (fakeOut && (Number(actor.system.hero_dice?.value) || 0) > 0 && (await askFakeOut(actor, fakeOut))) {
    await actor.updateHeroDice(1);
    await markUsed(fakeOut);
    await chat(actor, $fmt('SDM.Once.FakeOutChat', { actor: esc(actor.name), item: esc(fakeOut.name) }));
    return { ignore: true };
  }
  const second = onceItems(actor, 'secondChance').find(available);
  if (second) {
    await markUsed(second);
    await chat(actor, $fmt('SDM.Once.SecondChanceChat', { actor: esc(actor.name), item: esc(second.name) }));
    return { life: 1 };
  }
  return null;
}

/** Ask the character's player (or, without one connected, this user) whether to use Fake Out. */
async function askFakeOut(actor, item) {
  const player = game.users.find(user => user.active && !user.isGM && user.character?.id === actor.id) ??
    game.users.find(user => user.active && !user.isGM && actor.testUserPermission(user, 'OWNER'));
  if (player && player.id !== game.user.id) {
    try {
      return !!(await player.query(FAKE_OUT_QUERY, { actorUuid: actor.uuid, itemUuid: item.uuid }, { timeout: 60 * 1000 }));
    } catch {
      return false;
    }
  }
  return confirmFakeOut(actor, item);
}

function confirmFakeOut(actor, item) {
  return foundry.applications.api.DialogV2.confirm({
    window: { title: item.name, icon: 'fa-solid fa-star' },
    content: `<p>${$fmt('SDM.Once.FakeOutAsk', { actor: esc(actor.name), item: esc(item.name) })}</p>`,
    rejectClose: false
  });
}

async function onFakeOutQuery({ actorUuid, itemUuid }) {
  const actor = await fromUuid(actorUuid);
  const item = await fromUuid(itemUuid);
  if (!actor || !item) return false;
  return !!(await confirmFakeOut(actor, item));
}

/* -------------------------------------------- */
/*  Recast                                      */
/* -------------------------------------------- */

/** A power's chat card: a Recast button for its caster's owner while Recast is available. */
function onRenderChatMessage(message, html) {
  const power = message.getFlag?.('sdm', 'power');
  if (!power || html.querySelector('.sdm-recast')) return;
  const actor = ChatMessage.getSpeakerActor(message.speaker);
  if (!actor?.isOwner) return;
  const recast = onceItems(actor, 'recast').find(available);
  if (!recast) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sdm-recast';
  button.dataset.tooltip = $l10n('SDM.Once.RecastHint');
  button.innerHTML = `<i class="fa-solid fa-rotate-right"></i> ${esc($fmt('SDM.Once.RecastButton', { item: recast.name }))}`;
  button.addEventListener('click', async event => {
    event.preventDefault();
    if (!available(recast)) return;
    const cast = await recastPower(actor, power);
    if (cast === false) return;
    await markUsed(recast);
    await chat(actor, $fmt('SDM.Once.RecastChat', { actor: esc(actor.name), item: esc(recast.name), power: esc(power.name) }));
  });
  const where = html.querySelector('.sdm-card .sdm-card-foot') ?? html.querySelector('.message-content');
  where?.append(button);
}

/** Cast the card's power again, free: the power item of that name, or the album holding it. */
async function recastPower(actor, power) {
  const name = `${power.name ?? ''}`.trim().toLowerCase();
  const powerItem = actor.items.find(item => item.system?.type === GearType.POWER && item.name.trim().toLowerCase() === name);
  const album = powerItem
    ? null
    : actor.items.find(item => (item.system?.powers ?? []).some(p => `${p?.name ?? ''}`.trim().toLowerCase() === name));
  const target = powerItem ?? album;
  if (!target) {
    ui.notifications.warn($fmt('SDM.Once.RecastMissing', { power: power.name }));
    return false;
  }
  const { castPowerFree } = await import('../rolls/triggers.mjs');
  await castPowerFree(target, actor, album ? power.name : '');
  return true;
}

/* -------------------------------------------- */
/*  New session, recharge with a hero die       */
/* -------------------------------------------- */

/** The Referee starts a new session: every counter that resets each session goes back. */
export async function newSession() {
  if (!game.user.isGM) return;
  const { resetCounters } = await import('./counters.mjs');
  const has = doc => Object.values(doc.system?.counters ?? {}).some(counter => counter.reset_each === 'session');
  const actors = new Set(game.actors);
  for (const scene of game.scenes) for (const token of scene.tokens) if (!token.actorLink && token.actor) actors.add(token.actor);
  let count = 0;
  for (const actor of actors) {
    if (has(actor)) count += await resetCounters(actor, { each: 'session' });
    for (const item of actor.items) if (has(item)) count += await resetCounters(item, { each: 'session' });
  }
  for (const item of game.items) if (has(item)) count += await resetCounters(item, { each: 'session' });
  ui.notifications.info($fmt('SDM.Once.NewSessionDone', { count }));
}

/** Counters of the item that a hero die can recharge, used (not at their reset value). */
export function heroDieCounters(item) {
  return Object.entries(item?.system?.counters ?? {}).filter(
    ([, counter]) => counter.hero_die && (Number(counter.value) || 0) !== (Number(counter.reset_value) || 0)
  );
}

/** Spend a hero die of the item's owner: its hero-die counters go back to their reset value. */
export async function rechargeWithHeroDie(item) {
  const actor = item?.actor;
  if (!actor?.isOwner) return;
  if ((Number(actor.system.hero_dice?.value) || 0) < 1) {
    ui.notifications.warn($fmt('SDM.ErrorActorNoHeroDice', { actor: actor.name }));
    return;
  }
  const entries = heroDieCounters(item);
  if (!entries.length) return;
  await actor.updateHeroDice(1);
  await item.update(Object.fromEntries(entries.map(([key, counter]) => [`system.counters.${key}.value`, counter.reset_value ?? 0])));
  await chat(actor, $fmt('SDM.Once.RechargedChat', { actor: esc(actor.name), item: esc(item.name) }));
}

export function setupOnceAbilities() {
  CONFIG.queries[FAKE_OUT_QUERY] = onFakeOutQuery;
  Hooks.on('renderChatMessageHTML', onRenderChatMessage);
  // Referee: New session button in the Actors sidebar
  Hooks.on('renderActorDirectory', (app, html) => {
    if (!game.user.isGM || !featureEnabled('counters')) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    const header = root?.querySelector('.directory-header');
    if (!header || header.querySelector('.sdm-new-session')) return;
    header.insertAdjacentHTML(
      'beforeend',
      `<button type="button" class="sdm-new-session" data-tooltip="${esc($l10n('SDM.Once.NewSessionHint'))}"><i class="fa-solid fa-flag-checkered" inert></i> ${esc($l10n('SDM.Once.NewSession'))}</button>`
    );
    header.querySelector('.sdm-new-session').addEventListener('click', async () => {
      const ok = await foundry.applications.api.DialogV2.confirm({
        window: { title: $l10n('SDM.Once.NewSession') },
        content: `<p>${esc($l10n('SDM.Once.NewSessionConfirm'))}</p>`,
        rejectClose: false
      });
      if (ok) await newSession();
    });
  });
}


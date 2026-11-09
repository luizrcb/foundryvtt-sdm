import { getXpToNextLevel } from '../helpers/actorUtils.mjs';
import { ActorType } from '../helpers/constants.mjs';
import { $fmt, $l10n } from '../helpers/globalUtils.mjs';

/**
 * Investing player XP: a character's owner spends their Player XP on
 * - the character itself,
 * - one of its hallmark items,
 * - one of their pets (NPC linked by a pet item, or an NPC they own),
 * - or donates it to another player's Player XP pool.
 * Changes to documents the user does not own are applied by the active Referee.
 */

const CHANNEL = 'system.sdm';
const REQUEST_ACTION = 'investXpRequest';
const RESULT_ACTION = 'investXpResult';
const REQUEST_TIMEOUT = 15000;

const { DialogV2 } = foundry.applications.api;
const pendingRequests = new Map();

const toInt = value => parseInt(value, 10) || 0;

export function setupInvestXp() {
  game.socket.on(CHANNEL, onSocketMessage);
}

/* -------------------------------------------- */
/*  Targets                                     */
/* -------------------------------------------- */

/** Non-Referee users who own the character (its players). */
function playerOwners(actor) {
  return game.users.filter(user => !user.isGM && actor.testUserPermission(user, 'OWNER'));
}

/** Pets of a character: NPCs linked by its pet items, plus NPCs its players own. */
function getPets(actor) {
  const pets = new Map();
  for (const item of actor.items) {
    const uuid = item.system?.pet;
    if (!uuid) continue;
    const npc = fromUuidSync(uuid);
    if (npc?.documentName === 'Actor' && npc.type === ActorType.NPC) pets.set(npc.uuid, npc);
  }
  const owners = playerOwners(actor);
  if (owners.length) {
    for (const npc of game.actors) {
      if (npc.type !== ActorType.NPC) continue;
      if (owners.some(user => npc.testUserPermission(user, 'OWNER'))) pets.set(npc.uuid, npc);
    }
  }
  return [...pets.values()];
}

/** Other players' characters that can receive a donation. */
function getDonationTargets(actor) {
  return game.actors.filter(
    other => other.type === ActorType.CHARACTER && other.id !== actor.id && playerOwners(other).length
  );
}

function buildTargets(actor) {
  return {
    self: actor,
    hallmarks: actor.items.filter(item => item.system?.is_hallmark),
    pets: getPets(actor),
    donations: getDonationTargets(actor)
  };
}

/* -------------------------------------------- */
/*  Dialog                                      */
/* -------------------------------------------- */

export async function openInvestXpDialog(actor) {
  if (!actor || actor.type !== ActorType.CHARACTER || !actor.isOwner) return;

  const available = toInt(actor.system.player_experience);
  if (available <= 0) {
    ui.notifications.warn($l10n('SDM.InvestXP.NothingToInvest'));
    return;
  }

  const targets = buildTargets(actor);
  const esc = foundry.utils.escapeHTML ?? (s => s);
  // "Level 2, 450 XP to level up" (just the level once the maximum is reached)
  const status = (level, xp) => {
    const toNext = getXpToNextLevel(toInt(xp));
    const levelText = `${$l10n('SDM.FieldLevel')} ${level ?? 0}`;
    return toNext > 0 ? `${levelText}, ${toNext} ${$l10n('SDM.XPToLevelUP')}` : levelText;
  };
  const option = (value, label, selected = false) =>
    `<option value="${value}"${selected ? ' selected' : ''}>${esc(label)}</option>`;

  const groups = [
    `<optgroup label="${esc($l10n('SDM.InvestXP.GroupCharacter'))}">${option(
      `self:${actor.uuid}`,
      `${actor.name} (${status(actor.system.level, actor.system.experience)})`,
      true
    )}</optgroup>`
  ];
  if (targets.hallmarks.length) {
    groups.push(
      `<optgroup label="${esc($l10n('SDM.InvestXP.GroupHallmarks'))}">${targets.hallmarks
        .map(item =>
          option(
            `hallmark:${item.uuid}`,
            `${item.name} (${status(item.system.hallmark?.level, item.system.hallmark?.experience)})`
          )
        )
        .join('')}</optgroup>`
    );
  }
  if (targets.pets.length) {
    groups.push(
      `<optgroup label="${esc($l10n('SDM.InvestXP.GroupPets'))}">${targets.pets
        .map(npc =>
          option(`pet:${npc.uuid}`, `${npc.name} (${status(npc.system.level, npc.system.experience)})`)
        )
        .join('')}</optgroup>`
    );
  }
  if (targets.donations.length) {
    groups.push(
      `<optgroup label="${esc($l10n('SDM.InvestXP.GroupDonate'))}">${targets.donations
        .map(other => option(`donate:${other.uuid}`, other.name))
        .join('')}</optgroup>`
    );
  }

  const content = `
    <p>${$fmt('SDM.InvestXP.Available', { xp: available })}</p>
    <div class="form-group">
      <label>${$l10n('SDM.InvestXP.Target')}</label>
      <div class="form-fields"><select name="target">${groups.join('')}</select></div>
    </div>
    <div class="form-group">
      <label>${$l10n('SDM.InvestXP.Amount')}</label>
      <div class="form-fields"><input type="number" name="amount" min="1" max="${available}" step="1" value="${available}" /></div>
    </div>`;

  const data = await DialogV2.prompt({
    window: { title: $l10n('SDM.InvestXP.Title'), icon: 'fa-solid fa-circle-up' },
    position: { width: 520 },
    content,
    modal: true,
    rejectClose: false,
    ok: {
      label: $l10n('SDM.InvestXP.Confirm'),
      icon: 'fa-solid fa-check',
      callback: (event, button) => ({
        target: button.form.elements.target.value,
        amount: toInt(button.form.elements.amount.value)
      })
    }
  });
  if (!data) return;

  return investXp({ sourceUuid: actor.uuid, target: data.target, amount: data.amount });
}

/* -------------------------------------------- */
/*  Apply                                       */
/* -------------------------------------------- */

/** Validate and apply, here or through the active Referee when needed. */
export async function investXp({ sourceUuid, target, amount }) {
  const [kind, targetUuid] = `${target}`.split(/:(.*)/s);
  const source = fromUuidSync(sourceUuid);
  const targetDoc = fromUuidSync(targetUuid);
  if (!source || !targetDoc) return;

  const error = validate(game.user, source, kind, targetDoc, amount);
  if (error) {
    ui.notifications.error($fmt(error.key, error.data));
    return;
  }

  if (targetDoc.isOwner) return applyInvestment(source, kind, targetDoc, amount, game.user);

  const activeGM = game.users.activeGM;
  if (!activeGM) {
    ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
    return;
  }

  const requestId = foundry.utils.randomID();
  const outcome = await new Promise(resolve => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      resolve({ success: false });
    }, REQUEST_TIMEOUT);
    pendingRequests.set(requestId, { resolve, timeout });
    game.socket.emit(CHANNEL, {
      action: REQUEST_ACTION,
      requestId,
      userId: game.user.id,
      payload: { sourceUuid, kind, targetUuid, amount }
    });
  });
  if (!outcome?.success) ui.notifications.error($l10n('SDM.InvestXP.Failed'));
}

function validate(user, source, kind, targetDoc, amount) {
  if (source.type !== ActorType.CHARACTER || !source.testUserPermission(user, 'OWNER')) {
    return { key: 'SDM.InvestXP.Failed' };
  }
  const available = toInt(source.system.player_experience);
  if (amount < 1 || amount > available) {
    return { key: 'SDM.InvestXP.InvalidAmount', data: { max: available } };
  }

  const targets = buildTargets(source);
  const allowed =
    (kind === 'self' && targetDoc === source) ||
    (kind === 'hallmark' && targets.hallmarks.includes(targetDoc)) ||
    (kind === 'pet' && targets.pets.includes(targetDoc)) ||
    (kind === 'donate' && targets.donations.includes(targetDoc));
  return allowed ? null : { key: 'SDM.InvestXP.Failed' };
}

async function applyInvestment(source, kind, targetDoc, amount, user) {
  const pool = toInt(source.system.player_experience);
  await source.update({ 'system.player_experience': `${pool - amount}` }, { sdmInvestXp: true });

  if (kind === 'self' || kind === 'pet') {
    await targetDoc.update(
      { 'system.experience': `${toInt(targetDoc.system.experience) + amount}` },
      { sdmInvestXp: true }
    );
  } else if (kind === 'hallmark') {
    await targetDoc.update(
      { 'system.hallmark.experience': `${toInt(targetDoc.system.hallmark?.experience) + amount}` },
      { sdmInvestXp: true }
    );
  } else if (kind === 'donate') {
    await targetDoc.update(
      { 'system.player_experience': `${toInt(targetDoc.system.player_experience) + amount}` },
      { sdmInvestXp: true }
    );
  }

  const key = kind === 'donate' ? 'SDM.InvestXP.ChatDonate' : 'SDM.InvestXP.ChatInvest';
  await ChatMessage.create({
    author: user.id,
    speaker: ChatMessage.getSpeaker({ actor: source }),
    content: `<p><i class="fa-solid fa-circle-up"></i> ${$fmt(key, {
      actor: source.name,
      xp: amount,
      target: targetDoc.name
    })}</p>`
  });
  return true;
}

/* -------------------------------------------- */
/*  Socket                                      */
/* -------------------------------------------- */

function onSocketMessage(message) {
  if (!message || typeof message !== 'object') return;

  if (message.action === REQUEST_ACTION) {
    handleRequest(message);
    return;
  }
  if (message.action !== RESULT_ACTION || message.userId !== game.user.id) return;

  const pending = pendingRequests.get(message.requestId);
  if (!pending) return;
  pendingRequests.delete(message.requestId);
  clearTimeout(pending.timeout);
  pending.resolve(message.payload);
}

async function handleRequest({ requestId, userId, payload }) {
  const activeGM = game.users.activeGM;
  if (!game.user.isGM || (activeGM && activeGM.id !== game.user.id)) return;

  const respond = response =>
    game.socket.emit(CHANNEL, { action: RESULT_ACTION, requestId, userId, payload: response });

  try {
    const user = game.users.get(userId);
    const { sourceUuid, kind, targetUuid, amount } = payload ?? {};
    const source = fromUuidSync(sourceUuid);
    const targetDoc = fromUuidSync(targetUuid);
    if (!user || !source || !targetDoc || validate(user, source, kind, targetDoc, toInt(amount))) {
      respond({ success: false });
      return;
    }
    await applyInvestment(source, kind, targetDoc, toInt(amount), user);
    respond({ success: true });
  } catch (error) {
    console.error('SDM | Invest XP request failed', error);
    respond({ success: false });
  }
}

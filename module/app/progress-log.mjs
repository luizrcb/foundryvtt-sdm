import { $fmt, $l10n } from '../helpers/globalUtils.mjs';
import { addCashToActor } from '../macros/gm/giveCash.mjs';

/**
 * History of a character's progression: XP investments and level-up upgrades (its own and its
 * hallmarks'). The player sees it; the Referee can undo the latest entry, which gives back the
 * XP, money or pending upgrade it used.
 */

const FLAG = 'progressLog';
const MAX_ENTRIES = 100;
const HALLMARK_EFFECT_FLAG = 'hallmarkUpgrades';
const { DialogV2 } = foundry.applications.api;
const toInt = value => parseInt(value, 10) || 0;
const esc = text => foundry.utils.escapeHTML?.(String(text ?? '')) ?? String(text ?? '');

export function getProgressLog(actor) {
  return foundry.utils.deepClone(actor.getFlag('sdm', FLAG) ?? []);
}

/** Add an entry (with its text and what undoing it needs). */
export async function logProgress(actor, entry) {
  if (!actor) return;
  const log = getProgressLog(actor);
  log.push({ id: foundry.utils.randomID(), time: Date.now(), ...entry });
  await actor.setFlag('sdm', FLAG, log.slice(-MAX_ENTRIES));
}

export async function openProgressLog(actor) {
  const log = getProgressLog(actor).reverse();
  const rows = log.length
    ? log
        .map(
          (entry, index) => `<li class="${index === 0 ? 'is-latest' : ''}">
            <span class="sdm-log-time">${new Date(entry.time).toLocaleString(game.i18n.lang)}</span>
            <span class="sdm-log-text">${esc(entry.text)}</span>
          </li>`
        )
        .join('')
    : `<li class="hint">${$l10n('SDM.ProgressLog.Empty')}</li>`;

  const content = `<ol class="sdm-progress-log">${rows}</ol>
    ${game.user.isGM && log.length ? `<p class="hint">${$l10n('SDM.ProgressLog.UndoHint')}</p>` : ''}`;

  const buttons = [{ action: 'close', label: $l10n('Close'), icon: 'fa-solid fa-xmark', default: true }];
  if (game.user.isGM && log.length) {
    buttons.unshift({ action: 'undo', label: $l10n('SDM.ProgressLog.UndoLast'), icon: 'fa-solid fa-rotate-left' });
  }

  const choice = await DialogV2.wait({
    window: { title: $fmt('SDM.ProgressLog.Title', { name: actor.name }), icon: 'fa-solid fa-clock-rotate-left' },
    position: { width: 520 },
    content,
    buttons,
    rejectClose: false
  });
  if (choice === 'undo') await undoLastProgress(actor);
}

/** Referee: undo the latest entry. */
export async function undoLastProgress(actor) {
  if (!game.user.isGM) return;
  const log = getProgressLog(actor);
  const entry = log.pop();
  if (!entry) return;

  const done = await undoEntry(actor, entry);
  if (!done) {
    ui.notifications.warn($l10n('SDM.ProgressLog.UndoFailed'));
    return;
  }
  await actor.setFlag('sdm', FLAG, log);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><i class="fa-solid fa-rotate-left"></i> ${$fmt('SDM.ProgressLog.Undone', { text: entry.text })}</p>`
  });
}

async function undoEntry(actor, entry) {
  const opts = { sdmInvestXp: true };

  if (entry.type === 'invest') {
    const target = await fromUuid(entry.targetUuid);
    if (!target) return false;
    const amount = toInt(entry.amount);
    await actor.update({ 'system.player_experience': `${toInt(actor.system.player_experience) + amount}` }, opts);
    if (entry.kind === 'hallmark') {
      const xp = Math.max(toInt(target.system.hallmark?.experience) - amount, 0);
      await target.update({ 'system.hallmark.experience': `${xp}` }, opts);
    } else if (entry.kind === 'donate') {
      const xp = Math.max(toInt(target.system.player_experience) - amount, 0);
      await target.update({ 'system.player_experience': `${xp}` }, opts);
    } else {
      const xp = Math.max(toInt(target.system.experience) - amount, 0);
      await target.update({ 'system.experience': `${xp}` }, opts);
    }
    return true;
  }

  if (entry.type === 'upgrade') {
    if (entry.choice === 'newTrait') {
      const ids = (entry.createdIds ?? []).filter(id => actor.items.has(id));
      if (ids.length) await actor.deleteEmbeddedDocuments('Item', ids);
    } else if (entry.choice === 'improve') {
      const item = actor.items.get(entry.itemId);
      if (item) await item.update({ 'system.type': entry.prevType ?? '', 'system.skill.rank': entry.prevRank ?? 0 });
    } else if (entry.choice === 'ability') {
      const ability = actor.system.abilities[entry.ability];
      if (ability) {
        await actor.update({
          [`system.abilities.${entry.ability}.base`]: Math.max(ability.base - 1, 0),
          [`system.abilities.${entry.ability}.current`]: Math.max(ability.current - 1, 0)
        });
      }
    }
    await actor.update({ 'system.pending_upgrades': (actor.system.pending_upgrades ?? 0) + 1 });
    return true;
  }

  if (entry.type === 'hallmark') {
    const item = actor.items.get(entry.itemId);
    if (!item) return false;
    if (entry.changes) {
      const effect = item.effects.find(e => e.getFlag('sdm', HALLMARK_EFFECT_FLAG));
      if (effect) {
        const changes = [...(effect.system.changes ?? [])].slice(0, -entry.changes);
        if (changes.length) await effect.update({ 'system.changes': changes });
        else await effect.delete();
      }
    }
    if (entry.note) {
      const notes = [...(item.system.hallmark.upgrade_notes ?? [])];
      const index = notes.lastIndexOf(entry.note);
      if (index >= 0) notes.splice(index, 1);
      await item.update({ 'system.hallmark.upgrade_notes': notes });
    }
    if (entry.effectId && item.effects.has(entry.effectId)) {
      await item.deleteEmbeddedDocuments('ActiveEffect', [entry.effectId]);
    }
    if (entry.cost) await addCashToActor(actor, entry.cost);
    await item.update({ 'system.hallmark.pending_upgrades': (item.system.hallmark.pending_upgrades ?? 0) + 1 });
    return true;
  }

  return false;
}

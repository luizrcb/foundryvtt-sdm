import { $fmt, $l10n } from '../helpers/globalUtils.mjs';
import { addCashToActor } from '../macros/gm/giveCash.mjs';
import { returnDonation } from './invest-xp.mjs';

/**
 * History of a character's progression: XP investments and level-up upgrades (its own and its
 * hallmarks'). The player sees it; entries are grouped by what they changed (the character, each
 * hallmark, each pet, donations) and each group is undone on its own, latest first, by the Referee:
 * the XP, money or pending upgrade used comes back. Pets go back to the stats they had before.
 * Donations received are given back by the receiver.
 */

const FLAG = 'progressLog';
const MAX_ENTRIES = 100;
const HALLMARK_EFFECT_FLAG = 'hallmarkUpgrades';
const { DialogV2 } = foundry.applications.api;
const toInt = value => parseInt(value, 10) || 0;
const esc = text => foundry.utils.escapeHTML?.(String(text ?? '')) ?? String(text ?? '');

/** Groups that are only a record (donations are given back by whoever received them). */
const DONATED = 'donated';
const RECEIVED = 'received';

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

/** Remove the entries that match. */
export async function removeProgressEntries(actor, predicate) {
  if (!actor) return;
  const log = getProgressLog(actor);
  const kept = log.filter(entry => !predicate(entry));
  if (kept.length !== log.length) await actor.setFlag('sdm', FLAG, kept);
}

/** The NPC stats kept to undo an investment in a pet (texts left out). */
export function npcSnapshot(npc) {
  const system = npc.toObject().system;
  delete system.biography;
  delete system.notes;
  return system;
}

/** What an entry changed: 'self', 'hallmark:<itemId>', 'pet:<uuid>', 'donated' or 'received'. */
export function subjectOf(entry) {
  if (entry.type === 'received') return RECEIVED;
  if (entry.type === 'hallmark') return `hallmark:${entry.itemId}`;
  if (entry.type === 'invest') {
    if (entry.kind === 'donate') return DONATED;
    if (entry.kind === 'pet') return `pet:${entry.targetUuid}`;
    if (entry.kind === 'hallmark') return `hallmark:${`${entry.targetUuid}`.split('.').pop()}`;
  }
  return 'self';
}

function subjectLabel(actor, subject, entries) {
  if (subject === 'self') return actor.name;
  if (subject === DONATED) return $l10n('SDM.ProgressLog.GroupDonated');
  if (subject === RECEIVED) return $l10n('SDM.ProgressLog.GroupReceived');
  const [kind, ref] = subject.split(/:(.*)/s);
  if (kind === 'hallmark') return actor.items.get(ref)?.name ?? entries[0]?.targetName ?? ref;
  return fromUuidSync(ref)?.name ?? entries[0]?.targetName ?? ref;
}

/**
 * @param {Actor} actor
 * @param {object} [options]
 * @param {string} [options.subject]  Show only this group (e.g. a hallmark's).
 */
export async function openProgressLog(actor, { subject } = {}) {
  const groups = new Map();
  for (const entry of getProgressLog(actor)) {
    const key = subjectOf(entry);
    if (subject && key !== subject) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  // Character first, then the rest by their latest entry
  const ordered = [...groups.entries()].sort(([a, ea], [b, eb]) => {
    if (a === 'self' || b === 'self') return a === 'self' ? -1 : 1;
    return eb.at(-1).time - ea.at(-1).time;
  });

  const isGM = game.user.isGM;
  const row = (entry, latest, extra = '') => `<li class="${latest ? 'is-latest' : ''}">
      <span class="sdm-log-time">${new Date(entry.time).toLocaleString(game.i18n.lang)}</span>
      <span class="sdm-log-text">${esc(entry.text)}</span>${extra}
    </li>`;

  const sections = ordered.map(([key, entries]) => {
    const latestFirst = [...entries].reverse();
    let undo = '';
    let rows;
    if (key === RECEIVED) {
      rows = latestFirst
        .map(entry =>
          row(
            entry,
            false,
            actor.isOwner
              ? ` <button type="button" class="sdm-log-undo" data-return="${entry.id}" data-tooltip="${esc(
                  $l10n('SDM.ProgressLog.ReturnHint')
                )}"><i class="fa-solid fa-rotate-left"></i> ${$l10n('SDM.ProgressLog.Return')}</button>`
              : ''
          )
        )
        .join('');
    } else {
      rows = latestFirst.map((entry, index) => row(entry, key !== DONATED && index === 0)).join('');
      if (isGM && key !== DONATED) {
        undo = `<button type="button" class="sdm-log-undo" data-undo="${esc(key)}"><i class="fa-solid fa-rotate-left"></i> ${$l10n(
          'SDM.ProgressLog.UndoLast'
        )}</button>`;
      }
    }
    return `<section class="sdm-progress-group">
        <header><strong>${esc(subjectLabel(actor, key, entries))}</strong>${undo}</header>
        <ol class="sdm-progress-log">${rows}</ol>
      </section>`;
  });

  const content = sections.length
    ? `${sections.join('')}${isGM ? `<p class="hint">${$l10n('SDM.ProgressLog.UndoHint')}</p>` : ''}`
    : `<ol class="sdm-progress-log"><li class="hint">${$l10n('SDM.ProgressLog.Empty')}</li></ol>`;

  let picked = null;
  await DialogV2.wait({
    window: { title: $fmt('SDM.ProgressLog.Title', { name: actor.name }), icon: 'fa-solid fa-clock-rotate-left' },
    position: { width: 560 },
    content,
    buttons: [{ action: 'close', label: $l10n('Close'), icon: 'fa-solid fa-xmark', default: true }],
    rejectClose: false,
    render: (event, dialog) => {
      const app = dialog ?? event?.target;
      app?.element?.querySelectorAll('[data-undo], [data-return]').forEach(button =>
        button.addEventListener('click', () => {
          picked = { undo: button.dataset.undo, return: button.dataset.return };
          app.close();
        })
      );
    }
  });
  if (!picked) return;

  if (picked.undo) await undoLastProgress(actor, picked.undo);
  else if (picked.return) await returnDonation(actor, picked.return);
  return openProgressLog(actor, { subject });
}

/** Referee: undo the latest entry of a group (the whole history when no group is given). */
export async function undoLastProgress(actor, subject) {
  if (!game.user.isGM) return;
  const log = getProgressLog(actor);
  const index = log.findLastIndex(entry => {
    const key = subjectOf(entry);
    return key !== DONATED && key !== RECEIVED && (!subject || key === subject);
  });
  if (index < 0) return;
  const entry = log[index];

  const done = await undoEntry(actor, entry);
  if (!done) {
    ui.notifications.warn($l10n('SDM.ProgressLog.UndoFailed'));
    return;
  }
  await removeProgressEntries(actor, e => e.id === entry.id);
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
    } else if (entry.kind === 'pet' && entry.snapshot) {
      // Back to the stats it had before (its current wounds stay, up to the old maximum)
      const system = foundry.utils.deepClone(entry.snapshot);
      if (system.life && target.system.life) {
        system.life.value = Math.min(target.system.life.value, system.life.max ?? target.system.life.value);
      }
      await target.update({ system }, opts);
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

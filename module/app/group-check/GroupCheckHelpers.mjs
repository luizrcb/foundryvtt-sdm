import { $l10n } from '../../helpers/globalUtils.mjs';

export function getOutcome(total, dc) {
  if (dc <= 0) return { outcome: null, label: null, color: null };
  if (total > dc) {
    return {
      outcome: 'success',
      label: $l10n('SDM.SavingThrowSave'),
      color: '#18520B'
    };
  } else if (total === dc) {
    return {
      outcome: 'sacrifice',
      label: $l10n('SDM.SavingThrowSacrifice'),
      color: '#d4af37'
    };
  } else {
    return {
      outcome: 'failure',
      label: $l10n('SDM.SavingThrowDoom'),
      color: '#aa0200'
    };
  }
}

export function rollTypeLabel(rollType) {
  const map = {
    ability: 'SDM.Ability',
    saving: 'SDM.FieldSaveTarget',
    custom: 'SDM.Custom',
    table: 'SDM.Table'
  };
  return $l10n(map[rollType] || 'SDM.Unknown');
}

export async function buildTableList() {
  const allTables = [];
  for (const table of game.tables.contents) {
    let folder = null;
    if (table.folder) {
      const f = game.folders.get(table.folder);
      folder = f?.name || null;
    }
    allTables.push({ uuid: table.uuid, name: table.name, folder, source: 'World' });
  }
  for (const pack of game.packs) {
    if (pack.documentName !== 'RollTable') continue;
    try {
      const docs = await pack.getDocuments();
      for (const table of docs) {
        let folder = null;
        if (table.folder) {
          try {
            folder = table.folder?.name || null;
          } catch {}
        }
        allTables.push({
          uuid: table.uuid,
          name: table.name,
          folder,
          source: pack.metadata.label
        });
      }
    } catch {}
  }
  const nameCount = {};
  for (const t of allTables) nameCount[t.name] = (nameCount[t.name] || 0) + 1;
  for (const t of allTables) {
    const parts = [t.name];
    if (nameCount[t.name] > 1 && t.folder) parts.push(`(${t.folder})`);
    parts.push(`(${t.source})`);
    t.label = parts.join(' ');
  }
  allTables.sort((a, b) => a.label.localeCompare(b.label));
  return allTables;
}

export async function enrichTableResult(result, isGM) {
  const { TextEditor } = foundry.applications.ux;
  const firstResult = result.results?.[0];
  if (!firstResult) return '—';
  const docUuid = firstResult.documentUuid || null;
  let enriched = '';
  if (docUuid) {
    const linkHtml = await TextEditor.enrichHTML(`@UUID[${docUuid}]`, {
      secrets: isGM,
      rollData: {}
    });
    const imgHtml = firstResult.img
      ? `<img src="${firstResult.img}" class="table-result-img" />`
      : '';
    enriched = `<div class="table-result-enriched">${imgHtml}${linkHtml}</div>`;
  } else {
    let rawResult = '';
    if (firstResult.description) {
      rawResult = firstResult.description;
    } else if (firstResult.name) {
      rawResult = firstResult.name;
    } else {
      rawResult = '—';
    }
    enriched = await TextEditor.enrichHTML(rawResult, {
      secrets: isGM,
      rollData: {}
    });
  }
  return enriched;
}

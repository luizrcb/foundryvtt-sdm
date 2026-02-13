import { SdmActor } from '../../documents/actor.mjs';
import { addCompendiumItemToActor } from '../../helpers/actorUtils.mjs';
import { ActorType } from '../../helpers/constants.mjs';
import { $fmt, $l10n } from '../../helpers/globalUtils.mjs';
import { UnarmedDamageItem } from '../../helpers/itemUtils.mjs';
import { addCashToActor } from './giveCash.mjs';

const { DialogV2 } = foundry.applications.api;

async function generateNameFromTable() {
  const originalTableUuid = 'Compendium.sdm.names_tables.RollTable.ToAbPgDAtrhU8EWA';

  const extraTables = game.tables.filter(
    table =>
      table.name.toLowerCase().includes('names:') || table.name.toLowerCase().includes('nomes:')
  );

  const total = 20 + extraTables.length;
  const roll = Math.floor(Math.random() * total) + 1;

  let tableUuid;
  if (roll <= 20) {
    tableUuid = originalTableUuid;
  } else {
    const extraIndex = roll - 21;
    tableUuid = extraTables[extraIndex].uuid;
  }

  const { name } = await drawFromTextTable(tableUuid);

  return name;
}

async function drawFromTextTable(tableUuid, roll) {
  const table = await fromUuid(tableUuid);
  let results;

  if (!roll) {
    ({ results } = await table.draw({ displayChat: false, recursive: true }));
  } else {
    results = table.getResultsForRoll(roll);
  }

  if (!results) return;

  if (results.length === 1) {
    const { name, description } = results[0];
    return { name, description };
  }

  return results.map(({ name, description }) => ({
    name,
    description
  }));
}

async function drawFromDocumentTable(tableUuid) {
  const { results } = await fromUuid(tableUuid).then(t =>
    t.draw({ displayChat: false, recursive: true })
  );
  const { documentUuid } = results[0];
  return documentUuid;
}

async function generateAbilityScores(actor) {
  const { results } = await fromUuid(
    'Compendium.sdm.ability_scores.RollTable.Wq2H7Tf7Vkt9eKX8'
  ).then(t => t.draw({ displayChat: false, recursive: true }));
  const { description } = results[0];

  function parseAttributeString(str) {
    const result = {
      str: 0,
      end: 0,
      aur: 0,
      cha: 0,
      agi: 0,
      tho: 0
    };

    const allAttributes = ['str', 'end', 'aur', 'cha', 'agi', 'tho'];

    const colonIndex = str.indexOf(':');
    if (colonIndex === -1) return result;

    const attributesPart = str.slice(colonIndex + 1).trim();
    const components = attributesPart.split('/').map(comp => comp.trim());

    const explicitValues = {};
    const standaloneNumbers = [];

    for (const component of components) {
      const attrMatch = component.match(/\b(str|end|aur|cha|agi|tho)\b/i);
      const numberMatch = component.match(/\d+/);

      if (!numberMatch) continue;

      const number = parseInt(numberMatch[0], 10);

      if (attrMatch) {
        const attr = attrMatch[1].toLowerCase();
        explicitValues[attr] = number;
      } else {
        standaloneNumbers.push(number);
      }
    }

    for (const [attr, value] of Object.entries(explicitValues)) {
      result[attr] = value;
    }

    const usedAttributes = Object.keys(explicitValues);
    const availableAttributes = allAttributes.filter(attr => !usedAttributes.includes(attr));

    const shuffledAttributes = [...availableAttributes].sort(() => Math.random() - 0.5);

    const minLength = Math.min(standaloneNumbers.length, shuffledAttributes.length);

    for (let i = 0; i < minLength; i++) {
      const attr = shuffledAttributes[i];
      result[attr] = standaloneNumbers[i];
    }

    return result;
  }

  const result = parseAttributeString(description);
  await actor.update({
    'system.abilities.str.base': result['str'],
    'system.abilities.str.current': result['str'],
    'system.abilities.end.base': result['end'],
    'system.abilities.end.current': result['end'],
    'system.abilities.aur.base': result['aur'],
    'system.abilities.aur.current': result['aur'],
    'system.abilities.cha.base': result['cha'],
    'system.abilities.cha.current': result['cha'],
    'system.abilities.agi.base': result['agi'],
    'system.abilities.agi.current': result['agi'],
    'system.abilities.tho.base': result['tho'],
    'system.abilities.tho.current': result['tho']
  });
}

async function generateAbilityScoresRollMethod(actor) {
  const abilitiesOrder = {
    en: ['Str', 'End', 'Agi', 'Cha', 'Aur', 'Tho'],
    'pt-BR': ['Cha', 'Tho', 'Str', 'Agi', 'Aur', 'End']
  };

  const currentLanguage = game.i18n.lang;
  const order = abilitiesOrder[currentLanguage] || abilitiesOrder['en'];
  const results = {};

  for (const stat of order) {
    const roll = await new Roll('1d100').evaluate();

    let value;
    if (roll.total <= 30) value = 0;
    else if (roll.total <= 55) value = 1;
    else if (roll.total <= 75) value = 2;
    else if (roll.total <= 90) value = 3;
    else if (roll.total <= 99) value = 4;
    else value = 5; // Natural 100

    results[stat] = value;
  }

  // Update actor with rolled abilities
  await actor.update({
    'system.abilities.str.base': results['Str'] || 0,
    'system.abilities.str.current': results['Str'] || 0,
    'system.abilities.end.base': results['End'] || 0,
    'system.abilities.end.current': results['End'] || 0,
    'system.abilities.aur.base': results['Aur'] || 0,
    'system.abilities.aur.current': results['Aur'] || 0,
    'system.abilities.cha.base': results['Cha'] || 0,
    'system.abilities.cha.current': results['Cha'] || 0,
    'system.abilities.agi.base': results['Agi'] || 0,
    'system.abilities.agi.current': results['Agi'] || 0,
    'system.abilities.tho.base': results['Tho'] || 0,
    'system.abilities.tho.current': results['Tho'] || 0
  });

  return results;
}

async function createRandomBackgroundWithOptions(actor, method = 'single') {
  const mainTableUuid =
    method === 'single'
      ? 'Compendium.sdm.traits_tables.RollTable.rGG0mOFXsKQbqiQQ'
      : 'Compendium.sdm.traits_tables.RollTable.cFXq88o4lzuqxAPP';

  const extraTables = game.tables.filter(
    table =>
      table.name.toLowerCase().includes('background') ||
      table.name.toLowerCase().includes('antecedente')
  );

  const allTables = [mainTableUuid, ...extraTables.map(t => t.uuid)];

  function isValidResult(drawnResult, method) {
    if (!drawnResult.results || drawnResult.results.length === 0) return false;

    if (method === 'single') {
      if (drawnResult.results.length !== 1) return false;
      const r = drawnResult.results[0];
      if (!r.name) return false;
      const desc = r.description || '';
      return desc.includes('Task:') && desc.includes('Spin:');
    } else {
      if (drawnResult.results.length !== 5) return false;
      return drawnResult.results.every(r => r.name && r.name.trim() !== '');
    }
  }

  let selectedUuid;
  let drawnResult;
  let attempts = 0;
  let maxAttempts = 20;
  let success = false;

  while (!success && attempts < maxAttempts) {
    const selectedIndex = Math.floor(Math.random() * allTables.length);
    selectedUuid = allTables[selectedIndex];

    const table = await fromUuid(selectedUuid);
    if (!table) {
      attempts++;
      continue;
    }

    drawnResult = await table.draw({ displayChat: false, recursive: true });

    if (isValidResult(drawnResult, method)) {
      success = true;
    } else {
      console.warn(
        `Background table "${table.name}" returned an invalid result for method "${method}". Retrying...`
      );
      attempts++;
    }
  }

  if (!success) {
    console.error(`Failed to obtain a valid background after ${maxAttempts} attempts.`);
    return;
  }

  let title, task, spin;

  if (method === 'single') {
    const result = drawnResult.results[0];
    title = result.name || '';

    const description = result.description || '';
    const taskMatch = description.match(/Task:([^|]*)/);
    const spinMatch = description.match(/Spin:(.*)/);

    task = taskMatch ? taskMatch[1].trim() : '';
    task = task.replaceAll('<p>', '').replaceAll('</p>', '');
    spin = spinMatch ? spinMatch[1].trim() : '';
    spin = spin.replaceAll('<p>', '').replaceAll('</p>', '');
  } else {
    const results = drawnResult.results;
    const flavor = results[0].name || '';
    const role1 = results[1].name || '';
    const role2 = results[2].name || '';
    task = results[3].name || '';
    spin = results[4].name || '';
    title = `${flavor} ${role1} ${role2}`.trim();
  }

  if (!title || !task || !spin) {
    console.error('Parsed background values are incomplete:', { title, task, spin });
    return;
  }

  await game.sdm.api.createBackgroundTrait(actor, {
    title,
    task,
    spin
  });

  return { title, task, spin };
}

async function addCorruptionFromTable(actor, tableUuid) {
  const result = await drawFromTextTable(tableUuid);
  const corruption = result.name || result.description;

  if (!corruption) return;

  const itemData = new Item({
    name: corruption,
    img: 'icons/svg/biohazard.svg',
    type: 'trait',
    system: {
      type: 'corruption'
    }
  }).toObject();

  const createdItems = await actor.createEmbeddedDocuments('Item', [itemData]);
  return createdItems;
}

async function addItemToCharacter(itemUuid, actor) {
  const item = await fromUuid(itemUuid);
  const itemObject = item.toObject();
  // console.debug('itemObject', itemObject);
  itemObject.name = itemObject.name.replace(/^\d\.\s/, '');

  await actor.createEmbeddedDocuments('Item', [itemObject]);
}

async function addUsefulKit(actor) {
  const kitUuid = 'Compendium.sdm.gadgets.Item.4Y6UXEQrWZFCHfmU';
  await addItemToCharacter(kitUuid, actor);
}

const mainPathTables = {
  initial: 'Compendium.sdm.traits_tables.RollTable.652LEhbha7y6KFci',
  advanced: 'Compendium.sdm.traits_tables.RollTable.5DQuOEZbj4yIoEIU'
};

async function getPathOptionsList() {
  const options = [];

  const extraTables = game.tables.filter(
    table =>
      table.name.toLowerCase().includes('path:') || table.name.toLowerCase().includes('caminho:')
  );

  let currentIndex = 1;

  const initialTable = await fromUuid(mainPathTables.initial);
  const initialRolls = [2, 4, 6]; // Wizard, Traveler, Fighter

  for (const roll of initialRolls) {
    const result = initialTable.getResultsForRoll(roll);
    if (result && result.length > 0 && result[0].documentUuid) {
      const innerTable = await fromUuid(result[0].documentUuid);
      options.push({
        index: currentIndex,
        roll: roll,
        tableUuid: mainPathTables.initial,
        innerTableUuid: result[0].documentUuid,
        name: innerTable.name
      });
      currentIndex++;
    }
  }

  const advancedTable = await fromUuid(mainPathTables.advanced);

  for (let roll = 1; roll <= 20; roll++) {
    const result = advancedTable.getResultsForRoll(roll);
    if (result && result.length > 0 && result[0].documentUuid) {
      const innerTable = await fromUuid(result[0].documentUuid);
      options.push({
        index: currentIndex,
        roll: roll,
        tableUuid: mainPathTables.advanced,
        innerTableUuid: result[0].documentUuid,
        name: innerTable.name
      });
      currentIndex++;
    }
  }

  for (const extraTable of extraTables) {
    options.push({
      index: currentIndex,
      tableUuid: extraTable.uuid,
      innerTableUuid: null,
      name: extraTable.name.replace('path:', '').replace('caminho:').trim()
    });
    currentIndex++;
  }

  return options;
}

async function createPathTrait(actor, pathNumber = null, useFirstEntry = true) {
  const pathOptions = await getPathOptionsList();
  const totalOptions = pathOptions.length;

  let selectedPathIndex;
  if (pathNumber !== null) {
    selectedPathIndex = parseInt(pathNumber, 10);
  } else {
    selectedPathIndex = Math.floor(Math.random() * totalOptions) + 1;
  }

  const selectedPath = pathOptions.find(opt => opt.index === selectedPathIndex);
  if (!selectedPath) {
    throw new Error(`Invalid path number: ${selectedPathIndex}. Must be 1-${totalOptions}.`);
  }

  let traitUUID;

  if (selectedPath.innerTableUuid) {
    const innerTable = await fromUuid(selectedPath.innerTableUuid);

    if (useFirstEntry) {
      let firstResult = innerTable.getResultsForRoll(1);

      // edge case for weapon path
      if (selectedPathIndex === 22) {
        const anotherInnerTable = await fromUuid(firstResult[0].documentUuid);
        firstResult = anotherInnerTable.getResultsForRoll(1);
      }

      if (firstResult && firstResult.length > 0 && firstResult[0].documentUuid) {
        traitUUID = firstResult[0].documentUuid;
      }
    } else {
      const drawnResult = await innerTable.draw({ displayChat: false, recursive: true });
      if (drawnResult.results && drawnResult.results.length > 0) {
        const result = drawnResult.results[0];
        if (result.documentUuid) {
          traitUUID = result.documentUuid;
        }
      }
    }
  } else {
    const extraTable = await fromUuid(selectedPath.tableUuid);

    if (useFirstEntry) {
      const firstResult = await extraTable.getResultsForRoll(1);
      if (firstResult && firstResult.length > 0 && firstResult[0].documentUuid) {
        traitUUID = firstResult[0].documentUuid;
      }
    } else {
      const drawnResult = await extraTable.draw({ displayChat: false, recursive: true });
      if (drawnResult.results && drawnResult.results.length > 0) {
        const result = drawnResult.results[0];
        if (result.documentUuid) {
          traitUUID = result.documentUuid;
        }
      }
    }
  }

  if (!traitUUID) {
    return;
  }

  try {
    const item = await fromUuid(traitUUID);
    if (!item) {
      return;
    }

    const itemObject = item.toObject();
    itemObject.name = itemObject.name.replace(/^\d\.\s/, '');
    const createdItems = await actor.createEmbeddedDocuments('Item', [itemObject]);

    return {
      item: createdItems[0],
      pathNumber: selectedPathIndex,
      uuid: traitUUID
    };
  } catch (error) {
    console.error(`Error creating path trait:`, error);
    throw error;
  }
}

async function addInitialCash(actor) {
  const defaultCurrencyName = game.settings.get('sdm', 'currencyName');
  const defaultCurrencyImage = game.settings.get('sdm', 'currencyImage');
  await addCashToActor(actor, 100, defaultCurrencyName, defaultCurrencyImage);
}

async function drawAndAddFromTable(tableUUID, actor) {
  const drawnItemUUID = await drawFromDocumentTable(tableUUID);
  // console.log('drawnItemUUID', drawnItemUUID);
  if (drawnItemUUID) {
    const response = await fromUuid(drawnItemUUID);
    await addItemToCharacter(drawnItemUUID, actor);
    return response;
  }

  return;
}

async function createFreeTrait(actor, includeCorruption = false, rollNumber = undefined) {
  const maxRoll = includeCorruption ? 10 : 9;
  const num = rollNumber || Math.floor(Math.random() * maxRoll) + 1;

  try {
    if (num >= 1 && num <= 3) {
      return await createRandomBackgroundWithOptions(actor, 'single');
    } else if (num >= 4 && num <= 6) {
      const tableMap = {
        4: 'Compendium.sdm.rolltables.RollTable.sTbr6sL8AtR0Swdm', //wizard
        5: 'Compendium.sdm.rolltables.RollTable.6s6QYmH5VIqwCmru', //traveler
        6: 'Compendium.sdm.rolltables.RollTable.e32f1fVfCm8UaOQz' //fighter
      };

      const tableUUID = tableMap[num];
      return await drawAndAddFromTable(tableUUID, actor);
    } else if (num >= 7 && num <= 9) {
      const otherPaths = 'Compendium.sdm.traits_tables.RollTable.5DQuOEZbj4yIoEIU';
      return await drawAndAddFromTable(otherPaths, actor);
    } else if (num === 10) {
      const d6Roll = Math.floor(Math.random() * 6) + 1;
      const corruptionTableMap = {
        1: 'Compendium.sdm.corruption.RollTable.BBgSMXyZ7cPuZuCM',
        2: 'Compendium.sdm.corruption.RollTable.grc8rMrojT8de6Ve',
        3: 'Compendium.sdm.corruption.RollTable.grc8rMrojT8de6Ve',
        4: 'Compendium.sdm.corruption.RollTable.a3v2H3P6olAzWHwS',
        5: 'Compendium.sdm.corruption.RollTable.a3v2H3P6olAzWHwS',
        6: 'Compendium.sdm.corruption.RollTable.a3v2H3P6olAzWHwS'
      };
      const tableUUID = corruptionTableMap[d6Roll];
      return await addCorruptionFromTable(actor, tableUUID);
    }
  } catch (error) {
    console.error(`Error handling roll ${num}:`, error);
    throw error;
  }
}

async function addStrangeItemToActor(actor) {
  const mainTableUuid = 'Compendium.sdm.strange_items_table.RollTable.qxFOiAYqzqDiu4Yc';

  const mainTable = await fromUuid(mainTableUuid);
  if (!mainTable) {
    console.error('Main strange items table not found:', mainTableUuid);
    return;
  }

  const strangeTables = game.tables.filter(table =>
    table.name.toLowerCase().match(/strange|estranho/)
  );

  const allTables = [];
  const tableCounts = [];

  const mainTableResultCount = mainTable.results.size;
  allTables.push({ uuid: mainTableUuid, count: mainTableResultCount, name: mainTable.name });
  tableCounts.push(mainTableResultCount);

  for (const table of strangeTables) {
    const tableResultCount = table.results.size;
    allTables.push({ uuid: table.uuid, count: tableResultCount, name: table.name });
    tableCounts.push(tableResultCount);
  }

  const totalResults = tableCounts.reduce((sum, count) => sum + count, 0);

  if (totalResults === 0) {
    console.warn('No strange item results found in any table.');
    return null;
  }

  const roll = Math.floor(Math.random() * totalResults) + 1;

  let currentRange = 0;
  let targetTable = null;

  for (const table of allTables) {
    currentRange += table.count;
    if (roll <= currentRange) {
      targetTable = table;
      break;
    }
  }

  if (!targetTable) {
    console.error('Could not determine target table for roll', roll);
    return null;
  }

  const table = await fromUuid(targetTable.uuid);
  const drawnResult = await table.draw({ displayChat: false, recursive: true });

  if (!drawnResult.results || drawnResult.results.length === 0) {
    console.error('No results drawn from table:', targetTable.name);
    return null;
  }

  const result = drawnResult.results[0];
  let itemData;
  let itemName;

  if (result.type === 'document' && result.documentUuid) {
    try {
      const itemFromUuid = await fromUuid(result.documentUuid);
      itemData = itemFromUuid.toObject();
      itemName = itemData.name;
    } catch (error) {
      console.error('Error loading item from documentUuid:', error);
      itemName = result.name || `Item from ${targetTable.name}`;
      itemData = new Item({
        name: itemName,
        type: 'gear',
        system: {}
      }).toObject();
    }
  } else if (result.type === 'text') {
    itemName = result.name || 'Strange Item';

    const text = result.name || '';
    const sizeMatch = text.match(/(\d+)\s*(st|sp|stones|soaps)/i);

    if (sizeMatch) {
      const sizeValue = parseInt(sizeMatch[1]);
      const sizeUnit =
        sizeMatch[2].toLowerCase() === 'sp' || sizeMatch[2].toLowerCase() === 'soaps'
          ? 'soaps'
          : 'stones';

      itemData = new Item({
        name: itemName,
        type: 'gear',
        system: {
          size: {
            unit: sizeUnit,
            value: sizeValue
          }
        }
      }).toObject();
    } else {
      // No size specified
      itemData = new Item({
        name: itemName,
        type: 'gear',
        system: {}
      }).toObject();
    }
  } else {
    // Fallback
    itemName = result.name || 'Unknown Item';
    itemData = new Item({
      name: itemName,
      type: 'gear',
      system: {}
    }).toObject();
  }

  // Create the item on the actor
  const createdItems = await actor.createEmbeddedDocuments('Item', [itemData]);

  return {
    item: createdItems[0],
    table: targetTable.name,
    roll: roll,
    totalResults: totalResults
  };
}

async function addMotiveToActor(actor) {
  const mainTableUuid = 'Compendium.sdm.motive_table.RollTable.QNrZVnSF2iayOOIy';

  const motiveTables = game.tables.filter(table =>
    table.name.toLowerCase().match(/motive|motivacao|motivação/)
  );

  let totalResults = 50;
  const tableData = [{ uuid: mainTableUuid, count: 50, type: 'main' }];

  motiveTables.forEach(table => {
    const tableResultCount = table.results.size;
    totalResults += tableResultCount;
    tableData.push({ uuid: table.uuid, count: tableResultCount, type: 'extra' });
  });

  const roll = Math.floor(Math.random() * totalResults) + 1;

  let currentRange = 0;
  let targetTableUuid = null;
  let positionInTable = 0;

  for (const table of tableData) {
    currentRange += table.count;
    if (roll <= currentRange) {
      targetTableUuid = table.uuid;
      positionInTable = roll - (currentRange - table.count);
      break;
    }
  }

  if (!targetTableUuid) return;

  let result;
  if (roll <= 50) {
    result = await drawFromTextTable(targetTableUuid);
  } else {
    result = await drawFromTextTable(targetTableUuid, positionInTable);
  }

  const rolledMotive = result ? result.name || '' : '';

  if (!rolledMotive) return;

  await actor.update({
    'system.biography': `<p><strong>${$l10n('SDM.MotiveLabel')}:</strong> ${rolledMotive}</p>`
  });

  return rolledMotive;
}

async function characterGeneratorDialog(actor) {
  // Get path options for the dialog
  const pathOptions = await getPathOptionsList();

  // Build options HTML for the select
  let pathOptionsHTML = '';
  for (const option of pathOptions) {
    pathOptionsHTML += `<option value="${option.index}">${option.name}</option>`;
  }

  // Build dialog content with i18n
  const content = `
<fieldset>
  <legend>${actor ? $fmt('SDM.RerollingCharacter', { name: actor.name }) : $l10n('SDM.CharacterGenerator.Title')}</legend>

  <div class="form-group">
    <label>${$l10n('SDM.CharacterGenerator.AbilityMethod')}</label>
    <select id="abilityMethod" name="abilityMethod" class="form-control">
      <option value="current">${$l10n('SDM.CharacterGenerator.AbilityMethodCurrent')}</option>
      <option value="roll">${$l10n('SDM.CharacterGenerator.AbilityMethodRoll')}</option>
    </select>
  </div>

  <hr>

  <div class="form-group">
    <label>${$l10n('SDM.CharacterGenerator.CharacterName')}</label>
    <input type="text" name="manualName" id="manualName" value="${actor ? actor.name : ''}" class="form-control" placeholder="${$l10n('SDM.CharacterGenerator.CharacterNamePlaceholder')}">
  </div>

  <hr>

  <div class="form-group">
    <label>${$l10n('SDM.CharacterGenerator.BackgroundTrait')}</label>
    <select id="backgroundMethod" name="backgroundMethod" class="form-control">
      <option value="single">${$l10n('SDM.CharacterGenerator.BackgroundSingle')}</option>
      <option value="multiple">${$l10n('SDM.CharacterGenerator.BackgroundMultiple')}</option>
    </select>
  </div>

  <hr>

  <div class="form-group">
    <label>${$l10n('SDM.CharacterGenerator.PathTrait')}</label>
    <div style="margin-top: 5px;">
      <input type="radio" id="path-current" name="pathMethod" value="current" checked>
      <label for="path-current" style="margin-right: 20px;">${$l10n('SDM.CharacterGenerator.PathRandomInitial')}</label>
      <div style="margin-top: 5px;">
          <input type="radio" id="path-specific" name="pathMethod" value="specific">
          <label for="path-specific">${$l10n('SDM.CharacterGenerator.PathRandomFromPath')}</label>
          <select id="pathTableSelect" name="pathTable" class="form-control" style="margin-top: 10px; display: none;">
            ${pathOptionsHTML}
          </select>
      </div>
    </div>
  </div>

  <hr>

  <div class="form-group flex">
    <label>${$l10n('SDM.CharacterGenerator.AdditionalOptions')}</label>
    <div class="flex-row" style="margin-top: 5px;">
      <input type="checkbox" id="addMotive" name="addMotive" checked>
      <label for="addMotive" style="margin-right: 20px;">${$l10n('SDM.CharacterGenerator.AddMotive')}</label>

      <input type="checkbox" id="addStrangeItem" name="addStrangeItem" checked>
      <label for="addStrangeItem" style="margin-right: 20px;">${$l10n('SDM.CharacterGenerator.AddStrangeItem')}</label>

      <input type="checkbox" id="addUsefulKit" name="addUsefulKit" checked>
      <label for="addUsefulKit" style="margin-right: 20px;">${$l10n('SDM.CharacterGenerator.AddUsefulKit')}</label>

      <input type="checkbox" id="addInitialCash" name="addInitialCash" checked>
      <label for="addInitialCash">${$l10n('SDM.CharacterGenerator.AddInitialCash')}</label>
    </div>
  </div>
</fieldset>
`;

  // Create dialog instance
  const data = await DialogV2.wait({
    window: { title: $l10n('SDM.CreateRandomCharacter') },
    content,
    buttons: [
      {
        action: 'generate',
        label: actor ? $l10n('SDM.RerollCharacter') : $l10n('SDM.GenerateCharacter'),
        icon: actor ? 'fa-solid fa-user-gear' : 'fa-solid fa-user-plus',
        callback: (event, button) => {
          const formData = new foundry.applications.ux.FormDataExtended(button.form).object;
          return formData;
        }
      },
      {
        action: 'cancel',
        label: $l10n('SDM.ButtonCancel'),
        icon: 'fa-solid fa-times'
      }
    ],
    rejectClose: false,
    render: (event, dialog) => {
      const html = dialog.element;

      // Path table selection
      const pathCurrentRadio = html.querySelector('#path-current');
      const pathSpecificRadio = html.querySelector('#path-specific');
      const pathTableSelect = html.querySelector('#pathTableSelect');

      // Toggle path table selection
      if (pathCurrentRadio && pathSpecificRadio && pathTableSelect) {
        const togglePathTable = () => {
          pathTableSelect.style.display = pathSpecificRadio.checked ? 'block' : 'none';
        };

        pathCurrentRadio.addEventListener('change', togglePathTable);
        pathSpecificRadio.addEventListener('change', togglePathTable);
      }
    }
  });

  // If dialog was cancelled or no data, return
  if (!data || data === 'cancel') return;

  if (actor) {
    const proceed = await DialogV2.confirm({
      content: $fmt('SDM.RerollCharacterConfirmation', { name: actor.name }),
      modal: true,
      window: { title: $fmt('SDM.RerollingCharacter', { name: actor.name }) },
      rejectClose: false,
      yes: { label: $l10n('SDM.ButtonYes') },
      no: { label: $l10n('SDM.ButtonNo') }
    });
    if (!proceed) return;
  }

  // Generate the character with the selected options
  await generateCharacterWithOptions(data, actor);
}

async function generateCharacterWithOptions(options = {}, existingActor) {
  try {
    let name = options.manualName || (await generateNameFromTable());
    if (!name || name.trim() === '') {
      name = await generateNameFromTable();
    }

    if (existingActor) {
      existingActor.items.contents.forEach(async item => {
        await item.delete();
      });

      existingActor.effects.contents.forEach(async effect => {
        await effect.delete();
      });
    }

    const newActor = new SdmActor({
      type: ActorType.CHARACTER,
      name
    }).toObject();

    const actor = existingActor || (await SdmActor.create(newActor));
    await actor.update({
      name: name,
      'prototypeToken.name': name,
      system: newActor.system
    });

    await actor.update({
      'system.experience': '300'
    });

    if (existingActor) {
      await addCompendiumItemToActor(actor, UnarmedDamageItem);
    }

    // Generate ability scores based on selected method
    if (options.abilityMethod === 'roll') {
      await generateAbilityScoresRollMethod(actor);
    } else {
      await generateAbilityScores(actor); // Original method
    }

    // Add motive if selected
    if (options.addMotive !== false) {
      const motive = await addMotiveToActor(actor);
      if (!motive) {
        await addMotiveToActor(actor);
      }
    }

    // Create background trait with selected method
    const background = await createRandomBackgroundWithOptions(
      actor,
      options.backgroundMethod || 'single'
    );
    // console.debug('background', background);
    // retry
    if (!background) {
      const response = await createRandomBackgroundWithOptions(
        actor,
        options.backgroundMethod || 'single'
      );
      // console.debug('background', response);
    }

    // Create path trait based on selected method
    if (options.pathMethod === 'specific' && options.pathTable) {
      // Use specific path table
      const pathTrait = await createPathTrait(actor, options.pathTable, false);
      // console.debug('pathTrait', pathTrait);
    } else {
      // Use current logic
      const pathTrait = await createPathTrait(actor);
      // console.debug('pathTrait', pathTrait);
    }

    // Add free trait
    const freeTrait = await createFreeTrait(actor);
    // console.debug('freeTrait', freeTrait);

    // Add strange item if selected
    if (options.addStrangeItem !== false) {
      await addStrangeItemToActor(actor);
    }

    // Add useful kit if selected
    if (options.addUsefulKit !== false) {
      await addUsefulKit(actor);
    }

    // Add initial cash if selected
    if (options.addInitialCash !== false) {
      await addInitialCash(actor);
    }

    // Show success notification
    ui.notifications.info($fmt('SDM.CharacterGenerated', { name }));

    return actor;
  } catch (error) {
    console.error('Error generating character:', error);
    ui.notifications.error($fmt('SDM.CharacterGenerationFailed', { error: error.message }));
    throw error;
  }
}

export async function generateCharacter() {
  return generateCharacterWithOptions({
    abilityMethod: 'current',
    addInitialCash: true,
    addMotive: true,
    addStrangeItem: true,
    addUsefulKit: true,
    backgroundMethod: 'single',
    pathMethod: 'current'
  });
}

export { characterGeneratorDialog };

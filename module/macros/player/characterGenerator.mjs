import { addCashToActor } from '../gm/giveCash.mjs';
import { SdmActor } from '../../documents/actor.mjs';
import { ActorType } from '../../helpers/constants.mjs';

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
  // Define main tables based on method
  const mainTableUuid =
    method === 'single'
      ? 'Compendium.sdm.traits_tables.RollTable.rGG0mOFXsKQbqiQQ'
      : 'Compendium.sdm.traits_tables.RollTable.cFXq88o4lzuqxAPP';

  // const extraTables = game.tables.filter(
  //   table =>
  //     table.name.toLowerCase().includes('background') ||
  //     table.name.toLowerCase().includes('antecedente')
  // );

  const allTables = [mainTableUuid//, ...extraTables.map(t => t.uuid)
  ];
  const selectedIndex = Math.floor(Math.random() * allTables.length);
  const selectedUuid = allTables[selectedIndex];

  const drawnResult = await fromUuid(selectedUuid).then(t =>
    t.draw({ displayChat: false, recursive: true })
  );

  if (!drawnResult.results || drawnResult.results.length === 0) {
    return;
  }

  let title, task, spin;

  if (method === 'single') {
    const result = drawnResult.results[0];
    title = result.name || '';

    // Parse the description which is in format: "Task:...|Spin:..."
    const description = result.description || '';
    const taskMatch = description.match(/Task:([^|]*)/);
    const spinMatch = description.match(/Spin:(.*)/);

    task = taskMatch ? taskMatch[1].trim() : '';
    task = task.replaceAll('<p>', '').replaceAll('</p>');
    spin = spinMatch ? spinMatch[1].trim() : '';
    spin = spin.replaceAll('<p>', '').replaceAll('</p>');
  } else {
    const results = drawnResult.results;
    if (results.length >= 5) {
      const flavor = results[0].name || '';
      const role1 = results[1].name || '';
      const role2 = results[2].name || '';
      task = results[3].name || '';
      spin = results[4].name || '';
      title = `${flavor} ${role1} ${role2}`.trim();
    }
  }

  if (!title || !task || !spin) return;

  await game.sdm.api.createBackgroundTrait(actor, {
    title,
    task,
    spin
  });

  return {
    title,
    task,
    spin
  };
}

async function addItemToCharacter(itemUuid, actor) {
  const item = await fromUuid(itemUuid);
  const itemObject = item.toObject();
  console.debug('itemObject', itemObject);
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

  // Get extra tables
  const extraTables = game.tables.filter(
    table =>
      table.name.toLowerCase().includes('path:') || table.name.toLowerCase().includes('caminho:')
  );

  // Total options: 23 main (1-3 from initial, 4-23 from advanced) + extra tables
  let currentIndex = 1;

  // Initial table options (wizard, traveler, fighter)
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

  // Advanced table options (4-23)
  const advancedTable = await fromUuid(mainPathTables.advanced);

  // Advanced table has 20 results (rolls 1-20)
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

  // Extra tables
  for (const extraTable of extraTables) {
    options.push({
      index: currentIndex,
      tableUuid: extraTable.uuid,
      innerTableUuid: null, // Extra tables are directly the trait tables
      name: extraTable.name.replace('path:', '').replace('caminho:').trim()
    });
    currentIndex++;
  }

  return options;
}

async function createPathTrait(actor, pathNumber = null, useFirstEntry = true) {
  const pathOptions = await getPathOptionsList();
  const totalOptions = pathOptions.length;

  // Use provided number or generate random
  let selectedPathIndex;
  if (pathNumber !== null) {
    selectedPathIndex = parseInt(pathNumber, 10);
  } else {
    selectedPathIndex = Math.floor(Math.random() * totalOptions) + 1;
  }

  // Find the selected path
  const selectedPath = pathOptions.find(opt => opt.index === selectedPathIndex);
  if (!selectedPath) {
    throw new Error(`Invalid path number: ${selectedPathIndex}. Must be 1-${totalOptions}.`);
  }

  let traitUUID;

  if (selectedPath.innerTableUuid) {
    // Main table path (initial or advanced)
    const innerTable = await fromUuid(selectedPath.innerTableUuid);

    if (useFirstEntry) {
      // Get first entry from inner table
      let firstResult = innerTable.getResultsForRoll(1);

      if (selectedPathIndex === 22) {
        const anotherInnerTable = await fromUuid(firstResult[0].documentUuid);
        firstResult = anotherInnerTable.getResultsForRoll(1);
      }

      if (firstResult && firstResult.length > 0 && firstResult[0].documentUuid) {
        traitUUID = firstResult[0].documentUuid;
      }
    } else {
      // Draw random from inner table
      const drawnResult = await innerTable.draw({ displayChat: false, recursive: true });
      if (drawnResult.results && drawnResult.results.length > 0) {
        const result = drawnResult.results[0];
        if (result.documentUuid) {
          traitUUID = result.documentUuid;
        }
      }
    }
  } else {
    // Extra table path
    const extraTable = await fromUuid(selectedPath.tableUuid);

    if (useFirstEntry) {
      // Get first entry from extra table
      const firstResult = await extraTable.getResultsForRoll(1);
      if (firstResult && firstResult.length > 0 && firstResult[0].documentUuid) {
        traitUUID = firstResult[0].documentUuid;
      }
    } else {
      // Draw random from extra table
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

  // Create the item
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
  console.log('drawnItemUUID', drawnItemUUID);
  if (drawnItemUUID) {
    const response = await fromUuid(drawnItemUUID);
    await addItemToCharacter(drawnItemUUID, actor);
    return response;
  }

  return;
}

async function createFreeTrait(actor, rollNumber = undefined) {
  // Use provided number or generate random (1-9)
  const num = rollNumber || Math.floor(Math.random() * 9) + 1;
  console.debug('num', num);
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
    }
  } catch (error) {
    console.error(`Error handling roll ${num}:`, error);
    throw error;
  }
}

async function addStrangeItemToActor(actor) {
  const mainTableUuid = 'Compendium.sdm.strange_items_table.RollTable.qxFOiAYqzqDiu4Yc';

  // Get the main table
  const mainTable = await fromUuid(mainTableUuid);
  if (!mainTable) {
    console.error('Main strange items table not found:', mainTableUuid);
    return;
  }

  // Get extra tables
  const strangeTables = game.tables.filter(table =>
    table.name.toLowerCase().match(/strange|estranho/)
  );

  // Build list of all tables with their result counts
  const allTables = [];
  const tableCounts = [];

  // Add main table
  const mainTableResultCount = mainTable.results.size;
  allTables.push({ uuid: mainTableUuid, count: mainTableResultCount, name: mainTable.name });
  tableCounts.push(mainTableResultCount);

  // Add extra tables
  for (const table of strangeTables) {
    const tableResultCount = table.results.size;
    allTables.push({ uuid: table.uuid, count: tableResultCount, name: table.name });
    tableCounts.push(tableResultCount);
  }

  // Calculate total results across all tables
  const totalResults = tableCounts.reduce((sum, count) => sum + count, 0);

  if (totalResults === 0) {
    console.warn('No strange item results found in any table.');
    return null;
  }

  // Roll to determine which result to get
  const roll = Math.floor(Math.random() * totalResults) + 1;

  // Find which table contains the rolled result
  let currentRange = 0;
  let targetTable = null;
  let resultIndexInTable = 0;

  for (const table of allTables) {
    currentRange += table.count;
    if (roll <= currentRange) {
      targetTable = table;
      // Calculate which result within this table (1-indexed)
      resultIndexInTable = roll - (currentRange - table.count);
      break;
    }
  }

  if (!targetTable) {
    console.error('Could not determine target table for roll', roll);
    return null;
  }

  // Get the result from the target table
  const table = await fromUuid(targetTable.uuid);
  const drawnResult = await table.draw({ displayChat: false, recursive: true });

  if (!drawnResult.results || drawnResult.results.length === 0) {
    console.error('No results drawn from table:', targetTable.name);
    return null;
  }

  const result = drawnResult.results[0];
  let itemData;
  let itemName;

  // Handle different result types
  if (result.type === 'document' && result.documentUuid) {
    // Item from document UUID
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
    // Text result - check if it has size information
    itemName = result.text || result.name || 'Strange Item';

    // Try to extract size from the text
    const text = result.text || result.name || '';
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
    'system.biography': `<p><strong>${game.i18n.localize('SDM.MotiveLabel')}:</strong> ${rolledMotive}</p>`
  });

  return rolledMotive;
}

async function characterGeneratorDialog() {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize('SDM.ErrorGMOnly'));
    return;
  }

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
  <legend>${game.i18n.localize('SDM.CharacterGenerator.Title')}</legend>

  <div class="form-group">
    <label>${game.i18n.localize('SDM.CharacterGenerator.AbilityMethod')}</label>
    <select id="abilityMethod" name="abilityMethod" class="form-control">
      <option value="current">${game.i18n.localize('SDM.CharacterGenerator.AbilityMethodCurrent')}</option>
      <option value="roll">${game.i18n.localize('SDM.CharacterGenerator.AbilityMethodRoll')}</option>
    </select>
  </div>

  <hr>

  <div class="form-group">
    <label>${game.i18n.localize('SDM.CharacterGenerator.CharacterName')}</label>
    <input type="text" name="manualName" id="manualName" class="form-control" placeholder="${game.i18n.localize('SDM.CharacterGenerator.CharacterNamePlaceholder')}">
  </div>

  <hr>

  <div class="form-group">
    <label>${game.i18n.localize('SDM.CharacterGenerator.BackgroundTrait')}</label>
    <select id="backgroundMethod" name="backgroundMethod" class="form-control">
      <option value="single">${game.i18n.localize('SDM.CharacterGenerator.BackgroundSingle')}</option>
      <option value="multiple">${game.i18n.localize('SDM.CharacterGenerator.BackgroundMultiple')}</option>
    </select>
  </div>

  <hr>

  <div class="form-group">
    <label>${game.i18n.localize('SDM.CharacterGenerator.PathTrait')}</label>
    <div style="margin-top: 5px;">
      <input type="radio" id="path-current" name="pathMethod" value="current" checked>
      <label for="path-current" style="margin-right: 20px;">${game.i18n.localize('SDM.CharacterGenerator.PathRandomInitial')}</label>
      <div style="margin-top: 5px;">
          <input type="radio" id="path-specific" name="pathMethod" value="specific">
          <label for="path-specific">${game.i18n.localize('SDM.CharacterGenerator.PathRandomFromPath')}</label>
          <select id="pathTableSelect" name="pathTable" class="form-control" style="margin-top: 10px; display: none;">
            ${pathOptionsHTML}
          </select>
      </div>
    </div>
  </div>

  <hr>

  <div class="form-group flex">
    <label>${game.i18n.localize('SDM.CharacterGenerator.AdditionalOptions')}</label>
    <div class="flex-row" style="margin-top: 5px;">
      <input type="checkbox" id="addMotive" name="addMotive" checked>
      <label for="addMotive" style="margin-right: 20px;">${game.i18n.localize('SDM.CharacterGenerator.AddMotive')}</label>

      <input type="checkbox" id="addStrangeItem" name="addStrangeItem" checked>
      <label for="addStrangeItem" style="margin-right: 20px;">${game.i18n.localize('SDM.CharacterGenerator.AddStrangeItem')}</label>

      <input type="checkbox" id="addUsefulKit" name="addUsefulKit" checked>
      <label for="addUsefulKit" style="margin-right: 20px;">${game.i18n.localize('SDM.CharacterGenerator.AddUsefulKit')}</label>

      <input type="checkbox" id="addInitialCash" name="addInitialCash" checked>
      <label for="addInitialCash">${game.i18n.localize('SDM.CharacterGenerator.AddInitialCash')}</label>
    </div>
  </div>
</fieldset>
`;

  // Create dialog instance
  const data = await DialogV2.wait({
    window: { title: game.i18n.localize('SDM.CreateRandomCharacter') },
    content,
    buttons: [
      {
        action: 'generate',
        label: game.i18n.localize('SDM.GenerateCharacter'),
        icon: 'fa-solid fa-user-plus',
        callback: (event, button) => {
          const formData = new foundry.applications.ux.FormDataExtended(button.form).object;
          return formData;
        }
      },
      {
        action: 'cancel',
        label: game.i18n.localize('SDM.ButtonCancel'),
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

  // Generate the character with the selected options
  await generateCharacterWithOptions(data);
}

async function generateCharacterWithOptions(options = {}) {
  try {
    let name = options.manualName || (await generateNameFromTable());
    if (!name || name.trim() === '') {
      name = await generateNameFromTable();
    }

    console.debug('name', name);

    // Create the actor
    const newActor = new SdmActor({
      type: ActorType.CHARACTER,
      name
    }).toObject();

    const actor = await SdmActor.create(newActor);

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
    console.debug('background', background);
    // retry
    if (!background) {
      const response = await createRandomBackgroundWithOptions(actor, options.backgroundMethod || 'single');
      console.debug('background', response);
    }

    // Create path trait based on selected method
    if (options.pathMethod === 'specific' && options.pathTable) {
      // Use specific path table
      const pathTrait = await createPathTrait(actor, options.pathTable, false);
      console.debug('pathTrait', pathTrait);
    } else {
      // Use current logic
      const pathTrait = await createPathTrait(actor);
      console.debug('pathTrait', pathTrait);
    }

    // Add free trait
    const freeTrait = await createFreeTrait(actor);
    console.debug('freeTrait', freeTrait);

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
    ui.notifications.info(game.i18n.format('SDM.CharacterGenerated', { name }));

    return actor;
  } catch (error) {
    console.error('Error generating character:', error);
    ui.notifications.error(
      game.i18n.format('SDM.CharacterGenerationFailed', { error: error.message })
    );
    throw error;
  }
}

export async function generateCharacter() {
  return generateCharacterWithOptions({
    abilityMethod: 'current',
    backgroundMethod: 'single',
    pathMethod: 'current',
    addMotive: true,
    addStrangeItem: true,
    addUsefulKit: true,
    addInitialCash: true
  });
}

export { characterGeneratorDialog };

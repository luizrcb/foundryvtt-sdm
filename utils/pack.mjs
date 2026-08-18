import { compilePack } from '@foundryvtt/foundryvtt-cli';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = process.cwd();

const packs = [
  { name: 'ability_scores', source: 'packs-source/ability_scores' },
  { name: 'armors', source: 'packs-source/armors' },
  { name: 'burdens', source: 'packs-source/burdens' },
  { name: 'consumables', source: 'packs-source/consumables' },
  { name: 'corruption', source: 'packs-source/corruption' },
  { name: 'creatures', source: 'packs-source/creatures' },
  { name: 'gadgets', source: 'packs-source/gadgets' },
  { name: 'handouts', source: 'packs-source/handouts' },
  { name: 'macros', source: 'packs-source/macros' },
  { name: 'motive_table', source: 'packs-source/motive_table' },
  { name: 'names_tables', source: 'packs-source/names_tables' },
  { name: 'npc_generator', source: 'packs-source/npc_generator' },
  { name: 'player_macros', source: 'packs-source/player_macros' },
  { name: 'powers', source: 'packs-source/powers' },
  { name: 'rolltables', source: 'packs-source/rolltables' },
  { name: 'strange_items_table', source: 'packs-source/strange_items_table' },
  { name: 'strange_items', source: 'packs-source/strange_items' },
  { name: 'trait_items', source: 'packs-source/trait_items' },
  { name: 'traits_tables', source: 'packs-source/traits_tables' },
  { name: 'traits', source: 'packs-source/traits' },
  { name: 'wards', source: 'packs-source/wards' },
  { name: 'weapons', source: 'packs-source/weapons' }
];

const yaml = false;
const folders = true;

async function run() {
  for (const pack of packs) {
    console.log(`Packing ${pack.name}...`);
    const inputDir = path.join(PROJECT_ROOT, pack.source);
    const outputDir = path.join(PROJECT_ROOT, 'packs', pack.name);
    await compilePack(inputDir, outputDir, { yaml, recursive: folders });
  }
}

run().catch(err => {
  console.error('Packing failed:', err);
  process.exit(1);
});

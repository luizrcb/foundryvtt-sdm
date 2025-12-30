const { execSync } = require('child_process');

const packs = [
  { name: 'npc_generator', output: 'packs-source/npc_generator'},
  { name: 'rolltables', output: 'packs-source/rolltables' },
  { name: 'macros', output: 'packs-source/macros' },
  { name: 'player_macros', output: 'packs-source/player_macros' },
  { name: 'traits', output: 'packs-source/traits' },
  { name: 'creatures', output: 'packs-source/creatures' },
  { name: 'ability_scores', output: 'packs-source/ability_scores'},
  { name: 'consumables', output: 'packs-source/consumables' },
  { name: 'gadgets', output: 'packs-source/gadgets' },
  { name: 'powers', output: 'packs-source/powers' },
  { name: 'armors', output: 'packs-source/armors' },
  { name: 'wards', output: 'packs-source/wards'},
  { name: 'weapons', output: 'packs-source/weapons'},
  { name: 'handouts', output: 'packs-source/handouts'},
  { name: 'trait_items', output: 'packs-source/trait_items' }
];

try {
  packs.forEach(pack => {
    console.log(`Unpacking ${pack.name}...`);
    execSync(`fvtt package unpack -n "${pack.name}" --outputDirectory "${pack.output}"`, {
      stdio: 'inherit'
    });
  });
} catch (error) {
  console.error('Unpacking failed:', error);
  process.exit(1);
}

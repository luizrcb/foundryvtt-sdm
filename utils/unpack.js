const { execSync } = require('child_process');

const packs = [
  { name: 'ability_scores', output: 'packs-source/ability_scores' },
  { name: 'armors', output: 'packs-source/armors' },
  { name: 'burdens', output: 'packs-source/burdens' },
  { name: 'consumables', output: 'packs-source/consumables' },
  { name: 'corruption', output: 'packs-source/corruption' },
  { name: 'creatures', output: 'packs-source/creatures' },
  { name: 'gadgets', output: 'packs-source/gadgets' },
  { name: 'handouts', output: 'packs-source/handouts' },
  { name: 'macros', output: 'packs-source/macros' },
  { name: 'npc_generator', output: 'packs-source/npc_generator' },
  { name: 'player_macros', output: 'packs-source/player_macros' },
  { name: 'powers', output: 'packs-source/powers' },
  { name: 'rolltables', output: 'packs-source/rolltables' },
  { name: 'trait_items', output: 'packs-source/trait_items' },
  { name: 'traits', output: 'packs-source/traits' },
  { name: 'wards', output: 'packs-source/wards' },
  { name: 'weapons', output: 'packs-source/weapons' }
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

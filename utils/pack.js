const { execSync } = require('child_process');

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
  { name: 'npc_generator', source: 'packs-source/npc_generator' },
  { name: 'player_macros', source: 'packs-source/player_macros' },
  { name: 'powers', source: 'packs-source/powers' },
  { name: 'rolltables', source: 'packs-source/rolltables' },
  { name: 'trait_items', source: 'packs-source/trait_items' },
  { name: 'traits', source: 'packs-source/traits' },
  { name: 'wards', source: 'packs-source/wards' },
  { name: 'weapons', source: 'packs-source/weapons' }
];

try {
  packs.forEach(pack => {
    console.log(`Packing ${pack.name}...`);
    execSync(
      `fvtt package pack -n "${pack.name}" --inputDirectory "${pack.source}" --outputDirectory "packs"`,
      { stdio: 'inherit' }
    );
  });
} catch (error) {
  console.error('Packing failed:', error);
  process.exit(1);
}

const { execSync } = require('child_process');

const packs = [
  { name: 'rolltables', source: 'packs-source/rolltables' },
  { name: 'macros', source: 'packs-source/macros' },
  { name: 'player_macros', source: 'packs-source/player_macros' },
  { name: 'equipment', source: 'packs-source/equipment' },
  { name: 'traits', source: 'packs-source/traits' },
  { name: 'creatures', source: 'packs-source/creatures' }
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

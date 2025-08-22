const fs = require('fs');
const path = require('path');
const archiver = require('archiver');


// Go one level up from __dirname (i.e., project root)
const rootDir = path.join(__dirname, '..');

// Read version
const version = fs.readFileSync(path.join(rootDir, 'version.txt'), 'utf-8').trim();
const outputDir = path.join(rootDir, '../dist');
const outputPath = path.join(outputDir, `sdm-${version}.zip`);

// Ensure directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Create output stream and archive
const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`ZIP created: ${outputPath} (${archive.pointer()} total bytes)`);
});

archive.on('error', err => {
  throw err;
});

archive.pipe(output);

// Add all files except the exclusions
archive.glob('**/*', {
  ignore: [
    '.editorconfig',
    '.git/**',
    '.gitignore',
    '.prettierignore',
    '.prettierrc',
    'dist/**',
    'node_modules/**',
    'package-lock.json',
    'package.json',
    'packs/_source/**',
    'sdm.lock',
    'src/**',
    'utils/**',
    'version.txt',
    'tools/**',
    '.vscode/**',
    'foundry-config-example.yaml',
    'foundry-config.yaml',
    'foundry/**',
    'jsconfig.json',
  ]
});

archive.finalize();

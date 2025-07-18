const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Read version
const version = fs.readFileSync('version.txt', 'utf-8').trim();
const outputDir = path.join(__dirname, '../dist');
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
    'buildMacros.js',
    'node_modules/**',
    'package-lock.json',
    'package.json',
    'src/**',
    'version.txt',
    'dist/**',
    'zipBuild.js',
    'sdm.lock'
  ]
});

archive.finalize();

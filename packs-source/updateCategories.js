const fs = require('fs');
const path = require('path');

/**
 * Recursively get all .json files in a directory
 */
function findJsonFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            results = results.concat(findJsonFiles(fullPath));
        } else if (item.isFile() && path.extname(item.name) === '.json') {
            results.push(fullPath);
        }
    }
    return results;
}

/**
 * Update categories in a single JSON file
 * Returns true if file was modified, false otherwise
 */
function updateFile(filePath, mapping) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);

        // Check if this file has an _id that exists in mapping
        if (data._id && mapping[data._id]) {
            const newCategories = mapping[data._id].categories;

            // Ensure system.categories exists and set it
            if (!data.system) data.system = {};
            data.system.categories = newCategories;

            // Write back with proper formatting (2 spaces indent)
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
            console.log(`Updated: ${filePath} (${data._id})`);
            return true;
        }
        return false;
    } catch (err) {
        console.error(`Error processing ${filePath}:`, err.message);
        return false;
    }
}

// --- Main ---

// Arguments: node update_categories.js <root_directory> <mapping_file>
const rootDir = process.argv[2];
const mappingFile = process.argv[3];

if (!rootDir || !mappingFile) {
    console.error('Usage: node update_categories.js <root_directory> <mapping_file.json>');
    process.exit(1);
}

if (!fs.existsSync(rootDir)) {
    console.error(`Directory not found: ${rootDir}`);
    process.exit(1);
}

if (!fs.existsSync(mappingFile)) {
    console.error(`Mapping file not found: ${mappingFile}`);
    process.exit(1);
}

// Load mapping
const mappingContent = fs.readFileSync(mappingFile, 'utf8');
let mapping;
try {
    mapping = JSON.parse(mappingContent);
} catch (err) {
    console.error('Invalid JSON in mapping file:', err.message);
    process.exit(1);
}

console.log(`Searching for JSON files in: ${rootDir}`);
const jsonFiles = findJsonFiles(rootDir);
console.log(`Found ${jsonFiles.length} JSON files.`);

let updatedCount = 0;
for (const file of jsonFiles) {
    if (updateFile(file, mapping)) {
        updatedCount++;
    }
}

console.log(`Done. Updated ${updatedCount} files.`);

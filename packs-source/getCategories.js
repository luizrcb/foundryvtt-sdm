const fs = require("fs");
const path = require("path");

const rootFolder = "./"; // Change this to the folder you want to scan

const categories = new Set();

function scanFolder(folder) {
  const entries = fs.readdirSync(folder, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(folder, entry.name);

    if (entry.isDirectory()) {
      scanFolder(fullPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) {
      continue;
    }

    try {
      const json = JSON.parse(fs.readFileSync(fullPath, "utf8"));

      const values = json?.system?.categories;

      if (Array.isArray(values)) {
        for (const value of values) {
          categories.add(value);
        }
      }
    } catch (error) {
      console.error(`Failed to read ${fullPath}:`, error.message);
    }
  }
}

scanFolder(rootFolder);

console.log("Unique categories:");
console.log([...categories].sort());
console.log(`\nTotal: ${categories.size}`);

const fs = require('fs');
const path = require('path');
const os = require('os');

const dir = path.join(os.homedir(), 'Documents/vscode-toolkit/assets');

function traverse(currentDir) {
  if (!fs.existsSync(currentDir)) {
    console.log('Directory not found:', currentDir);
    return;
  }
  const files = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(currentDir, file.name);
    if (file.isDirectory()) {
      traverse(fullPath);
    } else if (file.isFile() && file.name.endsWith('.json')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const value = JSON.parse(content);
        if (value && typeof value === 'object' && typeof value.id === 'string' && value.type === 'database') {
          console.log(`Fixing ${fullPath} with type mysql`);
          value.type = 'mysql';
          fs.writeFileSync(fullPath, JSON.stringify(value, null, 2));
        }
      } catch (e) {
        console.error('Error processing', fullPath, e);
      }
    }
  }
}

traverse(dir);
console.log('Done');

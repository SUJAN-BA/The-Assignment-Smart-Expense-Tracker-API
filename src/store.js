const fs = require('fs');
const path = require('path');


function getDataFile() {
  return process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'expenses.json');
}


function readAll() {
  const file = getDataFile();

  if (!fs.existsSync(file)) {
    return [];
  }

  const raw = fs.readFileSync(file, 'utf-8').trim();
  if (raw === '') {
    return [];
  }

  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw new Error(`The data file ${file} is not valid JSON. Please fix or delete it.`);
  }
}


function writeAll(expenses) {
  const file = getDataFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tempFile = `${file}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(expenses, null, 2), 'utf-8');
  fs.renameSync(tempFile, file);
}

module.exports = { readAll, writeAll, getDataFile };

import fs from 'node:fs';
import path from 'node:path';

/**
 * Reads the database baseline from the JSON file.
 * Returns the files dictionary or an empty object if database doesn't exist.
 * @param {string} dbPath 
 * @returns {object} The baseline files dictionary
 */
export function getBaseline(dbPath) {
  if (!fs.existsSync(dbPath)) {
    return {};
  }
  try {
    const rawData = fs.readFileSync(dbPath, 'utf8');
    const parsed = JSON.parse(rawData);
    return parsed.files || {};
  } catch (err) {
    console.error(`Warning: Failed to read or parse baseline database '${dbPath}'. Returning empty baseline.`);
    return {};
  }
}

/**
 * Initializes/resets the baseline database structure.
 * @param {string} dbPath 
 * @param {string} targetDir 
 */
export function initDb(dbPath, targetDir) {
  const data = {
    created_at: new Date().toISOString(),
    target_dir: path.resolve(targetDir),
    files: {}
  };
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Saves or updates a single file record in the baseline JSON database.
 * @param {string} dbPath 
 * @param {string} filepath 
 * @param {string} sha256 
 * @param {number} lastModified 
 * @param {number} size 
 */
export function saveFileRecord(dbPath, filepath, sha256, lastModified, size) {
  let dbData = { created_at: new Date().toISOString(), target_dir: '', files: {} };
  
  if (fs.existsSync(dbPath)) {
    try {
      dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (err) {
      // If corrupted, we will overwrite
    }
  }
  
  dbData.files = dbData.files || {};
  dbData.files[path.resolve(filepath)] = {
    sha256,
    last_modified: lastModified,
    size
  };
  
  fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8');
}

/**
 * Removes a file record from the baseline database.
 * @param {string} dbPath 
 * @param {string} filepath 
 */
export function removeFileRecord(dbPath, filepath) {
  if (!fs.existsSync(dbPath)) return;
  
  try {
    const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    dbData.files = dbData.files || {};
    const resolvedPath = path.resolve(filepath);
    
    if (dbData.files[resolvedPath]) {
      delete dbData.files[resolvedPath];
      fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8');
    }
  } catch (err) {
    console.error(`Error removing file from baseline: ${err.message}`);
  }
}

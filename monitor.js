import fs from 'node:fs';
import path from 'node:path';
import { calculateSha256 } from './hasher.js';
import { getBaseline, initDb, saveFileRecord, removeFileRecord } from './database.js';

/**
 * Recursively scans a directory for files, ignoring the database file itself.
 * @param {string} dir 
 * @param {string} dbPath 
 * @param {string[]} filesList 
 * @returns {string[]} List of absolute file paths
 */
function getFilesRecursively(dir, dbPath, filesList = []) {
  const absoluteDbPath = path.resolve(dbPath);
  let items = [];
  
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    console.error(`Warning: Could not read directory '${dir}': ${err.message}`);
    return filesList;
  }
  
  for (const item of items) {
    const res = path.resolve(dir, item.name);
    if (res === absoluteDbPath) {
      continue; // Skip the baseline database file
    }
    
    try {
      if (item.isDirectory()) {
        getFilesRecursively(res, dbPath, filesList);
      } else if (item.isFile()) {
        filesList.push(res);
      }
    } catch (err) {
      console.error(`Warning: Skipping filesystem item '${res}': ${err.message}`);
    }
  }
  
  return filesList;
}

/**
 * Scan a directory recursively and return its current integrity metadata map.
 * @param {string} directoryPath 
 * @param {string} dbPath 
 * @returns {Promise<object>} Map of file path to metadata {sha256, last_modified, size}
 */
export async function scanDirectory(directoryPath, dbPath) {
  const resolvedDir = path.resolve(directoryPath);
  if (!fs.existsSync(resolvedDir)) {
    console.error(`Error: Directory '${directoryPath}' does not exist.`);
    return {};
  }
  
  const filePaths = getFilesRecursively(resolvedDir, dbPath);
  const metadata = {};
  
  for (const filepath of filePaths) {
    try {
      const stat = fs.statSync(filepath);
      const sha256 = await calculateSha256(filepath);
      
      metadata[filepath] = {
        sha256,
        last_modified: stat.mtimeMs,
        size: stat.size
      };
    } catch (err) {
      console.error(`Warning: Skipping file '${filepath}' due to read error: ${err.message}`);
    }
  }
  
  return metadata;
}

/**
 * Compare current directory files against the database baseline.
 * @param {string} directoryPath 
 * @param {string} dbPath 
 * @returns {Promise<{added: string[], modified: string[], deleted: string[]}>}
 */
export async function checkIntegrity(directoryPath, dbPath) {
  const baseline = getBaseline(dbPath);
  const current = await scanDirectory(directoryPath, dbPath);
  
  const added = [];
  const modified = [];
  const deleted = [];
  
  // Find added and modified files
  for (const [filepath, currMeta] of Object.entries(current)) {
    const baseMeta = baseline[filepath];
    
    if (!baseMeta) {
      added.push(filepath);
    } else {
      // Check if file integrity changed
      if (currMeta.sha256 !== baseMeta.sha256) {
        modified.push(filepath);
      }
    }
  }
  
  // Find deleted files
  for (const filepath of Object.keys(baseline)) {
    if (!current[filepath]) {
      deleted.push(filepath);
    }
  }
  
  return {
    added: added.sort(),
    modified: modified.sort(),
    deleted: deleted.sort()
  };
}

/**
 * Re-scan and initialize the baseline database.
 * @param {string} directoryPath 
 * @param {string} dbPath 
 */
export async function initializeBaseline(directoryPath, dbPath) {
  const resolvedDir = path.resolve(directoryPath);
  initDb(dbPath, resolvedDir);
  
  const currentFiles = await scanDirectory(resolvedDir, dbPath);
  
  for (const [filepath, meta] of Object.entries(currentFiles)) {
    saveFileRecord(dbPath, filepath, meta.sha256, meta.last_modified, meta.size);
  }
  
  console.log(`Successfully initialized baseline with ${Object.keys(currentFiles).length} files.`);
}

/**
 * Update baseline record for a specific file.
 * @param {string} filepath 
 * @param {string} dbPath 
 */
export async function updateFileBaseline(filepath, dbPath) {
  const resolvedPath = path.resolve(filepath);
  
  if (!fs.existsSync(resolvedPath)) {
    // File deleted on disk: remove it from baseline database
    removeFileRecord(dbPath, resolvedPath);
    console.log(`Removed '${resolvedPath}' from baseline (file does not exist on disk).`);
    return;
  }
  
  try {
    const stat = fs.statSync(resolvedPath);
    const sha256 = await calculateSha256(resolvedPath);
    saveFileRecord(dbPath, resolvedPath, sha256, stat.mtimeMs, stat.size);
    console.log(`Updated baseline for file '${resolvedPath}'.`);
  } catch (err) {
    console.error(`Error updating baseline for '${resolvedPath}': ${err.message}`);
  }
}

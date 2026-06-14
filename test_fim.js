import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { calculateSha256 } from './hasher.js';
import { getBaseline } from './database.js';
import { initializeBaseline, checkIntegrity, updateFileBaseline } from './monitor.js';

// Setup temp folder helper
function createTempDir() {
  const tmpBase = os.tmpdir();
  const dirPath = fs.mkdtempSync(path.join(tmpBase, 'fim-test-'));
  return dirPath;
}

test('File Integrity Monitor Tests', async (t) => {
  const tempDir = createTempDir();
  const dbPath = path.join(tempDir, 'test_baseline.json');
  
  const file1 = path.join(tempDir, 'file1.txt');
  const file2 = path.join(tempDir, 'file2.txt');
  
  // Create initial files
  fs.writeFileSync(file1, 'Hello, World!', 'utf8');
  fs.writeFileSync(file2, 'Cybersecurity is fun.', 'utf8');

  t.after(() => {
    // Cleanup temporary files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (err) {
      console.error('Failed to cleanup temp dir:', err);
    }
  });

  await t.test('1. Initialize baseline database', async () => {
    await initializeBaseline(tempDir, dbPath);
    
    // Assert DB exists
    assert.ok(fs.existsSync(dbPath), 'Database file should be created');
    
    // Read baseline and assert structure
    const baseline = getBaseline(dbPath);
    const resolvedFile1 = path.resolve(file1);
    const resolvedFile2 = path.resolve(file2);
    
    assert.strictEqual(Object.keys(baseline).length, 2, 'Baseline should contain 2 files');
    assert.ok(baseline[resolvedFile1], 'file1.txt should be in baseline');
    assert.ok(baseline[resolvedFile2], 'file2.txt should be in baseline');
    
    // Verify hash matches
    const file1Hash = await calculateSha256(file1);
    assert.strictEqual(baseline[resolvedFile1].sha256, file1Hash, 'Hash in database must match calculated hash');
  });

  await t.test('2. Integrity check on clean directory', async () => {
    const results = await checkIntegrity(tempDir, dbPath);
    assert.strictEqual(results.added.length, 0, 'No added files expected');
    assert.strictEqual(results.modified.length, 0, 'No modified files expected');
    assert.strictEqual(results.deleted.length, 0, 'No deleted files expected');
  });

  await t.test('3. Detect added files', async () => {
    const file3 = path.join(tempDir, 'file3.txt');
    fs.writeFileSync(file3, 'Intruder file contents.', 'utf8');
    
    const results = await checkIntegrity(tempDir, dbPath);
    assert.strictEqual(results.added.length, 1, 'Should detect 1 added file');
    assert.strictEqual(results.added[0], path.resolve(file3), 'Should match file3 absolute path');
    assert.strictEqual(results.modified.length, 0, 'No modified files expected');
    assert.strictEqual(results.deleted.length, 0, 'No deleted files expected');
    
    // Cleanup file3 for next tests
    fs.unlinkSync(file3);
  });

  await t.test('4. Detect modified files', async () => {
    fs.writeFileSync(file1, 'Modified content!', 'utf8');
    
    const results = await checkIntegrity(tempDir, dbPath);
    assert.strictEqual(results.added.length, 0, 'No added files expected');
    assert.strictEqual(results.modified.length, 1, 'Should detect 1 modified file');
    assert.strictEqual(results.modified[0], path.resolve(file1), 'Should match file1 absolute path');
    assert.strictEqual(results.deleted.length, 0, 'No deleted files expected');
  });

  await t.test('5. Detect deleted files', async () => {
    fs.unlinkSync(file2);
    
    const results = await checkIntegrity(tempDir, dbPath);
    assert.strictEqual(results.added.length, 0, 'No added files expected');
    // Note: file1 is still modified from the previous test
    assert.strictEqual(results.modified.length, 1, 'Should detect 1 modified file (file1)');
    assert.strictEqual(results.deleted.length, 1, 'Should detect 1 deleted file (file2)');
    assert.strictEqual(results.deleted[0], path.resolve(file2), 'Should match file2 absolute path');
  });

  await t.test('6. Update baseline for modified file', async () => {
    // Before update: file1 is modified
    let results = await checkIntegrity(tempDir, dbPath);
    assert.strictEqual(results.modified.length, 1);
    
    // Perform baseline update for file1
    await updateFileBaseline(file1, dbPath);
    
    // After update: file1 should be verified/clean
    results = await checkIntegrity(tempDir, dbPath);
    assert.strictEqual(results.modified.length, 0, 'Modified files count should be 0 after update');
  });
});

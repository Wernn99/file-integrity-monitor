import fs from 'node:fs';
import path from 'node:path';
import { initializeBaseline, checkIntegrity, updateFileBaseline } from './monitor.js';

const DEFAULT_DB_NAME = 'fim_baseline.json';

function printHelp() {
  console.log(`
FIM - A lightweight, zero-dependency File Integrity Monitor in Node.js

Usage:
  node fim.js <command> [options]

Commands:
  init [dir]                     Establish/Reset baseline for a directory (default: current directory)
  check [dir]                    Perform a one-time integrity check (default: current directory)
  monitor [dir]                  Continuously monitor a directory for changes (default: current directory)
  update <files...>              Approve and update the baseline for specific files

Options:
  --db <path>                    Path to the baseline database JSON file (default: fim_baseline.json in target directory)
  --interval <seconds>           Verification interval in seconds for continuous monitoring (default: 5)

Examples:
  node fim.js init .
  node fim.js check .
  node fim.js monitor . --interval 2
  node fim.js update src/critical_file.js
  `);
}

// Simple manual CLI parser to keep project zero-dependency
function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];
  const remaining = args.slice(1);
  
  let targetDir = '.';
  let db = null;
  let interval = 5;
  const files = [];

  // Parse specific commands
  if (command === 'update') {
    // Collect all arguments that don't start with '--' as files
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i] === '--db') {
        db = remaining[++i];
      } else {
        files.push(remaining[i]);
      }
    }
  } else {
    // For init, check, monitor: first positional argument (if not an option) is targetDir
    let dirIndex = -1;
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i] === '--db') {
        db = remaining[++i];
      } else if (remaining[i] === '--interval') {
        interval = parseInt(remaining[++i], 10) || 5;
      } else if (!remaining[i].startsWith('--') && dirIndex === -1) {
        targetDir = remaining[i];
        dirIndex = i;
      }
    }
  }

  return { command, targetDir, db, interval, files };
}

function printResults({ added, modified, deleted }) {
  if (added.length === 0 && modified.length === 0 && deleted.length === 0) {
    console.log(" -> File integrity verified: No changes detected.");
    return;
  }

  if (added.length > 0) {
    console.log("\n[+] Added Files:");
    added.forEach(f => console.log(`    - ${f}`));
  }

  if (modified.length > 0) {
    console.log("\n[!] Modified Files (INTEGRITY FAILED):");
    modified.forEach(f => console.log(`    - ${f}`));
  }

  if (deleted.length > 0) {
    console.log("\n[-] Deleted Files:");
    deleted.forEach(f => console.log(`    - ${f}`));
  }
}

async function main() {
  const { command, targetDir, db, interval, files } = parseArgs();
  const targetPath = path.resolve(targetDir);
  
  // Set DB path
  const dbPath = db ? path.resolve(db) : path.join(targetPath, DEFAULT_DB_NAME);

  switch (command) {
    case 'init':
      console.log(`[*] Initializing baseline for: ${targetPath}`);
      console.log(`[*] Baseline DB: ${dbPath}`);
      await initializeBaseline(targetPath, dbPath);
      break;

    case 'check':
      if (!fs.existsSync(dbPath)) {
        console.error(`Error: Baseline database '${dbPath}' not found. Run 'init' command first.`);
        process.exit(1);
      }
      console.log(`[*] Checking integrity for: ${targetPath}`);
      console.log(`[*] Baseline DB: ${dbPath}`);
      const results = await checkIntegrity(targetPath, dbPath);
      printResults(results);
      break;

    case 'monitor':
      if (!fs.existsSync(dbPath)) {
        console.error(`Error: Baseline database '${dbPath}' not found. Run 'init' command first.`);
        process.exit(1);
      }
      console.log(`[*] Starting continuous monitoring for: ${targetPath}`);
      console.log(`[*] Baseline database: ${dbPath}`);
      console.log(`[*] Check interval: ${interval}s`);
      console.log("[*] Press Ctrl+C to stop.\n" + "=".repeat(50));

      const runCheck = async () => {
        const checkResults = await checkIntegrity(targetPath, dbPath);
        const timestamp = new Date().toLocaleString();
        
        if (checkResults.added.length > 0 || checkResults.modified.length > 0 || checkResults.deleted.length > 0) {
          console.log(`\n[!] ALERT: Security alert at ${timestamp}!`);
          printResults(checkResults);
          console.log("=".repeat(50));
        }
      };

      // Run initial check and set interval
      await runCheck();
      const intervalId = setInterval(runCheck, interval * 1000);

      // Graceful shutdown
      process.on('SIGINT', () => {
        clearInterval(intervalId);
        console.log("\n[*] Monitoring stopped by user.");
        process.exit(0);
      });
      break;

    case 'update':
      // For updates, the DB is resolved relative to CWD if --db is omitted
      const updateDbPath = db ? path.resolve(db) : path.resolve(DEFAULT_DB_NAME);
      if (!fs.existsSync(updateDbPath)) {
        console.error(`Error: Baseline database '${updateDbPath}' not found.`);
        process.exit(1);
      }

      if (files.length === 0) {
        console.error("Error: Please specify one or more files to update.");
        process.exit(1);
      }

      for (const file of files) {
        await updateFileBaseline(file, updateDbPath);
      }
      break;

    default:
      console.error(`Error: Unknown command '${command}'`);
      printHelp();
      process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal Error:", err);
  process.exit(1);
});

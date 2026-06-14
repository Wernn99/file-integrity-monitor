# File Integrity Monitor (FIM)

A lightweight, zero-dependency command-line **File Integrity Monitor (FIM)** built in Node.js. 

This security tool allows you to establish a cryptographic baseline of a target directory (calculating SHA-256 hashes of all files) and monitor it for unauthorized modifications, additions, or deletions. It is ideal for monitoring system configuration directories, web server document roots, or application source directories.

---

## How it Works

```
                     ┌────────────────────────┐
                     │   Target Directory     │
                     └──────────┬─────────────┘
                                │
                       [ Scans & Computes ]
                                │
                                ▼
  ┌──────────────────┐    ┌──────────┐    ┌──────────────────┐
  │ Added Files      │◄───┤  FIM.JS  ├───►│ Deleted Files    │
  │ (Not in DB)      │    └────┬─────┘    │ (In DB, not disk)│
  └──────────────────┘         │          └──────────────────┘
                               │
                       [ SHA-256 Compare ]
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Modified Files     │
                    │ (Hash Mismatch)     │
                    └─────────────────────┘
```

1. **Initialize (`init`)**: Scans a target directory, hashes all files using SHA-256, and stores their path, last modified time, and size in a JSON baseline file.
2. **Audit (`check`)**: Performs a one-time scan and compares current files against the baseline database, reporting any modifications, additions, or deletions.
3. **Monitor (`monitor`)**: Continually checks files at a regular interval and prints security alerts immediately when an anomaly is detected.
4. **Approve (`update`)**: Allows administrators to approve file modifications, updating the baseline database with the new file attributes.

---

## Features

- 🔒 **Cryptographic Assurance**: Uses SHA-256 hashing to verify file content integrity.
- 🚀 **Zero Dependencies**: Relies 100% on Node.js standard libraries (`crypto`, `fs`, `path`, etc.). No `npm install` required.
- 💾 **Memory Efficient**: Reads and hashes large files in chunks using Node.js streams to prevent memory exhaustion.
- ⚡ **Lightweight JSON Database**: Uses a plain text JSON file to keep the baseline portable and human-readable.
- ⚙️ **Configurable Polling**: Custom alert interval times for active continuous monitoring.

---

## Installation & Setup

Ensure you have **Node.js** (v18.0.0 or later) installed on your system.

1. Clone or download this repository:
   ```bash
   git clone https://github.com/yourusername/file-integrity-monitor.git
   cd file-integrity-monitor
   ```

2. Run the built-in tests to confirm everything is functional:
   ```bash
   npm test
   ```

---

## CLI Usage Reference

### 1. Initialize Directory Baseline
Establish a baseline for a specific directory. This creates a database named `fim_baseline.json` inside the target directory:
```bash
node fim.js init [dir]
```
*Example:*
```bash
node fim.js init ./src
```

### 2. Run a One-Time Integrity Check
Compare the current state of the directory with the saved baseline:
```bash
node fim.js check [dir]
```
*Example Output:*
```text
[*] Checking integrity for: C:\projects\my-app\src
[*] Baseline DB: C:\projects\my-app\src\fim_baseline.json

[+] Added Files:
    - C:\projects\my-app\src\unauthorized_script.js

[!] Modified Files (INTEGRITY FAILED):
    - C:\projects\my-app\src\index.js

[-] Deleted Files:
    - C:\projects\my-app\src\config.json
```

### 3. Continuous Active Monitoring
Monitor a directory in real-time, checking for modifications every `N` seconds (default is 5 seconds):
```bash
node fim.js monitor [dir] --interval [seconds]
```
*Example:*
```bash
node fim.js monitor ./src --interval 2
```

### 4. Approve Authorized Changes
If you intentionally modify files, update their record in the baseline so they are not flagged as threats:
```bash
node fim.js update [files...] --db [path_to_baseline_db]
```
*Example:*
```bash
node fim.js update ./src/index.js --db ./src/fim_baseline.json
```

---

## Cybersecurity Relevance (Use Cases)

- **Web Shell & Malware Detection**: Monitor public-facing web server directories (e.g., `var/www/html`). Attackers uploading backdoor scripts (web shells) will be immediately flagged as **Added Files**.
- **Tamper Detection**: Monitor application files (`index.js`, `main.py`). Attackers injecting malicious dependencies or payload code into existing files will be caught by the **Modified Files** warning.
- **Config Auditing**: Secure configuration paths (e.g., `/etc/` or custom settings directories). Unauthorized user account additions or permissions modifications will trigger integrity alerts.

---

## Future Enhancements

- **Alert Webhooks**: Add integration to send slack, discord, or email alerts when modifications are found.
- **Encrypted Database**: Sign the JSON baseline using a secret passphrase or public key cryptosystem so that attackers cannot modify the baseline file itself to hide their actions.
- **File Exclusion List**: Add regex support to ignore temporary/cache directories or log files (e.g., `.log`, `tmp/`).

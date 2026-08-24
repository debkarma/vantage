# Vantage CLI Reference Guide

Vantage provides a powerful, flexible CLI for recording, replaying, and exporting API tests. This document serves as a comprehensive reference for all available commands and flags.

---

## ⏺️ 1. Record Mode
Starts the Vantage reverse proxy to intercept and record incoming HTTP traffic as test cases.

```bash
vantage record [options]
```

### Options:
- `--port <number>`
  **Default:** `6789` (or `record_port` in `vantage.config.yaml`)
  The port that the Vantage proxy server will listen on. You should send your API requests (via Postman, curl, or frontend) to this port instead of your actual application port.

- `-c, --command <string>`
  **Default:** None.
  A terminal command to automatically spawn your target application before recording starts. Vantage will inject the dynamic Testcontainer database URLs into the environment variables of this process.

- `--proxy <number>`
  **Default:** None.
  Enables **Reverse Proxy Mode**. If your backend is written in Python, Go, or another language, you cannot use the Vantage Express SDK middleware. Instead, specify the port your app listens on (e.g., `5000`). Vantage will start on the `--port` (e.g., `6789`) and blindly proxy all traffic to your app on the `--proxy` port, recording the traffic transparently.

### Examples:
```bash
# Start recording on default port 6789 (requires the Express SDK middleware in your app)
vantage record

# Auto-start a Python FastAPI app and act as a reverse proxy in front of it!
# Send Postman traffic to port 6789, and it will be recorded and proxied to FastAPI on port 5000.
vantage record -c "python main.py" --proxy 5000
```

---

## ♻️ 2. Test Mode
Replays recorded test cases against your application to verify behavior and catch regressions.

```bash
vantage test [options]
```

### Options:
- `--target <url>`
  **Default:** `http://localhost:3000` (uses `app_port` from config)
  The base URL of the target application to run the tests against.
  *(Tip: If testing locally with Node 18+, use `http://127.0.0.1:3000` instead of `localhost` to avoid IPv6 resolution issues).*

- `--test-set <name>`
  **Default:** The most recently recorded test set.
  Specify a specific test set to replay (e.g., `test-set-1`, `test-set-2`).

- `-c, --command <string>`
  **Default:** None.
  A terminal command to automatically spawn your target application before the tests run. Vantage will inject the dynamic Testcontainer database URLs into the environment variables of this process.
  
- `--delay <seconds>`
  **Default:** `3` (if `--command` is used), otherwise `0`.
  The number of seconds Vantage should wait after spawning the `--command` before firing the first test request. Useful for giving frameworks like FastAPI or Express time to compile and bind to the port.

- `--ci`
  **Default:** `false`
  Headless mode for CI/CD pipelines (like GitHub Actions). Disables the interactive terminal UI, outputs a standard `junit.xml` report, and exits with a strict `1` status code if any tests fail.

- `--watch`
  **Default:** `false`
  Developer mode. Watches the current project directory for file changes. Upon saving any file, automatically tears down the containers, kills the app, and re-runs the entire test suite in the background.

### Examples:
```bash
# Replay the latest test set against a running app
vantage test

# Replay test-set-3 against a specific URL
vantage test --test-set test-set-3 --target https://staging.myapp.com

# Auto-start a FastAPI app, wait 10s for it to boot, and run tests
vantage test -c "python main.py" --delay 10

# Run in CI mode for GitHub Actions (Outputs JUnit XML)
vantage test --ci -c "node server.js"

# Run in Watch mode for local active development
vantage test --watch -c "npx tsx server.ts" --target http://127.0.0.1:3000
```

---

## 📋 3. List Mode
Displays all test sets that have been recorded in the current project repository.

```bash
vantage list
```

### Output Example:
```text
 📋 TEST SETS

   test-set-1  —  4 tests
   test-set-2  —  3 tests
   test-set-3  —  8 tests
```

---

## 📤 4. Export Mode
Acts as the "Eject Button" to prevent vendor lock-in. Transpiles a Vantage YAML test set into native Javascript/Python test files using standard libraries (Jest or Pytest).

```bash
vantage export --format <jest|pytest> [options]
```

### Options:
- `--format <jest|pytest>`
  **Required.** The target testing framework to generate code for.

- `--test-set <name>`
  **Default:** The most recently recorded test set.
  The specific test set to export.

- `--out <path>`
  **Default:** `./tests`
  The directory where the generated native test file should be saved.

- `--app-entry <filepath>`
  *(Jest Only)*. The path to your Express `app` instance. If provided, the generated Jest file will use `supertest` to run tests directly against the Express app object without needing a network port!

### Examples:
```bash
# Export the latest test set to Pytest format
vantage export --format pytest

# Export test-set-2 to Pytest in a specific folder
vantage export --format pytest --test-set test-set-2 --out ./backend/tests

# Export to Jest, pointing directly to the Express app file
vantage export --format jest --app-entry ./src/app.ts
```

---

## ℹ️ 5. General Flags

- `-h, --help`
  Displays the built-in help menu and usage instructions in the terminal.

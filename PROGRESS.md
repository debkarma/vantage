# Vantage — Progress Report

Vantage is a Keploy-like API test generation and replay engine designed for seamless developer experience. This document outlines the progress, architectural decisions, and features implemented so far.

---

## ✅ Phase 1: Solid Foundation — CLI, Test Sets, Storage Rewrite

Phase 1 focused on building a robust foundation for HTTP traffic capture, intelligent test generation, and stateful API replay. We delivered a 1-command developer experience that matches Keploy's core capabilities without complex proxies.

### 1. 1-Command CLI Lifecycle Management
- **Single Command Execution:** `-c` flag (`vantage record -c "npm start"`) launches both Vantage and the target application simultaneously.
- **Process Orchestration:** The interactive Ink-based CLI (`src/ui/App.tsx`) spawns the target app as a child process.
- **Zombie Process Prevention:** Robust teardown logic (`taskkill` on Windows) ensures clean termination when tests complete or the user aborts.
- **Port Safety (`EADDRINUSE`):** Explicit error handling prevents the recording server from silently failing if port 6789 is already occupied.

### 2. Express SDK & Traffic Capture
- **Middleware Interceptor (`src/sdk/express.ts`):** Intercepts incoming HTTP requests and responses (status, headers, body) directly within the Express runtime.
- **Background Record Server:** Forwards intercepted traffic to a dedicated CLI background server via `HTTP POST`.
- **Keploy-Style YAML Storage (`src/engine/storage.ts`):**
  - Automatically deduplicates and versions API endpoints into clean slugs (e.g., `get-api-todos-1.yaml`).
  - Saves tests into isolated sets (e.g., `.vantage/test-set-1/tests/`).
  - Captures executable `curl` commands inside each YAML for manual debugging.

### 3. Stateful HTTP Replay Engine
- **Chronological Sorting:** Tests are sorted by `metadata.created_at` before replay so stateful CRUD sequences (`GET → POST → PUT → DELETE → GET`) execute in the exact order they were recorded.
- **Header Sanitization:** Strips hop-by-hop headers (`content-length`, `host`, `connection`, `accept-encoding`) during replay so POST requests never hang due to stale content-length values.
- **Null Body Handling:** Gracefully handles non-JSON responses (e.g., Express default 404 HTML error pages) by verifying status code match without attempting JSON diff.

### 4. Keploy-Style Test Reporting
- Generates clean YAML summary reports in `.vantage/reports/test-run-X/test-set-Y-report.yaml`.
- Never mutates the original recorded test case files.

### 5. Version Control & Repository Setup
- Initialized the Git repository and pushed to `https://github.com/debkarma/vantage.git`.
- Configured `.gitignore` to ignore `node_modules/`, `dist/`, `.log` files, `AGENTS.md`, and `.vantage/`.

---

## ✅ Phase 2: Replay Engine Upgrade, Noise Filtering & Enhanced Reports

Phase 2 upgraded the replay engine with configurable noise filtering, response header comparison, per-test timing, and categorized failure diagnostics.

### 1. Noise Filter Module (`src/engine/noiseFilter.ts`)
- **New module** that strips dynamic/noisy fields before comparison.
- **Header noise:** Case-insensitive removal of configurable headers (e.g., `Date`, `ETag`, `X-Request-Id`) from both expected and actual responses.
- **Body field noise:** Supports dot-notation paths (e.g., `data.createdAt`, `_id`) and handles top-level arrays by applying removal to each element.
- **Non-destructive:** Deep-clones inputs before filtering — recorded YAMLs are never mutated.
- **Configuration:** Reads `noise.headers` and `noise.body_fields` from `.vantage/vantage.config.yaml`.

### 2. Response Header Comparison
- Compares response headers alongside body content.
- **Subset-only comparison:** Only headers present in the recorded YAML are compared. Extra headers the live response returns (like Express's dynamic `ETag`) are ignored to prevent false failures.
- Header diffs are displayed separately from body diffs in the terminal output.

### 3. Per-Test Response Timing
- Each test case is timed using `performance.now()` and reports `timeTakenMs` in milliseconds.
- Terminal output shows timing per test: `✔ get-api-todos-1 (122ms)`.
- Summary box shows total run duration: `Results: 8 passed, 0 failed, 8 total (764ms)`.
- Report YAML includes `time_taken_ms` per test and `total_time_ms` in the summary.

### 4. Failure Categorization
Each failed test is classified into one of four categories:
- `STATUS_CODE_CHANGED` — Status code mismatch between recorded and actual response.
- `BODY_CHANGED` — Response body differs after noise filtering.
- `HEADER_CHANGED` — Response headers differ after noise filtering.
- `CONNECTION_ERROR` — Target app unreachable (axios threw an error).

Terminal output shows: `✖ post-api-todos-1 (89ms) [BODY_CHANGED] (expected: 201, actual: 201)`.

### 5. Enhanced Report Generation
Reports in `.vantage/reports/test-run-X/` now include:
- `total_time_ms` in the summary section.
- `time_taken_ms`, `failure_category`, `body_diff`, and `header_diff` per test.

---

## ✅ Phase 3: Test Code Generation (Jest & Pytest)

Phase 3 focused on providing developers with an "eject button." Developers can export Vantage YAML records into native code test suites if their CI pipeline strictly requires it.

### 1. `vantage export` Command
- Allows developers to export the latest test-set (or a specific one via `--test-set`).
- **Jest / Supertest (`--format jest`)**: Generates Node.js tests using `supertest`. Requires the `--app-entry` flag to import the Express app for in-memory testing.
- **Pytest / HTTPX (`--format pytest`)**: Generates pure End-to-End HTTP tests using Python's `httpx`.

### 2. Export Generation Architecture
- Reads the YAML test files, sanitizes headers (removes hop-by-hop like `content-length`), and dynamically generates standard assertion code (`assert response.status_code == 200` and `assert response.json() == {...}`).

---

## ✅ Phase 4: Production-Grade E2E Orchestration & Smart Noise Filtering

Phase 4 graduated Vantage from a basic API recorder into a full-fledged E2E testing orchestrator capable of testing complex apps (like FastAPI) that require database state and authentication.

### 1. Form Data Proxying
- Added `URLSearchParams` serialization so `application/x-www-form-urlencoded` payloads (like Swagger UI OAuth2 Sign In) are intercepted correctly without corrupting the proxy stream.

### 2. Ephemeral Testcontainers (Docker Integration)
- The engine dynamically parses `.vantage/vantage.config.yaml` to spin up fresh Docker containers immediately prior to running tests.
- Uses `@testcontainers/postgresql` (and supports generic containers) to provide an isolated database for every test run.
- Automatically maps random host ports and dynamically sets the resulting `DATABASE_URL` environment variable for the child app process.
- Force-kills containers when tests finish.

### 3. Smart Noise Filtering (Regex Auto-Masking)
- **Automatic Masking**: Vantage uses intelligent Regex pattern matching to automatically identify and mask standard UUIDs, JWT tokens, and ISO-8601 Timestamps.
- **YAML Native Date Handling**: Explicitly intercepts and masks native JavaScript `Date` objects which are automatically parsed by standard YAML decoders when reading timestamps from test files.
- Automatically normalizes both the `expected` and `actual` payloads to `<AUTO_MASKED_DATE>`, `<AUTO_MASKED_UUID>`, and `<AUTO_MASKED_JWT>` before `diffJson` is called, ensuring that volatile backend tokens never cause false test failures.

---

## 🟡 Current Limitations & Constraints

### 1. Black Box Nature of Exported Tests
The `pytest` and `jest` exporters generate pure End-to-End network tests. 
- **Limitation**: The exported tests do not carry over Vantage's powerful orchestrator. They will not automatically spin up ephemeral Docker containers or start the FastAPI backend. Developers running the exported code must manage the server and database lifecycle manually.

### 2. Database Seeding Paradigm
- **Limitation**: Because Vantage spins up an *empty* ephemeral container for every test run, the test suite must be entirely self-contained. The suite must begin with setup requests (like `POST /signup`) to seed the database with necessary entities. If a developer runs tests out of order, the replay will fail because the database is empty.

### 3. Smart Masking Boundaries
- **Limitation**: While standard timestamps and UUIDs are caught cleanly, non-standard volatile strings (such as dynamically generated filenames like `/uploads/1787410452-cover.jpeg`) cannot be safely auto-masked without risking false positives. Developers must manually configure these specific paths in the `vantage.config.yaml` `body_fields` block.

---

## 🔜 Next Steps / Pending Features
- **CI Native Flag (`--ci`)**: Generate standard JUnit XML reports and emit proper non-zero exit codes upon failure for seamless GitHub Actions integration.
- **Watch Mode (`--watch`)**: A file-watcher to auto-re-record or auto-replay tests dynamically when code changes.

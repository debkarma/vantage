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

## ⏭️ Phase 3: Test Code Generation (Not Started)

Convert recorded YAML test cases into native test files (Jest/Supertest, Pytest/httpx) that run independently without Vantage.

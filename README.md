# ⚡ Vantage

**Vantage** is an ultra-fast, zero-config API testing tool that automatically generates and replays end-to-end tests by intercepting your HTTP traffic. 

No more writing tedious boilerplate tests. Just start your app, run your standard manual test flows (via Postman, curl, or your frontend), and Vantage will automatically record the requests, responses, and database state.

It takes the magic of enterprise API testing platforms (like Keploy) and distills it into an incredibly lightweight, fast, open-source CLI tailored for the modern JavaScript ecosystem.

---

## 🚀 Features

- 📹 **Traffic Recording**: Instantly intercept and record incoming HTTP traffic to your local server.
- ♻️ **Deterministic Replay**: Auto-provisions isolated, ephemeral databases via **Testcontainers** for 100% deterministic test execution.
- 🎭 **Smart Masking**: Automatically ignores volatile JSON fields (like `updatedAt`, timestamps, and UUIDs) when diffing responses.
- 🤖 **CI Native**: Built-in `--ci` mode natively outputs standard **JUnit XML** for seamless GitHub Actions / GitLab CI integration.
- ⚡ **Watch Mode**: Run `vantage test --watch` for instant background hot-reloading during local development.
- 📤 **Eject Button**: Don't want vendor lock-in? Export your entire test suite to native `pytest` or `jest` test files instantly.

---

## 📦 Installation

Install Vantage globally to use the CLI anywhere on your machine:

```bash
npm install -g vantage-cli
```

Or run it directly via npx without installing:

```bash
npx vantage-cli
```

---

## 🛠️ Quick Start

### 1. Record Traffic
Start your application behind the Vantage proxy (defaults to port `6789`). Vantage will forward all traffic to your app (defaults to port `3000`).

```bash
vantage record --port 6789
```

Now, make requests to `http://localhost:6789` (e.g. using Postman). Vantage will record every request/response pair as a YAML file inside the `.vantage/` directory.

### 2. Replay Tests
Replay your recorded tests directly against your application. Vantage will diff the HTTP status codes and JSON response bodies to ensure nothing broke.

```bash
vantage test --target http://localhost:3000
```

### 3. CI Pipeline & JUnit Reports
Run tests in headless mode for your CI/CD pipelines. This will skip the interactive UI, enforce strict `process.exit(1)` codes on failure, and generate a `junit.xml` report.

```bash
vantage test --ci
```

---

## ⚙️ Configuration (`vantage.config.yaml`)

You can control exactly how Vantage handles noise (dynamic data) and test environments by modifying the auto-generated `.vantage/vantage.config.yaml` file in your project root.

```yaml
version: 1
app_port: 3000
record_port: 6789
noise:
  # Ignore specific HTTP headers during diffs
  headers:
    - Date
    - ETag
    - X-Request-Id
  # Ignore specific JSON body fields during diffs (like volatile IDs)
  body_fields:
    - id
    - createdAt
    - accessToken
scripts:
  # Optional setup/teardown hooks to run before and after the test suite
  pre_test: "npm run db:reset"
  post_test: "echo 'Tests finished!'"
```

---

## 📤 Exporting (Anti-Vendor Lock-in)

If you decide you want to move away from Vantage and write your tests manually, you can instantly export your recorded YAML test suite into native code!

```bash
# Export to Python (Pytest)
vantage export --format pytest --out ./tests

# Export to JavaScript (Jest)
vantage export --format jest --out ./tests
```

---

## 📝 License

MIT License.

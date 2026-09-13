<p style="text-align:center;" align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./.github/assets/logo-white.png">
    <source media="(prefers-color-scheme: light)" srcset="./.github/assets/logo.png">
    <img src="./.github/assets/logo.png" alt="Vantage Logo" width="30%" />
  </picture>
  <br /><br />
</p>
<p align="center">
<a href="https://github.com/debkarma/vantage/blob/main/LICENSE" alt="LICENSE">
  <img src="https://img.shields.io/github/license/debkarma/vantage?color=brightgreen" /></a>
<a href="https://github.com/debkarma/vantage/actions" alt="Build Status">
  <img src="https://img.shields.io/github/actions/workflow/status/debkarma/vantage/release.yml" /></a>
<br />
</p>

<p align="center">
Vantage is a zero-code API testing tool that automatically generates and replays end-to-end tests by intercepting your HTTP traffic. 
</p>

<p align="center">
By operating as a transparent reverse proxy, Vantage frees you from writing tedious boilerplate tests while ensuring deterministic test execution through ephemeral database provisioning.
</p>
<br />

# Functionality

## Automated Traffic Recording

Vantage intercepts and records HTTP traffic using a lightweight reverse proxy. This architecture is entirely language-agnostic and requires **zero code changes**—whether your backend is built with Node.js, Python, Go, Java, or Ruby.

<details><summary><h4>Smart Response Masking</h4></summary>
Vantage intelligently handles dynamic response data. It automatically ignores volatile JSON fields such as timestamps, JWTs, and UUIDs when diffing responses, preventing flaky tests without requiring manual configuration.
</details>

## Ephemeral Infrastructure

Testing stateful APIs is traditionally difficult because tests mutate database records. Vantage integrates deeply with **Testcontainers** to auto-provision isolated, ephemeral databases before running your tests.

<details><summary><h4>Deterministic Test Execution</h4></summary>
Vantage spins up fresh databases, injects the dynamic connection strings into your application, and tears them down immediately upon completion. This guarantees an isolated, repeatable slate for every test run without requiring manual database resets or cleanup scripts.
</details>

## Continuous Integration & Portability

Vantage is built for automated deployment pipelines. By invoking the CLI with the `--ci` flag, Vantage executes your test suite in headless mode, enforcing strict exit codes and natively outputting standard **JUnit XML** reports for seamless integration with GitHub Actions, GitLab CI, Jenkins, and CircleCI.

<details><summary><h4>Eject to Native Code</h4></summary>
Vantage prevents vendor lock-in by providing a built-in export mechanism. At any time, you can export your entire recorded test suite to native <code>pytest</code> or <code>jest</code> test files.
</details>

<p style="clear:both;">&nbsp;</p>
<div>&nbsp;</div>

## Get Started with Vantage

### Using `vantage-cli`

Vantage is distributed via the npm registry. Install it globally or as a development dependency:

```bash
npm install -g vantage-cli
```

### 1. Record Traffic
Start your application behind the Vantage proxy. Vantage will automatically launch your server and intercept traffic before forwarding it.

```bash
vantage record -c "npm run dev" --proxy 3000
```

Send your requests (via Postman, curl, or your frontend) to the proxy at `http://localhost:6789`. Vantage will record every request and response pair as deterministic YAML files inside the `.vantage/` directory.

### 2. Replay Tests
Replay your recorded tests directly against your application. Vantage will diff the HTTP status codes and JSON response bodies to ensure there are no regressions.

```bash
vantage test -c "npm run dev"
```

## Configuration

Control exactly how Vantage handles noise and external databases by modifying `.vantage/vantage.config.yaml`:

```yaml
noise:
  smart_masking: true
  body_fields:
    - user.lastLogin
  ignore_paths:
    - /_next/
    - .css

containers:
  - type: postgresql
    image: postgres:15-alpine
    env_var: DATABASE_URL

scripts:
  pre_test: "npx prisma db push"
```



## License

This repository and site are available as open-source under the terms of the [MIT License](https://opensource.org/licenses/MIT).

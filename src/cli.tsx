#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { PassThrough } from 'stream';
import { App } from './ui/App.js';

const args = process.argv.slice(2);
const command = args[0];

function parseFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

function printUsage() {
  console.log(`
  Vantage — API Test Generation & Replay

  Usage:
    vantage record  [--port 6789]                                Start recording
    vantage test    [--target http://localhost:3000] [--delay 5]  Replay tests
    vantage list                                                  List test sets
    vantage export  [--format jest|pytest] [--app-entry ./src/app] [--test-set test-set-0] [--out ./tests/]
                                                                  Generate test code

  Options:
    --port        Record server port (default: from config or 6789)
    --target      Target app URL for replay (default: http://localhost:3000)
    --delay       Seconds to wait before replaying (default: 0)
    --ci          Run tests in CI mode (plain text output, JUnit XML, exits 1 on failure)
    --watch       Run tests in watch mode (auto-re-run on file changes)
    --format      Export format: jest or pytest
    --app-entry   App module path for Supertest (Jest only)
    --test-set    Which test set to replay/export (default: latest)
    --out         Output directory for generated tests
    --command, -c Command to start target app automatically (e.g. "npm start")

  Examples:
    vantage record -c "npm run dev:sample"
    vantage test -c "npm run dev:sample" --delay 3
    vantage list
    vantage export --format jest --app-entry ../../src/app
`);
}

if (!command || command === '--help' || command === '-h') {
  printUsage();
  process.exit(0);
}

const validCommands = ['record', 'test', 'list', 'export'];
if (!validCommands.includes(command)) {
  console.error(`Unknown command: "${command}"\n`);
  printUsage();
  process.exit(1);
}

const targetUrl = parseFlag('--target') || undefined;
const recordPort = parseInt(parseFlag('--port') || '6789', 10);
const delay = parseInt(parseFlag('--delay') || '0', 10);
const testSet = parseFlag('--test-set') || undefined;
const exportFormat = parseFlag('--format') as 'jest' | 'pytest' | undefined;
const appEntry = parseFlag('--app-entry') || undefined;
const proxyPort = parseFlag('--proxy') ? parseInt(parseFlag('--proxy')!, 10) : undefined;
const outDir = parseFlag('--out') || undefined;
const appCommand = parseFlag('-c') || parseFlag('--command') || undefined;
const ciMode = args.includes('--ci');
const watchMode = args.includes('--watch');

// When stdin is not a TTY (e.g. piped or background execution) OR in CI mode,
// provide a dummy stream so Ink doesn't crash trying to enable raw mode.
const renderOptions = (!process.stdin.isTTY || ciMode)
  ? { stdin: new PassThrough() as unknown as NodeJS.ReadStream }
  : {};

render(
  <App
    mode={command as 'record' | 'test' | 'list' | 'export'}
    targetUrl={targetUrl}
    recordPort={recordPort}
    delay={delay}
    testSet={testSet}
    exportFormat={exportFormat}
    appEntry={appEntry}
    outDir={outDir}
    appCommand={appCommand}
    proxyPort={proxyPort}
    ciMode={ciMode}
    watchMode={watchMode}
  />,
  renderOptions
);

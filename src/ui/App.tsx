import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { spawn, execSync, ChildProcess } from 'child_process';
import { startRecordServer } from '../engine/recordServer.js';
import {
  loadTestCases,
  listTestSets,
  getNextTestSetIndex,
  createTestSet,
  saveTestReport,
  TestCase,
} from '../engine/storage.js';
import { loadConfig } from '../engine/config.js';
import { runTest, TestResult } from '../engine/replayEngine.js';
import { NoiseConfig } from '../engine/noiseFilter.js';
import { jestGenerator } from '../generators/jest.js';
import { pytestGenerator } from '../generators/pytest.js';
import path from 'path';
import fs from 'fs';
import { startContainers, stopContainers, ContainerState } from '../engine/containers.js';

interface AppProps {
  mode: 'record' | 'test' | 'list' | 'export';
  targetUrl: string;
  recordPort: number;
  delay: number;
  testSet?: string;
  exportFormat?: 'jest' | 'pytest';
  appEntry?: string;
  outDir?: string;
  appCommand?: string;
}

function spawnApp(command: string, mode: 'record' | 'test', extraEnv?: Record<string, string>): ChildProcess {
  const child = spawn(command, {
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      VANTAGE_MODE: mode,
      ...(extraEnv || {}),
    },
  });
  process.on('exit', () => killApp(child));
  return child;
}

function killApp(child?: ChildProcess) {
  if (!child || !child.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${child.pid} /f /t`, { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  } catch (e) {
    // ignore
  }
}

export const App = ({
  mode,
  targetUrl,
  recordPort,
  delay,
  testSet,
  exportFormat,
  appEntry,
  outDir,
  appCommand,
}: AppProps) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testSets, setTestSets] = useState<{ index: number; dir: string; testCount: number }[]>([]);

  useEffect(() => {
    const config = loadConfig();

    if (mode === 'record') {
      const nextIndex = getNextTestSetIndex();
      const testSetDir = createTestSet(nextIndex);

      setLogs(prev => [
        ...prev,
        `Config loaded (app_port: ${config.app_port}, record_port: ${recordPort})`,
        `Created test-set-${nextIndex}`,
        `Record server listening on port ${recordPort}...`,
        appCommand ? `Spawning target app: ${appCommand}` : `Waiting for traffic from your app (add vantageMiddleware and set VANTAGE_MODE=record)`,
      ]);

      const server = startRecordServer(recordPort, testSetDir, config.app_port || 3000, (id, reqPath) => {
        setLogs(prev => [...prev, `[RECORDED] ${id}  ←  ${reqPath}`]);
      });

      let child: ChildProcess | undefined;
      let activeContainers: ContainerState[] = [];

      const startEnv = async () => {
        try {
          if (config.containers && config.containers.length > 0) {
            setLogs(prev => [...prev, `Starting ${config.containers!.length} ephemeral containers...`]);
            activeContainers = await startContainers(config.containers!);
          }
          const extraEnv: Record<string, string> = {};
          for (const c of activeContainers) extraEnv[c.envVar] = c.connectionString;
          
          if (appCommand) child = spawnApp(appCommand, 'record', extraEnv);
        } catch (e: any) {
          setLogs(prev => [...prev, `[ERROR] Failed to start containers: ${e.message}`]);
        }
      };

      startEnv();

      return () => {
        server.close();
        if (child) killApp(child);
        if (activeContainers.length > 0) stopContainers(activeContainers);
      };
    }

    if (mode === 'test') {
      const sets = listTestSets();
      if (sets.length === 0) {
        setLogs(prev => [...prev, 'No test sets found. Run "vantage record" first.']);
        return;
      }

      // Pick the requested test set, or the latest one
      let targetSet: typeof sets[0];
      if (testSet) {
        const match = testSet.match(/^test-set-(\d+)$/);
        const found = match ? sets.find(s => s.index === parseInt(match[1], 10)) : undefined;
        if (!found) {
          setLogs(prev => [...prev, `Test set "${testSet}" not found.`]);
          return;
        }
        targetSet = found;
      } else {
        targetSet = sets[sets.length - 1];
      }

      const cases = loadTestCases(targetSet.dir);
      if (cases.length === 0) {
        setLogs(prev => [...prev, `No test cases in test-set-${targetSet.index}.`]);
        return;
      }

      const waitSeconds = delay > 0 ? delay : (appCommand ? 3 : 0);

      setLogs(prev => [
        ...prev,
        `Replaying test-set-${targetSet.index} (${cases.length} tests) against ${targetUrl}`,
        appCommand ? `Spawning target app: ${appCommand}` : '',
      ].filter(Boolean));

      let child: ChildProcess | undefined;
      const noiseConfig: NoiseConfig = config.noise || { headers: [], body_fields: [] };

      const runAll = async () => {
        let activeContainers: ContainerState[] = [];
        try {
          if (config.containers && config.containers.length > 0) {
            setLogs(prev => [...prev, `Starting ${config.containers!.length} ephemeral containers (may take a few seconds)...`]);
            activeContainers = await startContainers(config.containers!);
          }

          const extraEnv: Record<string, string> = {};
          for (const c of activeContainers) extraEnv[c.envVar] = c.connectionString;

          if (config.scripts?.pre_test) {
            setLogs(prev => [...prev, `Running pre-test script: ${config.scripts!.pre_test}`]);
            execSync(config.scripts.pre_test, { stdio: 'inherit', env: { ...process.env, ...extraEnv } });
          }

          if (waitSeconds > 0) {
            setLogs(prev => [...prev, `Waiting ${waitSeconds}s for app to start...`]);
          }

          if (appCommand) {
            child = spawnApp(appCommand, 'test', extraEnv);
            setIsRunningTests(true);
          }

          if (waitSeconds > 0) {
            await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
          }

          const results: TestResult[] = [];
          for (const tc of cases) {
            setLogs(prev => [...prev, `  Running: ${tc.id}`]);
            const result = await runTest(tc, targetUrl, noiseConfig);
            results.push(result);
          }
          setTestResults(results);
          const reportPath = saveTestReport(targetSet.index, results);
          setLogs(prev => [...prev, `Report saved to: ${path.relative(process.cwd(), reportPath)}`]);
        } catch (e: any) {
          setLogs(prev => [...prev, `[ERROR] ${e.message}`]);
        } finally {
          setIsRunningTests(false);
          if (child) killApp(child);
          if (config.scripts?.post_test) {
            setLogs(prev => [...prev, `Running post-test script: ${config.scripts!.post_test}`]);
            try {
              execSync(config.scripts.post_test, { stdio: 'inherit' });
            } catch (e: any) {
              setLogs(prev => [...prev, `[ERROR] Post-test script failed: ${e.message}`]);
            }
          }
          if (activeContainers.length > 0) {
            setLogs(prev => [...prev, `Stopping ephemeral containers...`]);
            await stopContainers(activeContainers);
          }
        }
      };

      runAll();

      return () => {
        killApp(child);
      };
    }

    if (mode === 'list') {
      const sets = listTestSets();
      setTestSets(sets);
      if (sets.length === 0) {
        setLogs(prev => [...prev, 'No test sets found. Run "vantage record" first.']);
      }
    }

    if (mode === 'export') {
      if (!exportFormat || !['jest', 'pytest'].includes(exportFormat)) {
        setLogs(prev => [...prev, 'Error: --format is required (jest or pytest)']);
        return;
      }

      const sets = listTestSets();
      if (sets.length === 0) {
        setLogs(prev => [...prev, 'No test sets found. Run "vantage record" first.']);
        return;
      }

      let targetSetExport: typeof sets[0];
      if (testSet) {
        const match = testSet.match(/^test-set-(\d+)$/);
        const found = match ? sets.find(s => s.index === parseInt(match[1], 10)) : undefined;
        if (!found) {
          setLogs(prev => [...prev, `Test set "${testSet}" not found.`]);
          return;
        }
        targetSetExport = found;
      } else {
        targetSetExport = sets[sets.length - 1];
      }

      const cases = loadTestCases(targetSetExport.dir);
      if (cases.length === 0) {
        setLogs(prev => [...prev, `No test cases in test-set-${targetSetExport.index}.`]);
        return;
      }

      const defaultOutDir = exportFormat === 'jest' ? '__tests__/vantage' : 'tests/vantage';
      const outputDir = outDir || defaultOutDir;

      const noiseConfig: NoiseConfig = config.noise || { headers: [], body_fields: [] };
      const generator = exportFormat === 'jest' ? jestGenerator : pytestGenerator;
      const files = generator.generate(cases, { 
        appEntry, 
        targetUrl, 
        testSetName: `test-set-${targetSetExport.index}`,
        noiseConfig,
        containerConfigs: config.containers
      });

      fs.mkdirSync(outputDir, { recursive: true });
      for (const file of files) {
        const filePath = path.join(outputDir, file.filename);
        fs.writeFileSync(filePath, file.content, 'utf8');
        setLogs(prev => [...prev, `  Generated: ${filePath}`]);
      }

      setLogs(prev => [...prev, `\nExported ${files.length} ${exportFormat} test files to ${outputDir}/`]);
    }
  }, [mode, targetUrl, recordPort, delay, testSet]);
  // Handle 'q' to quit — only when stdin is a TTY
  useEffect(() => {
    if (!process.stdin.isTTY) return;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const handler = (data: Buffer) => {
      if (data.toString() === 'q') process.exit(0);
    };
    process.stdin.on('data', handler);
    return () => {
      process.stdin.off('data', handler);
    };
  }, []);

  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  const totalTimeMs = testResults.reduce((sum, r) => sum + r.timeTakenMs, 0);

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="cyan" padding={1} marginBottom={1}>
        <Text color="cyan" bold>Vantage — API Test Generation & Replay</Text>
      </Box>

      {/* ── RECORD MODE ── */}
      {mode === 'record' && (
        <Box flexDirection="column">
          <Text color="yellow" bold>● RECORDING MODE</Text>
          <Text color="gray">Press 'q' to stop recording.</Text>
          <Box flexDirection="column" marginTop={1}>
            {logs.map((log, i) => (
              <Text key={i} color={log.startsWith('[RECORDED]') ? 'green' : 'white'}>{log}</Text>
            ))}
          </Box>
        </Box>
      )}

      {/* ── TEST MODE ── */}
      {mode === 'test' && (
        <Box flexDirection="column">
          <Text color="green" bold>▶ TEST MODE</Text>
          <Text color="gray">Press 'q' to quit.</Text>

          <Box flexDirection="column" marginTop={1}>
            {logs.map((log, i) => (
              <Text key={i} color="gray">{log}</Text>
            ))}
          </Box>

          {!isRunningTests && testResults.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Box borderStyle="single" borderColor={failed > 0 ? 'red' : 'green'} padding={1} flexDirection="column">
                <Text bold>Results: {passed} passed, {failed} failed, {testResults.length} total ({totalTimeMs}ms)</Text>
              </Box>

              <Box flexDirection="column" marginTop={1}>
                {testResults.map((res, i) => (
                  <Box key={i} flexDirection="column" marginBottom={1}>
                    <Text color={res.passed ? 'green' : 'red'}>
                      {res.passed ? '  ✔' : '  ✖'} {res.testId} ({res.timeTakenMs}ms)
                      {!res.passed && ` [${res.failureCategory}]${res.failureCategory === 'STATUS_CODE_CHANGED' ? ` (expected: ${res.expectedStatus}, actual: ${res.actualStatus})` : ''}`}
                    </Text>

                    {!res.passed && res.bodyDiffs && res.bodyDiffs.length > 0 && (
                      <Box flexDirection="column" marginLeft={4}>
                        {res.bodyDiffs.map((d, j) => {
                          if (d.added) return <Text key={j} color="green">+{d.value}</Text>;
                          if (d.removed) return <Text key={j} color="red">-{d.value}</Text>;
                          return null;
                        })}
                      </Box>
                    )}

                    {!res.passed && res.headerDiffs && res.headerDiffs.some(d => d.added || d.removed) && (
                      <Box flexDirection="column" marginLeft={4}>
                        <Text color="yellow" dimColor>Header diffs:</Text>
                        {res.headerDiffs.map((d, j) => {
                          if (d.added) return <Text key={`h${j}`} color="green">+{d.value}</Text>;
                          if (d.removed) return <Text key={`h${j}`} color="red">-{d.value}</Text>;
                          return null;
                        })}
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* ── LIST MODE ── */}
      {mode === 'list' && (
        <Box flexDirection="column">
          <Text color="blue" bold>📋 TEST SETS</Text>
          {testSets.length > 0 ? (
            <Box flexDirection="column" marginTop={1}>
              {testSets.map((s) => (
                <Text key={s.index}>
                  {'  '}test-set-{s.index}  —  {s.testCount} test{s.testCount !== 1 ? 's' : ''}
                </Text>
              ))}
            </Box>
          ) : (
            <Box marginTop={1}>
              {logs.map((log, i) => (
                <Text key={i} color="gray">{log}</Text>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* ── EXPORT MODE (placeholder) ── */}
      {mode === 'export' && (
        <Box flexDirection="column">
          <Text color="magenta" bold>📤 EXPORT</Text>
          <Box marginTop={1}>
            {logs.map((log, i) => (
              <Text key={i} color="gray">{log}</Text>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

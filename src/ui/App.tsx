import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { spawn, ChildProcess } from 'child_process';
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
import path from 'path';

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

function spawnApp(command: string, mode: 'record' | 'test'): ChildProcess {
  const child = spawn(command, {
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      VANTAGE_MODE: mode,
    },
  });
  process.on('exit', () => killApp(child));
  return child;
}

function killApp(child?: ChildProcess) {
  if (!child || !child.pid) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t']);
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

      const server = startRecordServer(recordPort, testSetDir, config.app_port, (id, reqPath) => {
        setLogs(prev => [...prev, `[RECORDED] ${id}  ←  ${reqPath}`]);
      });

      const child = appCommand ? spawnApp(appCommand, 'record') : undefined;

      return () => {
        server.close();
        killApp(child);
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
        waitSeconds > 0 ? `Waiting ${waitSeconds}s for app to start...` : '',
      ].filter(Boolean));

      const child = appCommand ? spawnApp(appCommand, 'test') : undefined;
      setIsRunningTests(true);

      const runAll = async () => {
        if (waitSeconds > 0) {
          await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
        }

        const results: TestResult[] = [];
        for (const tc of cases) {
          setLogs(prev => [...prev, `  Running: ${tc.id}`]);
          const result = await runTest(tc, targetUrl);
          results.push(result);
        }
        setTestResults(results);
        const reportPath = saveTestReport(targetSet.index, results);
        setLogs(prev => [...prev, `Report saved to: ${path.relative(process.cwd(), reportPath)}`]);
        setIsRunningTests(false);
        killApp(child);
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
      setLogs(prev => [...prev, 'Export command coming in Phase 3.']);
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
                <Text bold>Results: {passed} passed, {failed} failed, {testResults.length} total</Text>
              </Box>

              <Box flexDirection="column" marginTop={1}>
                {testResults.map((res, i) => (
                  <Box key={i} flexDirection="column" marginBottom={1}>
                    <Text color={res.passed ? 'green' : 'red'}>
                      {res.passed ? '  ✔' : '  ✖'} {res.testId}
                      {!res.passed && ` (expected: ${res.expectedStatus}, actual: ${res.actualStatus})`}
                    </Text>

                    {!res.passed && res.diffs && (
                      <Box flexDirection="column" marginLeft={4}>
                        {res.diffs.map((d, j) => {
                          if (d.added) return <Text key={j} color="green">+{d.value}</Text>;
                          if (d.removed) return <Text key={j} color="red">-{d.value}</Text>;
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

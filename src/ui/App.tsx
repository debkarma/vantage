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
import * as diff from 'diff';
import { startContainers, stopContainers, ContainerState } from '../engine/containers.js';
import { saveJUnitReport } from '../engine/junitWriter.js';

const LOGO_LINES = [
  " _    __            __                  ",
  "| |  / /___ _____  / /_____ _____ ____  ",
  "| | / / __ `/ __ \\/ __/ __ `/ __ `/ _ \\ ",
  "| |/ / /_/ / / / / /_/ /_/ / /_/ /  __/ ",
  "|___/\\__,_/_/ /_/\\__/\\__,_/\\__, /\\___/  ",
  "                          /____/        "
];

const GRADIENT = [
  '#00FFFF',
  '#00E5FF',
  '#00CCFF',
  '#00B2FF',
  '#0099FF',
  '#007FFF'
];

function Header() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="column" paddingBottom={0}>
        {LOGO_LINES.map((line, i) => (
          <Text key={i} color={GRADIENT[i]} bold>{line}</Text>
        ))}
      </Box>
      <Box marginTop={1} marginLeft={1}>
        <Text color="#007FFF" dimColor>version: 1.0.0-dev</Text>
      </Box>
    </Box>
  );
}

function LogItem({ text }: { text: string }) {
  let type = 'INFO';
  let typeColor = 'cyan';
  let cleanText = text;

  if (text.startsWith('[RECORDED]')) {
    type = 'SUCCESS';
    typeColor = 'green';
    cleanText = text.replace('[RECORDED] ', '');
  } else if (text.startsWith('[ERROR]')) {
    type = 'ERROR';
    typeColor = 'red';
    cleanText = text.replace('[ERROR] ', '');
  } else if (text.startsWith('\\n[WATCH') || text.startsWith('[WATCH')) {
    type = 'WATCH';
    typeColor = 'yellow';
    cleanText = text.replace(/\\n?\[WATCH(ING)?\]\s*/, '');
  } else if (text.startsWith('  Running:')) {
    type = 'TEST';
    typeColor = 'blue';
  } else if (text.startsWith('Report saved')) {
    type = 'SUCCESS';
    typeColor = 'green';
  }

  // Handle newlines in the original string (like \\n[WATCH])
  const showNewline = text.startsWith('\\n');

  return (
    <Box flexDirection="column">
      {showNewline && <Text> </Text>}
      <Box>
        <Text color="#00CCFF">⚡ Vantage: </Text>
        <Text color={typeColor} bold>{type.padEnd(8)}</Text>
        <Text color={type === 'ERROR' ? 'red' : 'white'}>{cleanText}</Text>
      </Box>
    </Box>
  );
}

function FailureTable({ res }: { res: TestResult }) {
  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Text dimColor>--------------------------------------------------------------------</Text>
      <Box flexDirection="column" borderStyle="single" borderColor="gray" marginY={1}>
        <Box justifyContent="center" paddingBottom={1}>
          <Text bold color="white">{res.testId.toUpperCase()}</Text>
        </Box>
        <Box flexDirection="column">
          <Box>
            <Box width="50%" justifyContent="center"><Text dimColor>EXPECT STATUS</Text></Box>
            <Box width="50%" justifyContent="center" borderStyle="single" borderTop={false} borderBottom={false} borderRight={false} borderColor="gray"><Text dimColor>ACTUAL STATUS</Text></Box>
          </Box>
          <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray">
            <Box width="50%" justifyContent="center"><Text color="green">{res.expectedStatus}</Text></Box>
            <Box width="50%" justifyContent="center" borderStyle="single" borderTop={false} borderBottom={false} borderRight={false} borderColor="gray"><Text color="red">{res.actualStatus}</Text></Box>
          </Box>
        </Box>

        {res.headerDiffs && res.headerDiffs.some((d: diff.Change) => d.added || d.removed) && (
          <Box flexDirection="column" borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray" paddingTop={1}>
            <Box justifyContent="center" marginBottom={1}><Text dimColor>HEADER DIFFS</Text></Box>
            <Box flexDirection="column" paddingX={2}>
              {res.headerDiffs.map((d: diff.Change, j: number) => {
                if (d.added) return <Text key={`h${j}`} color="green">+{d.value.trim()}</Text>;
                if (d.removed) return <Text key={`h${j}`} color="red">-{d.value.trim()}</Text>;
                return <Text key={`h${j}`} dimColor>{d.value.trim()}</Text>;
              })}
            </Box>
          </Box>
        )}

        {res.bodyDiffs && res.bodyDiffs.some((d: diff.Change) => d.added || d.removed) && (
          <Box flexDirection="column" borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray" paddingTop={1}>
            <Box justifyContent="center" marginBottom={1}><Text dimColor>BODY DIFFS</Text></Box>
            <Box flexDirection="column" paddingX={2}>
              {res.bodyDiffs.map((d: diff.Change, j: number) => {
                if (d.added) return <Text key={j} color="green">+{d.value.trimEnd()}</Text>;
                if (d.removed) return <Text key={j} color="red">-{d.value.trimEnd()}</Text>;
                return <Text key={j} dimColor>{d.value.trimEnd()}</Text>;
              })}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function TestrunSummary({ testSet, total, passed, failed, timeTakenMs }: any) {
  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Text dimColor>{` <=========================================>`}</Text>
      <Text bold>  TESTRUN SUMMARY. For test-set: "{testSet}"</Text>
      <Text>        Total tests:        {total}</Text>
      <Text>        Total test passed:  <Text color={passed > 0 ? "green" : "white"}>{passed}</Text></Text>
      <Text>        Total test failed:  <Text color={failed > 0 ? "red" : "white"}>{failed}</Text></Text>
      <Text>        Time Taken:         "{(timeTakenMs / 1000).toFixed(2)} s"</Text>
      <Text dimColor>{` <=========================================>`}</Text>
    </Box>
  );
}

interface AppProps {
  mode: 'record' | 'test' | 'list' | 'export';
  targetUrl?: string;
  recordPort: number;
  delay: number;
  testSet?: string;
  exportFormat?: 'jest' | 'pytest';
  appEntry?: string;
  outDir?: string;
  appCommand?: string;
  proxyPort?: number;
  ciMode?: boolean;
  watchMode?: boolean;
}

function spawnApp(command: string, mode: 'record' | 'test', extraEnv?: Record<string, string>): ChildProcess {
  const child = spawn(command, {
    shell: true,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: {
      ...process.env,
      VANTAGE_MODE: mode,
      ...(extraEnv || {}),
    },
  });
  process.on('exit', () => killApp(child));
  process.on('SIGINT', () => {
    killApp(child);
    process.exit(0);
  });
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
  proxyPort,
  ciMode,
  watchMode,
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

      const server = startRecordServer(recordPort, testSetDir, config.app_port || 3000, proxyPort, (id, reqPath) => {
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

      const finalTargetUrl = targetUrl || `http://localhost:${config.app_port}`;
      const waitSeconds = delay > 0 ? delay : (appCommand ? 3 : 0);

      setLogs(prev => [
        ...prev,
        `Replaying test-set-${targetSet.index} (${cases.length} tests) against ${finalTargetUrl}`,
        appCommand ? `Spawning target app: ${appCommand}` : '',
      ].filter(Boolean));

      let child: ChildProcess | undefined;
      const noiseConfig: NoiseConfig = config.noise || { headers: [], body_fields: [] };

      const runAll = async () => {
        let activeContainers: ContainerState[] = [];
        let results: TestResult[] = [];
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

          for (const tc of cases) {
            setLogs(prev => [...prev, `  Running: ${tc.id}`]);
            const res = await runTest(tc, finalTargetUrl, noiseConfig);
            results.push(res);
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

          if (ciMode) {
            const hasFailures = results.some(r => !r.passed);
            const reportDir = path.join(process.cwd(), '.vantage', 'reports');
            saveJUnitReport(targetSet.index, results, reportDir);
            
            console.log(`\n=== Vantage CI Report ===`);
            console.log(`Results: ${results.filter(r => r.passed).length} passed, ${results.filter(r => !r.passed).length} failed, ${results.length} total`);
            if (hasFailures) {
              console.log(`\n❌ Tests Failed.`);
              process.exit(1);
            } else {
              console.log(`\n✅ All Tests Passed.`);
              process.exit(0);
            }
          }
        }
      };

      runAll();

      let watcher: fs.FSWatcher | undefined;
      if (watchMode) {
        setLogs(prev => [...prev, `\n[WATCHING] Waiting for file changes to re-run tests...`]);
        let debounceTimer: NodeJS.Timeout;
        watcher = fs.watch(process.cwd(), { recursive: true }, (eventType, filename) => {
          if (filename && (filename.includes('.vantage') || filename.includes('node_modules') || filename.includes('__pycache__'))) {
            return;
          }
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            if (isRunningTests) return;
            setLogs(prev => [...prev, `\n[WATCH] File changed: ${filename}, restarting...`]);
            runAll();
          }, 500);
        });
      }

      return () => {
        killApp(child);
        if (watcher) watcher.close();
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

  if (ciMode) {
    return null;
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Header />

      {/* ── RECORD MODE ── */}
      {mode === 'record' && (
        <Box flexDirection="column">
          <Text color="yellow" bold>● RECORDING MODE</Text>
          <Text color="gray">Press 'q' to stop recording.</Text>
          <Box flexDirection="column" marginTop={1}>
            {logs.map((log, i) => (
              <LogItem key={i} text={log} />
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
              <LogItem key={i} text={log} />
            ))}
          </Box>

          {!isRunningTests && testResults.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Box flexDirection="column" marginTop={1}>
                {testResults.map((res, i) => (
                  <Box key={i} flexDirection="column" marginBottom={0}>
                    {res.passed ? (
                      <Text color="green">
                        {'  ✔'} {res.testId} ({res.timeTakenMs}ms)
                      </Text>
                    ) : (
                      <FailureTable key={`fail-${i}`} res={res} />
                    )}
                  </Box>
                ))}
              </Box>

              <TestrunSummary 
                testSet={testSet || 'latest'} 
                total={testResults.length} 
                passed={passed} 
                failed={failed} 
                timeTakenMs={totalTimeMs} 
              />
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
            <Box marginTop={1} flexDirection="column">
              {logs.map((log, i) => (
                <LogItem key={i} text={log} />
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* ── EXPORT MODE (placeholder) ── */}
      {mode === 'export' && (
        <Box flexDirection="column">
          <Text color="magenta" bold>📤 EXPORT</Text>
          <Box marginTop={1} flexDirection="column">
            {logs.map((log, i) => (
              <LogItem key={i} text={log} />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

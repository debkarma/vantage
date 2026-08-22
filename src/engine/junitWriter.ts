import { TestResult } from './replayEngine.js';
import path from 'path';
import fs from 'fs';

export function saveJUnitReport(testSetIndex: number, results: TestResult[], reportsDir: string): string {
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  const totalTimeMs = results.reduce((sum, r) => sum + (r.timeTakenMs || 0), 0);
  const totalTimeSec = (totalTimeMs / 1000).toFixed(3);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<testsuite name="Vantage Test Set ${testSetIndex}" tests="${results.length}" failures="${failedCount}" errors="0" time="${totalTimeSec}">\n`;

  for (const r of results) {
    const timeSec = (r.timeTakenMs / 1000).toFixed(3);
    xml += `  <testcase name="${r.testId}" classname="VantageReplay" time="${timeSec}">\n`;

    if (!r.passed) {
      let failureMessage = `Failure: ${r.failureCategory}`;
      if (r.failureCategory === 'STATUS_CODE_CHANGED') {
        failureMessage += ` (Expected ${r.expectedStatus}, got ${r.actualStatus})`;
      }

      let diffDetails = '';
      if (r.bodyDiffs && r.bodyDiffs.length > 0) {
        diffDetails += `\nBody Diffs:\n`;
        for (const d of r.bodyDiffs) {
          if (d.added) diffDetails += `+ ${d.value}\n`;
          if (d.removed) diffDetails += `- ${d.value}\n`;
        }
      }

      if (r.headerDiffs && r.headerDiffs.length > 0) {
        diffDetails += `\nHeader Diffs:\n`;
        for (const d of r.headerDiffs) {
          if (d.added) diffDetails += `+ ${d.value}\n`;
          if (d.removed) diffDetails += `- ${d.value}\n`;
        }
      }

      // Escape XML characters
      const escapedMessage = failureMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const escapedDiff = diffDetails.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      xml += `    <failure message="${escapedMessage}">${escapedDiff}</failure>\n`;
    }

    xml += `  </testcase>\n`;
  }

  xml += `</testsuite>\n`;

  const runDir = path.join(reportsDir, `test-run-${getLatestRunIndex(reportsDir)}`);
  const filePath = path.join(runDir, `test-set-${testSetIndex}-junit.xml`);
  fs.writeFileSync(filePath, xml, 'utf8');
  return filePath;
}

function getLatestRunIndex(reportsDir: string): number {
  if (!fs.existsSync(reportsDir)) return 1;
  const entries = fs.readdirSync(reportsDir, { withFileTypes: true });
  let maxRunIndex = 1;
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const m = entry.name.match(/^test-run-(\d+)$/);
      if (m) {
        const idx = parseInt(m[1], 10);
        if (idx > maxRunIndex) maxRunIndex = idx;
      }
    }
  }
  return maxRunIndex;
}

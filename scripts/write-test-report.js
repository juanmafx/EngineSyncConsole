import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const reportDirectory = resolve(root, 'reports/tests');
const junitPath = resolve(reportDirectory, 'junit.xml');
const jsonPath = resolve(reportDirectory, 'results.json');

const stripMachineDetails = (text) =>
  text.replaceAll(`${root}/`, '').replaceAll(root, '.').replace(/hostname="[^"]*"/g, 'hostname="redacted"');

writeFileSync(junitPath, stripMachineDetails(readFileSync(junitPath, 'utf8')));
writeFileSync(jsonPath, stripMachineDetails(readFileSync(jsonPath, 'utf8')));

const results = JSON.parse(readFileSync(jsonPath, 'utf8'));
const suiteRows = results.testResults
  .map((suite) => {
    const passed = suite.assertionResults.filter((test) => test.status === 'passed').length;
    return `| \`${suite.name}\` | ${suite.assertionResults.length} | ${passed} | ${suite.assertionResults.length - passed} |`;
  })
  .sort();

const summary = [
  '# Test Report',
  '',
  `- Generated: ${new Date().toISOString()}`,
  `- Runtime: Node.js ${process.version}`,
  '- Command: `npm run test:report`',
  `- Total: ${results.numTotalTests}`,
  `- Passed: ${results.numPassedTests}`,
  `- Failed: ${results.numFailedTests}`,
  `- Skipped: ${results.numPendingTests}`,
  '',
  '| Suite | Tests | Passed | Failed |',
  '| --- | ---: | ---: | ---: |',
  ...suiteRows,
  '',
].join('\n');

writeFileSync(resolve(reportDirectory, 'SUMMARY.md'), summary);
process.exitCode = results.numFailedTests === 0 ? 0 : 1;

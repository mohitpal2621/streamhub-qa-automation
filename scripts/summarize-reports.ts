/**
 * Builds reports/README.md from the Cucumber JSON of each suite, so the latest
 * results can be read on GitHub without downloading the HTML reports.
 *
 *   npm run report:summary
 */
import fs from 'node:fs';
import path from 'node:path';

interface Step {
  keyword: string;
  name: string;
  result: { status: string; duration?: number; error_message?: string };
}
interface Scenario {
  id: string;
  name: string;
  type: string;
  steps: Step[];
}
interface Feature {
  name: string;
  uri: string;
  elements: Scenario[];
}

const SUITES = [
  { dir: 'api', title: 'B2 API tests', command: 'npm run test:api' },
  { dir: 'ui', title: 'B3 UI tests (emicalculator.net)', command: 'npm run test:ui' },
  { dir: 'sql', title: 'B4 SQL tests', command: 'npm run test:sql' },
  { dir: 'self-healing/healing-off', title: 'Self-healing demo, healing off', command: 'npm run test:healing:off' },
  { dir: 'self-healing/healing-on', title: 'Self-healing demo, heuristic healer', command: 'npm run test:healing' },
  { dir: 'self-healing/healing-on-claude', title: 'Self-healing demo, Claude healer', command: 'npm run test:healing:claude' },
];

const REPORTS = 'reports';

function summarize(dir: string) {
  const file = path.join(REPORTS, dir, 'cucumber-report.json');
  if (!fs.existsSync(file)) return undefined;
  const features = JSON.parse(fs.readFileSync(file, 'utf8')) as Feature[];
  // A retried scenario appears once per attempt; the last attempt is the result.
  const scenarios = new Map<string, Scenario>();
  for (const feature of features) {
    for (const scenario of feature.elements.filter((element) => element.type === 'scenario')) {
      scenarios.set(`${feature.uri}:${scenario.id}`, scenario);
    }
  }
  const all = [...scenarios.values()];
  const steps = all.flatMap((scenario) => scenario.steps.filter((step) => step.keyword.trim() !== 'Before' && step.keyword.trim() !== 'After'));
  const failed = all.filter((scenario) => scenario.steps.some((step) => step.result.status === 'failed'));
  const nanoseconds = all.flatMap((scenario) => scenario.steps).reduce((sum, step) => sum + (step.result.duration ?? 0), 0);
  return {
    scenarios: all.length,
    passed: all.length - failed.length,
    failed,
    steps: steps.length,
    seconds: Math.round(nanoseconds / 1e9),
    ranAt: fs.statSync(file).mtime.toISOString().replace('T', ' ').slice(0, 16),
  };
}

const lines = [
  '# Test results',
  '',
  'Results of the latest local run, written by `npm run report:summary`. Open the HTML reports in a browser for every step, attachment and screenshot.',
  '',
  '| Suite | Command | Scenarios | Passed | Failed | Steps | Time | Run at (UTC) | Reports |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
];
const failures: string[] = [];

for (const suite of SUITES) {
  const result = summarize(suite.dir);
  if (!result) continue;
  const links = ['cucumber-report.html', 'junit.xml', 'console.txt']
    .filter((name) => fs.existsSync(path.join(REPORTS, suite.dir, name)))
    .map((name) => `[${name.split('.').pop()}](${suite.dir}/${name})`)
    .join(' ');
  lines.push(
    `| ${suite.title} | \`${suite.command}\` | ${result.scenarios} | ${result.passed} | ${result.failed.length} | ${result.steps} | ${result.seconds}s | ${result.ranAt} | ${links} |`,
  );
  for (const scenario of result.failed) {
    const step = scenario.steps.find((s) => s.result.status === 'failed')!;
    failures.push(`- ${suite.title}: "${scenario.name}" failed at "${step.keyword.trim()} ${step.name}": ${step.result.error_message?.split('\n')[0]}`);
  }
}

if (failures.length) {
  lines.push('', '## Failures', '', ...failures);
  lines.push('', 'The healing-off run is meant to fail: it runs the deliberately broken locators as written.');
}

const screenshotDirs = SUITES.map((suite) => path.join(suite.dir, 'screenshots')).filter((dir) => fs.existsSync(path.join(REPORTS, dir)));
for (const dir of screenshotDirs) {
  lines.push('', `## Screenshots: ${dir.split(path.sep).slice(0, -1).join('/')}`, '');
  for (const file of fs.readdirSync(path.join(REPORTS, dir)).sort()) {
    const href = `${dir.split(path.sep).join('/')}/${file}`;
    lines.push(`### ${file.replace(/\.png$/, '').replace(/--/g, ': ').replace(/-/g, ' ')}`, '', `![${file}](${href})`, '');
  }
}

fs.writeFileSync(path.join(REPORTS, 'README.md'), `${lines.join('\n').trimEnd()}\n`);
console.log(lines.slice(0, 6 + SUITES.length).join('\n'));

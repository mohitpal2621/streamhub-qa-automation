import fs from 'node:fs';
import path from 'node:path';
import type { HealRecord } from './types';

const records: HealRecord[] = [];

export function addRecords(newRecords: HealRecord[]): void {
  records.push(...newRecords);
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

/**
 * Writes heal-report.json and heal-report.md to `dir`. The Markdown version is
 * what a reviewer reads: one row per broken locator, then the proposals and
 * checks behind each decision, and the change to make in the page object.
 */
export function writeHealReport(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'heal-report.json'), `${JSON.stringify(records, null, 2)}\n`);

  const lines = [
    '# Self-healing report',
    '',
    `Healer: ${records[0]?.healer ?? 'none'}. Generated ${new Date().toISOString()}.`,
    '',
    'Nothing here has been applied to the source. Each healed locator below is a suggested change for a person to review.',
    '',
    '| Locator | Broken selector | Outcome | Replacement | Confirmed by the step |',
    '| --- | --- | --- | --- | --- |',
    ...records.map(
      (r) =>
        `| ${r.key} | \`${cell(r.selector)}\` | ${r.outcome} | ${r.replacement ? `\`${cell(r.replacement)}\`` : '-'} | ${r.confirmedAfterAction ? 'yes' : 'no'} |`,
    ),
  ];

  for (const r of records) {
    lines.push('', `## ${r.key}`, '', `- Step: ${r.step} (scenario "${r.scenario}")`, `- Wanted: ${r.intent}`);
    lines.push(`- Broken selector: \`${r.selector}\` matched ${r.matches} element(s)`, `- Why it broke: ${r.why}`, '');
    if (r.proposals.length === 0) lines.push('The healer proposed nothing.');
    r.proposals.forEach((p, i) => {
      lines.push(`${i + 1}. \`${p.code}\` (confidence ${p.confidence}) - ${p.accepted ? '**accepted**' : 'rejected'}`);
      lines.push(`   - Healer's reason: ${p.reason}`);
      for (const check of p.checks) lines.push(`   - ${check.passed ? 'PASS' : 'FAIL'} ${check.name}${check.passed ? '' : `: ${check.detail}`}`);
    });
    if (r.replacement) {
      lines.push('', 'Suggested change in `tests/pages/BrittleEmiCalculatorPage.ts`:', '', '```diff', `- selector: '${r.selector}',`, `+ ${r.replacement}`, '```');
    }
  }
  fs.writeFileSync(path.join(dir, 'heal-report.md'), `${lines.join('\n')}\n`);
}

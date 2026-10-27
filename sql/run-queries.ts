/**
 * Runs each SQL scenario against PGlite (PostgreSQL compiled to WebAssembly)
 * and saves the output two ways under sql/results/: a psql-style text table
 * and a PNG screenshot of the query with its result grid.
 *
 *   npm run sql:run
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { SQL_DIR, SqlRunner, type QueryResult } from '../tests/support/sql';

const RESULTS_DIR = path.join(SQL_DIR, 'results');
const RUNS = [
  { scenario: 'round_trip_transfers', file: 'query.sql', output: 'round_trip_transfers' },
  { scenario: 'ipl_streaks', file: 'query.sql', output: 'ipl_streaks' },
  { scenario: 'ipl_streaks', file: 'details.sql', output: 'ipl_streaks_details' },
];

function psqlTable({ columns, rows }: QueryResult): string {
  const widths = columns.map((column, i) => Math.max(column.length, ...rows.map((row) => row[i].length)));
  const line = (cells: string[]) => ` ${cells.map((cell, i) => cell.padEnd(widths[i])).join(' | ')}`.trimEnd();
  const rule = widths.map((width) => '-'.repeat(width + 2)).join('+');
  return [line(columns), rule, ...rows.map(line), `(${rows.length} rows)`].join('\n');
}

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function page(title: string, version: string, sql: string, result: QueryResult): string {
  const header = result.columns.map((column) => `<th>${escape(column)}</th>`).join('');
  const body = result.rows.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('');
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 24px; background: #f4f5f7; font: 14px/1.45 "Segoe UI", system-ui, sans-serif; color: #1f2328; }
  .panel { background: #fff; border: 1px solid #d0d7de; border-radius: 6px; overflow: hidden; width: max-content; min-width: 760px; }
  .bar { padding: 8px 14px; background: #24292f; color: #fff; font-size: 13px; display: flex; justify-content: space-between; gap: 24px; }
  pre { margin: 0; padding: 14px; background: #f6f8fa; border-bottom: 1px solid #d0d7de; font: 12.5px/1.5 Consolas, "Cascadia Mono", monospace; white-space: pre; }
  table { border-collapse: collapse; margin: 14px; font: 13px Consolas, "Cascadia Mono", monospace; }
  th, td { border: 1px solid #d0d7de; padding: 5px 10px; text-align: left; white-space: nowrap; }
  th { background: #eaeef2; }
  tr:nth-child(even) td { background: #f6f8fa; }
  .count { padding: 0 14px 14px; color: #57606a; font-size: 13px; }
</style></head><body><div class="panel">
  <div class="bar"><span>${escape(title)}</span><span>${escape(version)}</span></div>
  <pre>${escape(sql.trim())}</pre>
  <table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
  <div class="count">${result.rows.length} rows</div>
</div></body></html>`;
}

async function main() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const browser = await chromium.launch();
  const tab = await browser.newPage({ deviceScaleFactor: 1 });
  try {
    for (const run of RUNS) {
      const db = await SqlRunner.start();
      try {
        await db.load(run.scenario);
        const sql = fs.readFileSync(path.join(SQL_DIR, run.scenario, run.file), 'utf8');
        const result = await db.query(sql);
        const version = await db.version();
        const title = `sql/${run.scenario}/${run.file}`;

        const text = `-- ${title}\n-- ${version}\n\n${psqlTable(result)}\n`;
        fs.writeFileSync(path.join(RESULTS_DIR, `${run.output}.txt`), text);
        console.log(`${text}\n`);

        await tab.setContent(page(title, version, sql, result));
        await tab.locator('.panel').screenshot({ path: path.join(RESULTS_DIR, `${run.output}.png`) });
      } finally {
        await db.close();
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

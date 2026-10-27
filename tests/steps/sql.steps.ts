import fs from 'node:fs';
import path from 'node:path';
import { Given, Then, When, type DataTable } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { SQL_DIR, type QueryResult } from '../support/sql';
import type { TestWorld } from '../support/world';

function resultOf(world: TestWorld): QueryResult {
  if (!world.queryResult) throw new Error('No query has been run in this scenario yet');
  return world.queryResult;
}

const asText = ({ columns, rows }: QueryResult) =>
  [columns.join(' | '), ...rows.map((row) => row.join(' | '))].join('\n');

Given(
  'a fresh PostgreSQL database with the {string} tables and sample data',
  async function (this: TestWorld, scenario: string) {
    await this.sql.load(scenario);
  },
);

When('I run the {string} query', async function (this: TestWorld, scenario: string) {
  this.queryResult = await this.sql.runFile(scenario);
  this.attach(`${await this.sql.version()}\n\n${asText(this.queryResult)}`);
});

When('I run the {string} details query', async function (this: TestWorld, scenario: string) {
  this.queryResult = await this.sql.runFile(scenario, 'details.sql');
  this.attach(asText(this.queryResult));
});

/**
 * Runs a deliberately broken copy of the query. If the sample data is good, at
 * least one of its cases makes the broken copy give a different answer.
 */
When(
  'I run the {string} query with {string} changed to {string}',
  async function (this: TestWorld, scenario: string, correct: string, mistaken: string) {
    const sql = fs.readFileSync(path.join(SQL_DIR, scenario, 'query.sql'), 'utf8');
    expect(sql, `query.sql should contain: ${correct}`).toContain(correct);
    this.correctResult = await this.sql.query(sql);
    this.queryResult = await this.sql.query(sql.replace(correct, mistaken));
    this.attach(`Changed "${correct}" to "${mistaken}"\n\nCorrect query:\n${asText(this.correctResult)}\n\nChanged query:\n${asText(this.queryResult)}`);
  },
);

Then('the result has the columns {string}', function (this: TestWorld, columns: string) {
  expect(resultOf(this).columns).toEqual(columns.split(/,\s*/));
});

Then('the result is:', function (this: TestWorld, table: DataTable) {
  const [header, ...rows] = table.raw();
  expect(resultOf(this).columns).toEqual(header);
  expect(resultOf(this).rows).toEqual(rows);
});

Then(
  'the changed query {word} the row starting {string}',
  function (this: TestWorld, effect: string, start: string) {
    const prefix = start.split(/,\s*/);
    const has = ({ rows }: QueryResult) => rows.some((row) => prefix.every((value, i) => row[i] === value));
    const [before, after] = [has(this.correctResult!), has(resultOf(this))];
    if (effect === 'misses') expect({ before, after }, `row starting "${start}"`).toEqual({ before: true, after: false });
    else if (effect === 'adds') expect({ before, after }, `row starting "${start}"`).toEqual({ before: false, after: true });
    else throw new Error(`Unknown effect "${effect}"; use "misses" or "adds"`);
  },
);

import { Given, Then, When, type DataTable } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { ApiCall } from '../../api/CatalogueApi';
import { contractViolations, schemaViolations } from '../../api/contract';
import type { TestWorld } from '../../support/world';

interface ErrorBody {
  error: {
    status: number;
    code: string;
    message: string;
    details: { parameter: string; code: string; message: string; value?: string }[];
  };
}

const describe = (call: ApiCall) => `${call.method} ${call.path} -> ${call.status} ${JSON.stringify(call.body)}`;

function errorOf(world: TestWorld): ErrorBody['error'] {
  const body = world.lastResponse.body as Partial<ErrorBody>;
  if (!body?.error) throw new Error(`Expected an error body, got ${describe(world.lastResponse)}`);
  return body.error;
}

/** Reads "channel.name" style paths out of the response body. */
function fieldAt(body: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], body);
}

Given('the catalogue API is running', async function (this: TestWorld) {
  const health = await this.api.get('/health');
  expect(health.status, describe(health)).toBe(200);
});

When('I request {string}', async function (this: TestWorld, path: string) {
  this.response = await this.api.get(path);
});

When('I send a {word} request to {string}', async function (this: TestWorld, method: string, path: string) {
  this.response = await this.api.send(method, path);
});

When(
  'I request {string} with {string} set to {int} {string} characters',
  async function (this: TestWorld, path: string, parameter: string, length: number, character: string) {
    this.response = await this.api.get(`${path}?${parameter}=${character.repeat(length)}`);
  },
);

Then('the response status is {int}', function (this: TestWorld, status: number) {
  expect(this.lastResponse.status, describe(this.lastResponse)).toBe(status);
});

Then('the response matches the API contract', function (this: TestWorld) {
  expect(contractViolations(this.lastResponse), describe(this.lastResponse)).toEqual([]);
});

Then('the response body matches the {string} schema', function (this: TestWorld, schema: string) {
  expect(schemaViolations(schema, this.lastResponse.body), describe(this.lastResponse)).toEqual([]);
});

Then('the response header {string} contains {string}', function (this: TestWorld, header: string, expected: string) {
  expect(this.lastResponse.headers[header.toLowerCase()]).toContain(expected);
});

Then('the response body is empty', function (this: TestWorld) {
  expect(this.lastResponse.body).toBe('');
});

Then('the response field {string} is {string}', function (this: TestWorld, path: string, expected: string) {
  expect(String(fieldAt(this.lastResponse.body, path))).toBe(expected);
});

Then('the error code is {string}', function (this: TestWorld, code: string) {
  const error = errorOf(this);
  expect(error.code, describe(this.lastResponse)).toBe(code);
  expect(error.status).toBe(this.lastResponse.status);
});

Then('the error points at the {string} parameter', function (this: TestWorld, parameter: string) {
  const named = errorOf(this).details.map((detail) => detail.parameter);
  expect(named, describe(this.lastResponse)).toContain(parameter);
});

Then('the error message is {string}', function (this: TestWorld, message: string) {
  expect(errorOf(this).message).toBe(message);
});

Then('the error details are:', function (this: TestWorld, table: DataTable) {
  const expected = table.hashes().map(({ parameter, code, value }) => ({ parameter, code, ...(value && { value }) }));
  const actual = errorOf(this).details.map(({ parameter, code, value }) => ({ parameter, code, ...(value && { value }) }));
  expect(actual).toEqual(expected);
});

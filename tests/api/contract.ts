import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import type { ApiCall } from './CatalogueApi';

const SPEC_FILE = 'api/openapi.yaml';

interface OpenApiSpec {
  paths: Record<string, Record<string, { responses: Record<string, { $ref?: string }> }>>;
  components: { responses: Record<string, unknown> };
}

const spec = parse(fs.readFileSync(SPEC_FILE, 'utf8')) as OpenApiSpec;

// strict: false because an OpenAPI document carries keys that are not JSON
// Schema keywords (paths, info, example). Only the response schemas get compiled.
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(spec as object, 'openapi');

const routes = Object.keys(spec.paths).map((template) => ({
  template,
  pattern: new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}/?$`),
}));

const escapePointer = (segment: string) => segment.replace(/~/g, '~0').replace(/\//g, '~1');

/**
 * Validates a response body against the schema that api/openapi.yaml documents
 * for that path, method and status code. Returns a list of problems, empty
 * when the response matches.
 */
export function contractViolations(call: ApiCall): string[] {
  const pathname = call.path.split('?')[0];
  const route = routes.find((r) => r.pattern.test(pathname));
  if (!route) return [`${SPEC_FILE} has no path matching ${pathname}`];

  // An undocumented method is answered with the 405 response that the GET operation documents.
  const method = call.method.toLowerCase() in spec.paths[route.template] ? call.method.toLowerCase() : 'get';
  const status = String(call.status);
  const documented = spec.paths[route.template][method].responses[status];
  if (!documented) return [`${call.method} ${route.template} does not document a ${status} response`];

  const responsePointer = documented.$ref
    ? documented.$ref.slice(1)
    : `/paths/${escapePointer(route.template)}/${method}/responses/${status}`;
  const validate = ajv.getSchema(`openapi#${responsePointer}/content/application~1json/schema`);
  if (!validate) return [`No JSON schema found for ${call.method} ${route.template} ${status}`];

  if (validate(call.body)) return [];
  return (validate.errors ?? []).map((e) => `${e.instancePath || '(body)'} ${e.message} ${JSON.stringify(e.params)}`);
}

/** Validates any value against a named schema in components/schemas. */
export function schemaViolations(schemaName: string, value: unknown): string[] {
  const validate = ajv.getSchema(`openapi#/components/schemas/${schemaName}`);
  if (!validate) return [`components/schemas/${schemaName} is not defined in ${SPEC_FILE}`];
  if (validate(value)) return [];
  return (validate.errors ?? []).map((e) => `${e.instancePath || '(body)'} ${e.message}`);
}

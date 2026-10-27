import fs from 'node:fs';
import path from 'node:path';
import { PGlite, types } from '@electric-sql/pglite';

export const SQL_DIR = 'sql';

export interface QueryResult {
  columns: string[];
  /** Every value as PostgreSQL prints it, with NULL as the string "NULL". */
  rows: string[][];
}

// Keep dates, timestamps and numerics as the text PostgreSQL sends. Converting
// them to JS Dates and floats would shift timestamps into the local time zone
// and turn 10000.00 into 10000.
const asText = (value: string) => value;
const parsers = Object.fromEntries(
  [types.DATE, types.TIMESTAMP, types.TIMESTAMPTZ, types.INTERVAL, types.NUMERIC].map((oid) => [oid, asText]),
);

/**
 * An in-memory PostgreSQL (PGlite, Postgres compiled to WebAssembly), so the
 * SQL scenarios run against a real Postgres without installing a server.
 */
export class SqlRunner {
  private constructor(private readonly db: PGlite) {}

  static async start(): Promise<SqlRunner> {
    return new SqlRunner(await PGlite.create({ parsers }));
  }

  /** Runs sql/<scenario>/schema.sql and seed.sql. */
  async load(scenario: string): Promise<void> {
    for (const file of ['schema.sql', 'seed.sql']) {
      await this.db.exec(fs.readFileSync(path.join(SQL_DIR, scenario, file), 'utf8'));
    }
  }

  /** Runs sql/<scenario>/<file>, which must hold a single SELECT. */
  runFile(scenario: string, file = 'query.sql'): Promise<QueryResult> {
    return this.query(fs.readFileSync(path.join(SQL_DIR, scenario, file), 'utf8'));
  }

  async query(sql: string): Promise<QueryResult> {
    const result = await this.db.query<Record<string, unknown>>(sql);
    const columns = result.fields.map((field) => field.name);
    const rows = result.rows.map((row) => columns.map((column) => (row[column] === null ? 'NULL' : String(row[column]))));
    return { columns, rows };
  }

  async version(): Promise<string> {
    const { rows } = await this.query('SELECT version()');
    return rows[0][0].split(' on ')[0];
  }

  close(): Promise<void> {
    return this.db.close();
  }
}

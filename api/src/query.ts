import { ApiError, type ParameterError } from './errors';

interface Options {
  required?: boolean;
}

/**
 * Reads query parameters one by one and collects every problem it finds, so a
 * request with three bad parameters gets one 400 response that lists all three.
 * Call `throwIfInvalid()` after reading the last parameter.
 */
export class QueryReader {
  private readonly errors: ParameterError[] = [];

  constructor(
    private readonly query: Record<string, unknown>,
    allowed: readonly string[],
  ) {
    for (const name of Object.keys(query)) {
      if (!allowed.includes(name)) {
        const hint = allowed.length ? `Allowed parameters: ${allowed.join(', ')}` : 'This endpoint takes no query parameters';
        this.errors.push({ parameter: name, code: 'UNKNOWN_PARAMETER', message: `Unknown query parameter "${name}". ${hint}` });
      }
    }
  }

  text(name: string, limits: { minLength: number; maxLength: number }, options: Options = {}): string | undefined {
    const value = this.raw(name, options)?.trim();
    if (value === undefined) return undefined;
    if (value.length < limits.minLength || value.length > limits.maxLength) {
      return this.invalid(name, `${name} must be between ${limits.minLength} and ${limits.maxLength} characters`, value);
    }
    return value;
  }

  integer(name: string, range: { min: number; max?: number }, options: Options = {}): number | undefined {
    const value = this.raw(name, options);
    if (value === undefined) return undefined;
    const parsed = /^-?\d+$/.test(value) ? Number(value) : NaN;
    const { min, max = Number.MAX_SAFE_INTEGER } = range;
    if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
      const bounds = range.max === undefined ? `of at least ${min}` : `between ${min} and ${max}`;
      return this.invalid(name, `${name} must be an integer ${bounds}`, value);
    }
    return parsed;
  }

  boolean(name: string, options: Options = {}): boolean | undefined {
    const value = this.raw(name, options);
    if (value === undefined) return undefined;
    if (value !== 'true' && value !== 'false') {
      return this.invalid(name, `${name} must be true or false`, value);
    }
    return value === 'true';
  }

  oneOf<T extends string>(name: string, allowed: readonly T[], options: Options = {}): T | undefined {
    const value = this.raw(name, options);
    if (value === undefined) return undefined;
    if (!allowed.includes(value as T)) {
      return this.invalid(name, `${name} must be one of: ${allowed.join(', ')}`, value);
    }
    return value as T;
  }

  /** A comma-separated list where every item must be one of `allowed`. */
  listOf<T extends string>(name: string, allowed: readonly T[], options: Options = {}): T[] | undefined {
    const value = this.raw(name, options);
    if (value === undefined) return undefined;
    const items = value.split(',').map((item) => item.trim());
    if (items.some((item) => !allowed.includes(item as T))) {
      return this.invalid(name, `${name} must be a comma-separated list of: ${allowed.join(', ')}`, value);
    }
    return items as T[];
  }

  matching(name: string, pattern: RegExp, example: string, options: Options = {}): string | undefined {
    const value = this.raw(name, options);
    if (value === undefined) return undefined;
    if (!pattern.test(value)) {
      return this.invalid(name, `${name} must look like ${example}`, value);
    }
    return value;
  }

  /** A calendar date in YYYY-MM-DD form. 2026-02-30 is rejected, not rolled over to March. */
  date(name: string, options: Options = {}): string | undefined {
    const value = this.raw(name, options);
    if (value === undefined) return undefined;
    const parsed = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      return this.invalid(name, `${name} must be a real date in YYYY-MM-DD format`, value);
    }
    return value;
  }

  /** For rules that involve more than one parameter, such as from <= to. */
  ensure(condition: boolean, name: string, message: string): void {
    if (!condition) this.invalid(name, message, this.raw(name, {}));
  }

  invalid(name: string, message: string, value?: string): undefined {
    this.errors.push({ parameter: name, code: 'INVALID_PARAMETER', message, ...(value !== undefined && { value }) });
    return undefined;
  }

  throwIfInvalid(): void {
    if (this.errors.length === 0) return;
    const [first] = this.errors;
    const message =
      this.errors.length === 1
        ? first.message
        : `${this.errors.length} problems with the request: ${this.errors.map((e) => e.parameter).join(', ')}`;
    throw new ApiError(400, first.code, message, this.errors);
  }

  private raw(name: string, { required = false }: Options): string | undefined {
    const value = this.query[name];
    if (value === undefined) {
      if (required) this.errors.push({ parameter: name, code: 'MISSING_PARAMETER', message: `${name} is required` });
      return undefined;
    }
    if (Array.isArray(value)) {
      return this.invalid(name, `${name} must be given only once`, value.join(','));
    }
    return String(value);
  }
}

import type { APIRequestContext } from '@playwright/test';
import { contractViolations } from './contract';

export interface ApiCall {
  method: string;
  /** Path relative to the API base URL, e.g. "/videos?limit=5". */
  path: string;
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

type Params = Record<string, string | number | boolean>;

const toQuery = (params: Params) => {
  const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString();
  return query ? `?${query}` : '';
};

/**
 * Client object for the catalogue API: the API-side counterpart of a page
 * object. Steps talk to this instead of building URLs themselves. The base URL
 * comes from config/environments/<TEST_ENV>.env.
 */
export class CatalogueApi {
  constructor(private readonly request: APIRequestContext) {}

  /**
   * Paths are relative to the base URL. The leading slash is dropped so that
   * "/videos" resolves under /api/v1/ rather than at the host root.
   */
  async send(method: string, path: string): Promise<ApiCall> {
    const response = await this.request.fetch(path.replace(/^\//, ''), { method, failOnStatusCode: false });
    const text = await response.text();
    let body: unknown = text;
    if (text && (response.headers()['content-type'] ?? '').includes('application/json')) {
      body = JSON.parse(text);
    }
    return { method, path, status: response.status(), headers: response.headers(), body };
  }

  get(path: string) {
    return this.send('GET', path);
  }

  listVideos(params: Params = {}) {
    return this.get(`/videos${toQuery(params)}`);
  }

  listChannels(params: Params = {}) {
    return this.get(`/channels${toQuery(params)}`);
  }

  viewStats(params: Params) {
    return this.get(`/stats/views${toQuery(params)}`);
  }

  dispose() {
    return this.request.dispose();
  }

  /**
   * Follows the pagination of a list endpoint and returns the items from every
   * page. Each page must be a 200 that matches the API contract.
   */
  async collectAll<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    const separator = path.includes('?') ? '&' : '?';
    for (let page = 1; ; page++) {
      const call = await this.get(`${path}${separator}page=${page}`);
      if (call.status !== 200) throw new Error(`GET ${call.path} returned ${call.status}: ${JSON.stringify(call.body)}`);
      const violations = contractViolations(call);
      if (violations.length) throw new Error(`GET ${call.path} does not match the API contract: ${violations.join('; ')}`);
      const { data, pagination } = call.body as { data: T[]; pagination: { totalPages: number } };
      items.push(...data);
      if (page >= pagination.totalPages) return items;
    }
  }
}

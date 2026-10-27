import { Then, When, type DataTable } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { TestWorld } from '../../support/world';

type Item = Record<string, unknown> & { id: string };

interface ListBody {
  data: Item[];
  pagination: { page: number; limit: number; totalItems: number; totalPages: number };
}

interface StatsBody {
  groupBy: 'category' | 'channel' | 'month';
  from: string | null;
  to: string | null;
  totals: { videos: number; views: number };
  groups: { key: string; label: string; videos: number; views: number; averageViews: number }[];
}

const collator = new Intl.Collator('en');
const compare = (a: unknown, b: unknown) =>
  typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b));

const list = (world: TestWorld) => world.lastResponse.body as ListBody;
const stats = (world: TestWorld) => world.lastResponse.body as StatsBody;
const ids = (items: Item[]) => items.map((item) => item.id);

/** Asserts sort order, including the documented tie-break on ascending id. */
function expectSorted(items: Item[], field: string, direction: string) {
  const sign = direction === 'descending' ? -1 : 1;
  for (let i = 1; i < items.length; i++) {
    const [previous, current] = [items[i - 1], items[i]];
    const order = sign * compare(previous[field], current[field]);
    const tieBrokenById = order === 0 && collator.compare(previous.id, current.id) < 0;
    expect(
      order < 0 || tieBrokenById,
      `${previous.id} (${previous[field]}) should come after ${current.id} (${current[field]}) when sorted by ${field} ${direction}`,
    ).toBe(true);
  }
}

Then('the page contains {int} items', function (this: TestWorld, count: number) {
  expect(list(this).data).toHaveLength(count);
});

Then('there are {int} matching items', function (this: TestWorld, total: number) {
  expect(list(this).pagination.totalItems).toBe(total);
});

Then(
  'the pagination shows page {int} of {int} with {int} items in total',
  function (this: TestWorld, page: number, totalPages: number, totalItems: number) {
    expect(list(this).pagination).toMatchObject({ page, totalPages, totalItems });
  },
);

Then('the first item is {string}', function (this: TestWorld, id: string) {
  expect(list(this).data[0]?.id).toBe(id);
});

Then('the item ids are {string}', function (this: TestWorld, expected: string) {
  expect(ids(list(this).data)).toEqual(expected ? expected.split(/,\s*/) : []);
});

Then('every item has {string} set to one of {string}', function (this: TestWorld, field: string, allowed: string) {
  const values = allowed.split(',');
  for (const item of list(this).data) {
    expect(values, `${item.id} has ${field}=${item[field]}`).toContain(String(item[field]));
  }
});

Then('every item has {string} between {int} and {int}', function (this: TestWorld, field: string, min: number, max: number) {
  for (const item of list(this).data) {
    const value = item[field] as number;
    expect(value >= min && value <= max, `${item.id} has ${field}=${value}`).toBe(true);
  }
});

Then('every item mentions {string} in its title or tags', function (this: TestWorld, term: string) {
  const needle = term.toLowerCase();
  for (const item of list(this).data) {
    const text = [item.title as string, ...(item.tags as string[])].join(' ').toLowerCase();
    expect(text, item.id).toContain(needle);
  }
});

Then('the items are sorted by {string} in {word} order', function (this: TestWorld, field: string, direction: string) {
  expect(['ascending', 'descending']).toContain(direction);
  expectSorted(list(this).data, field, direction);
});

When('I collect every page of {string}', async function (this: TestWorld, path: string) {
  this.collected = await this.api.collectAll<Item>(path);
});

Then('I have {int} different videos in title order', function (this: TestWorld, count: number) {
  const collected = this.collected as Item[];
  expect(new Set(ids(collected)).size).toBe(count);
  expect(collected).toHaveLength(count);
  expectSorted(collected, 'title', 'ascending');
});

Then(
  "each channel's {string} equals the number of videos the videos endpoint returns for it",
  async function (this: TestWorld, field: string) {
    for (const channel of list(this).data) {
      const videos = await this.api.listVideos({ channelId: channel.id, limit: 1 });
      expect((videos.body as ListBody).pagination.totalItems, channel.id).toBe(channel[field]);
    }
  },
);

Then(
  'there are {int} groups covering {number} videos and {number} views',
  function (this: TestWorld, groups: number, videos: number, views: number) {
    expect(stats(this).groups).toHaveLength(groups);
    expect(stats(this).totals).toEqual({ videos, views });
  },
);

Then('the groups are ordered by views, highest first', function (this: TestWorld) {
  const views = stats(this).groups.map((group) => group.views);
  expect(views).toEqual([...views].sort((a, b) => b - a));
});

Then('the group totals add up to the overall totals', function (this: TestWorld) {
  const { groups, totals } = stats(this);
  expect(groups.reduce((sum, group) => sum + group.videos, 0)).toBe(totals.videos);
  expect(groups.reduce((sum, group) => sum + group.views, 0)).toBe(totals.views);
});

Then('the groups are:', function (this: TestWorld, table: DataTable) {
  const number = (text: string) => Number(text.replace(/,/g, ''));
  const expected = table.hashes().map((row) => ({
    key: row.key,
    label: row.label,
    videos: number(row.videos),
    views: number(row.views),
    averageViews: number(row.averageViews),
  }));
  expect(stats(this).groups).toEqual(expected);
});

/**
 * Re-derives every group from GET /videos with the matching filter and checks
 * the counts, totals and averages. This is what ties /stats/views to /videos.
 */
Then("every group's totals match what the videos endpoint returns for it", async function (this: TestWorld) {
  const { groupBy, from, to, groups } = stats(this);
  for (const group of groups) {
    const params = new URLSearchParams({ limit: '50' });
    if (groupBy === 'category') params.set('category', group.key);
    if (groupBy === 'channel') params.set('channelId', group.key);
    let [start, end] = [from, to];
    if (groupBy === 'month') {
      const [year, month] = group.key.split('-').map(Number);
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const monthStart = `${group.key}-01`;
      const monthEnd = `${group.key}-${String(lastDay).padStart(2, '0')}`;
      start = start && start > monthStart ? start : monthStart;
      end = end && end < monthEnd ? end : monthEnd;
    }
    if (start) params.set('from', start);
    if (end) params.set('to', end);

    const videos = await this.api.collectAll<Item>(`/videos?${params}`);
    const views = videos.reduce((sum, video) => sum + (video.views as number), 0);
    expect({ videos: group.videos, views: group.views, averageViews: group.averageViews }, `group ${group.key}`).toEqual({
      videos: videos.length,
      views,
      averageViews: Math.round(views / videos.length),
    });
  }
});

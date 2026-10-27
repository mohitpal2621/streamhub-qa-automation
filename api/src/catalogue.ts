import channelData from '../data/channels.json';
import videoData from '../data/videos.json';

export const CATEGORIES = [
  'documentary',
  'education',
  'entertainment',
  'gaming',
  'music',
  'news',
  'sports',
  'technology',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Video {
  id: string;
  title: string;
  channelId: string;
  category: Category;
  tags: string[];
  durationSeconds: number;
  views: number;
  likes: number;
  publishedAt: string;
  live: boolean;
}

export interface Channel {
  id: string;
  name: string;
  handle: string;
  country: string;
  verified: boolean;
  subscribers: number;
  createdAt: string;
}

export const videos = videoData as Video[];
export const channels = channelData as Channel[];
export const channelsById = new Map(channels.map((channel) => [channel.id, channel]));

const collator = new Intl.Collator('en');

/**
 * Sorts by a field name, or by "-field" for descending order. Ties are broken
 * by id in ascending order so that paging through a sorted list is stable.
 */
export function sortBy<T extends { id: string }>(items: T[], sort: string): T[] {
  const descending = sort.startsWith('-');
  const field = (descending ? sort.slice(1) : sort) as keyof T;
  return [...items].sort((a, b) => {
    const x = a[field];
    const y = b[field];
    const order = typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(String(x), String(y));
    return (descending ? -order : order) || collator.compare(a.id, b.id);
  });
}

export function paginate<T>(items: T[], page: number, limit: number) {
  return {
    data: items.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, totalItems: items.length, totalPages: Math.ceil(items.length / limit) },
  };
}

/** UTC calendar date of an ISO timestamp, for comparing against from/to. */
export const publishedDate = (video: Video) => video.publishedAt.slice(0, 10);

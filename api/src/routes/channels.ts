import { Router } from 'express';
import { channels, paginate, sortBy, videos } from '../catalogue';
import { QueryReader } from '../query';
import { DEFAULT_LIMIT, LIMIT_RANGE, PAGE_RANGE, methodNotAllowed } from './shared';

const LIST_PARAMS = ['q', 'country', 'verified', 'minSubscribers', 'sort', 'page', 'limit'];
const SORTS = ['name', '-name', 'subscribers', '-subscribers', 'createdAt', '-createdAt'] as const;

const videoCounts = new Map<string, number>();
for (const video of videos) videoCounts.set(video.channelId, (videoCounts.get(video.channelId) ?? 0) + 1);

export const channelsRouter = Router();

channelsRouter
  .route('/')
  .get((req, res) => {
    const query = new QueryReader(req.query, LIST_PARAMS);
    const search = query.text('q', { minLength: 2, maxLength: 100 })?.toLowerCase();
    const country = query.matching('country', /^[A-Z]{2}$/, 'GB (two upper-case letters)');
    const verified = query.boolean('verified');
    const minSubscribers = query.integer('minSubscribers', { min: 0 });
    const sort = query.oneOf('sort', SORTS) ?? 'name';
    const page = query.integer('page', PAGE_RANGE) ?? 1;
    const limit = query.integer('limit', LIMIT_RANGE) ?? DEFAULT_LIMIT;
    query.throwIfInvalid();

    const matches = channels
      .filter(
        (channel) =>
          (!search || channel.name.toLowerCase().includes(search) || channel.handle.includes(search)) &&
          (!country || channel.country === country) &&
          (verified === undefined || channel.verified === verified) &&
          (minSubscribers === undefined || channel.subscribers >= minSubscribers),
      )
      .map((channel) => ({ ...channel, videoCount: videoCounts.get(channel.id) ?? 0 }));
    res.json(paginate(sortBy(matches, sort), page, limit));
  })
  .all(methodNotAllowed);

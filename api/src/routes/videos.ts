import { Router } from 'express';
import { CATEGORIES, channelsById, paginate, publishedDate, sortBy, videos } from '../catalogue';
import { ApiError } from '../errors';
import { QueryReader } from '../query';
import { DEFAULT_LIMIT, LIMIT_RANGE, PAGE_RANGE, methodNotAllowed } from './shared';

const LIST_PARAMS = ['q', 'category', 'channelId', 'live', 'minDuration', 'maxDuration', 'from', 'to', 'sort', 'page', 'limit'];
const SORTS = ['publishedAt', '-publishedAt', 'views', '-views', 'durationSeconds', '-durationSeconds', 'title', '-title'] as const;

export const videosRouter = Router();

videosRouter
  .route('/')
  .get((req, res) => {
    const query = new QueryReader(req.query, LIST_PARAMS);
    const search = query.text('q', { minLength: 2, maxLength: 100 })?.toLowerCase();
    const categories = query.listOf('category', CATEGORIES);
    const channelId = query.matching('channelId', /^ch_\d{3}$/, 'ch_001');
    const live = query.boolean('live');
    const minDuration = query.integer('minDuration', { min: 0 });
    const maxDuration = query.integer('maxDuration', { min: 0 });
    const from = query.date('from');
    const to = query.date('to');
    const sort = query.oneOf('sort', SORTS) ?? '-publishedAt';
    const page = query.integer('page', PAGE_RANGE) ?? 1;
    const limit = query.integer('limit', LIMIT_RANGE) ?? DEFAULT_LIMIT;
    if (minDuration !== undefined && maxDuration !== undefined) {
      query.ensure(minDuration <= maxDuration, 'maxDuration', 'maxDuration must not be less than minDuration');
    }
    if (from && to) query.ensure(from <= to, 'to', 'to must not be earlier than from');
    query.throwIfInvalid();

    const matches = videos.filter(
      (video) =>
        (!search || video.title.toLowerCase().includes(search) || video.tags.some((tag) => tag.includes(search))) &&
        (!categories || categories.includes(video.category)) &&
        (!channelId || video.channelId === channelId) &&
        (live === undefined || video.live === live) &&
        (minDuration === undefined || video.durationSeconds >= minDuration) &&
        (maxDuration === undefined || video.durationSeconds <= maxDuration) &&
        (!from || publishedDate(video) >= from) &&
        (!to || publishedDate(video) <= to),
    );
    res.json(paginate(sortBy(matches, sort), page, limit));
  })
  .all(methodNotAllowed);

videosRouter
  .route('/:videoId')
  .get((req, res) => {
    const query = new QueryReader(req.query, []);
    const { videoId } = req.params;
    if (!/^vid_\d{3}$/.test(videoId)) query.invalid('videoId', 'videoId must look like vid_001', videoId);
    query.throwIfInvalid();

    const video = videos.find((v) => v.id === videoId);
    if (!video) throw new ApiError(404, 'NOT_FOUND', `No video with id ${videoId}`);
    const { id, name, handle, verified } = channelsById.get(video.channelId)!;
    res.json({ ...video, channel: { id, name, handle, verified } });
  })
  .all(methodNotAllowed);

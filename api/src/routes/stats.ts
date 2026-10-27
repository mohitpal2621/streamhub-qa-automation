import { Router } from 'express';
import { channelsById, publishedDate, videos, type Video } from '../catalogue';
import { QueryReader } from '../query';
import { methodNotAllowed } from './shared';

const GROUPINGS = ['category', 'channel', 'month'] as const;
type Grouping = (typeof GROUPINGS)[number];

const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const groupKey: Record<Grouping, (video: Video) => { key: string; label: string }> = {
  category: (video) => ({ key: video.category, label: video.category }),
  channel: (video) => ({ key: video.channelId, label: channelsById.get(video.channelId)!.name }),
  month: (video) => ({ key: video.publishedAt.slice(0, 7), label: monthLabel.format(new Date(video.publishedAt)) }),
};

export const statsRouter = Router();

statsRouter
  .route('/views')
  .get((req, res) => {
    const query = new QueryReader(req.query, ['groupBy', 'from', 'to', 'top']);
    const groupBy = query.oneOf('groupBy', GROUPINGS, { required: true });
    const from = query.date('from');
    const to = query.date('to');
    const top = query.integer('top', { min: 1, max: 20 });
    if (from && to) query.ensure(from <= to, 'to', 'to must not be earlier than from');
    query.throwIfInvalid();

    const inRange = videos.filter((video) => (!from || publishedDate(video) >= from) && (!to || publishedDate(video) <= to));
    const groups = new Map<string, { key: string; label: string; videos: number; views: number }>();
    for (const video of inRange) {
      const { key, label } = groupKey[groupBy!](video);
      const group = groups.get(key) ?? { key, label, videos: 0, views: 0 };
      group.videos += 1;
      group.views += video.views;
      groups.set(key, group);
    }
    const ranked = [...groups.values()]
      .sort((a, b) => b.views - a.views || a.key.localeCompare(b.key))
      .map((group) => ({ ...group, averageViews: Math.round(group.views / group.videos) }));

    res.json({
      groupBy,
      from: from ?? null,
      to: to ?? null,
      totals: { videos: inRange.length, views: inRange.reduce((sum, video) => sum + video.views, 0) },
      groups: top ? ranked.slice(0, top) : ranked,
    });
  })
  .all(methodNotAllowed);

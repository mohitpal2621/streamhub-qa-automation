import express from 'express';
import { ApiError, errorHandler } from './errors';
import { channelsRouter } from './routes/channels';
import { methodNotAllowed } from './routes/shared';
import { statsRouter } from './routes/stats';
import { videosRouter } from './routes/videos';

export function createApp({ logRequests = false } = {}) {
  const app = express();
  app.disable('x-powered-by');

  if (logRequests) {
    app.use((req, res, next) => {
      const started = Date.now();
      res.on('finish', () => console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started} ms)`));
      next();
    });
  }

  const api = express.Router();
  api
    .route('/health')
    .get((_req, res) => {
      res.json({ status: 'ok' });
    })
    .all(methodNotAllowed);
  api.use('/videos', videosRouter);
  api.use('/channels', channelsRouter);
  api.use('/stats', statsRouter);

  app.use('/api/v1', api);
  app.use((req) => {
    throw new ApiError(404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`);
  });
  app.use(errorHandler);
  return app;
}

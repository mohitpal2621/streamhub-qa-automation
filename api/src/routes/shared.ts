import type { RequestHandler } from 'express';
import { ApiError } from '../errors';

export const methodNotAllowed: RequestHandler = (req, res) => {
  res.set('Allow', 'GET, HEAD');
  throw new ApiError(405, 'METHOD_NOT_ALLOWED', `${req.method} is not supported on ${req.originalUrl.split('?')[0]}`);
};

export const PAGE_RANGE = { min: 1, max: 10_000 };
export const LIMIT_RANGE = { min: 1, max: 50 };
export const DEFAULT_LIMIT = 10;

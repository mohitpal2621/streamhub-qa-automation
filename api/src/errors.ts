import type { ErrorRequestHandler } from 'express';

export type ParameterErrorCode = 'UNKNOWN_PARAMETER' | 'MISSING_PARAMETER' | 'INVALID_PARAMETER';
export type ErrorCode = ParameterErrorCode | 'NOT_FOUND' | 'METHOD_NOT_ALLOWED' | 'INTERNAL_ERROR';

export interface ParameterError {
  parameter: string;
  code: ParameterErrorCode;
  message: string;
  value?: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details: ParameterError[] = [],
  ) {
    super(message);
  }
}

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  // Express sets status 400 when a path segment is not valid percent-encoding.
  if ((err as { status?: number }).status === 400) {
    return new ApiError(400, 'INVALID_PARAMETER', 'The request URL is malformed');
  }
  return new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong on our side');
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const apiError = toApiError(err);
  if (apiError.status >= 500) console.error(err);
  res.status(apiError.status).json({
    error: {
      status: apiError.status,
      code: apiError.code,
      message: apiError.message,
      details: apiError.details,
    },
  });
};

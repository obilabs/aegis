/**
 * Standardized Error Codes — Helios-inspired pattern.
 *
 * All new API routes (v1.0+) should use these codes via the response helpers
 * in `lib/api-response.ts`. Existing routes are NOT retrofitted.
 */

export enum ErrorCode {
  // 400 Bad Request
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // 401 Unauthorized
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_API_KEY = 'INVALID_API_KEY',
  API_KEY_EXPIRED = 'API_KEY_EXPIRED',

  // 403 Forbidden
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  FEATURE_DISABLED = 'FEATURE_DISABLED',

  // 404 Not Found
  NOT_FOUND = 'NOT_FOUND',
  ENTITY_NOT_FOUND = 'ENTITY_NOT_FOUND',

  // 409 Conflict
  CONFLICT = 'CONFLICT',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',

  // 422 Unprocessable Entity
  UNPROCESSABLE = 'UNPROCESSABLE',

  // 429 Rate Limited
  RATE_LIMITED = 'RATE_LIMITED',

  // 500 Internal Server Error
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

/** Maps each ErrorCode to its default HTTP status */
export const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  // 400
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,

  // 401
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.INVALID_CREDENTIALS]: 401,
  [ErrorCode.SESSION_EXPIRED]: 401,
  [ErrorCode.INVALID_API_KEY]: 401,
  [ErrorCode.API_KEY_EXPIRED]: 401,

  // 403
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCode.FEATURE_DISABLED]: 403,

  // 404
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.ENTITY_NOT_FOUND]: 404,

  // 409
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.DUPLICATE_ENTRY]: 409,

  // 422
  [ErrorCode.UNPROCESSABLE]: 422,

  // 429
  [ErrorCode.RATE_LIMITED]: 429,

  // 500
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.ENCRYPTION_ERROR]: 500,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
}

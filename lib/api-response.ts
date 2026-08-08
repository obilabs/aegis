/**
 * Standardized API Response Helpers — Helios-inspired pattern.
 *
 * All new API routes (v1.0+) should use these helpers instead of inline
 * `NextResponse.json()`. Existing routes are NOT retrofitted.
 *
 * Response shape:
 *   Success: { success: true, data: T, meta: { requestId, timestamp, ...pagination } }
 *   Error:   { success: false, error: { code, message, details? }, meta: { requestId, timestamp } }
 */

import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { type ZodError } from 'zod'
import { ErrorCode, ERROR_STATUS_MAP } from './error-codes'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApiMeta {
  requestId: string
  timestamp: string
  page?: number
  perPage?: number
  total?: number
  totalPages?: number
}

interface ApiSuccessResponse<T> {
  success: true
  data: T
  meta: ApiMeta
}

interface ApiErrorDetail {
  field?: string
  message: string
}

interface ApiErrorResponse {
  success: false
  error: {
    code: ErrorCode
    message: string
    details?: ApiErrorDetail[]
  }
  meta: Pick<ApiMeta, 'requestId' | 'timestamp'>
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMeta(extra?: Partial<ApiMeta>): ApiMeta {
  return {
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...extra,
  }
}

// ─── Success Responses ──────────────────────────────────────────────────────

/** Standard success response (200 by default) */
export function successResponse<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({
    success: true as const,
    data,
    meta: createMeta(),
  }, { status })
}

/** 201 Created response */
export function createdResponse<T>(data: T): NextResponse<ApiSuccessResponse<T>> {
  return successResponse(data, 201)
}

/** 204 No Content (for deletes) — returns empty body */
export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

/** Paginated list response */
export function paginatedResponse<T>(
  data: T[],
  pagination: { page: number; perPage: number; total: number },
): NextResponse<ApiSuccessResponse<T[]>> {
  const totalPages = Math.ceil(pagination.total / pagination.perPage)
  return NextResponse.json({
    success: true as const,
    data,
    meta: createMeta({
      page: pagination.page,
      perPage: pagination.perPage,
      total: pagination.total,
      totalPages,
    }),
  })
}

// ─── Error Responses ────────────────────────────────────────────────────────

/** Generic error response — looks up HTTP status from ErrorCode */
export function errorResponse(
  code: ErrorCode,
  message: string,
  details?: ApiErrorDetail[],
  statusOverride?: number,
): NextResponse<ApiErrorResponse> {
  const status = statusOverride ?? ERROR_STATUS_MAP[code] ?? 500
  return NextResponse.json({
    success: false as const,
    error: {
      code,
      message,
      ...(details?.length ? { details } : {}),
    },
    meta: {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  }, { status })
}

/** 401 Unauthorized */
export function unauthorizedResponse(message = 'Authentication required'): NextResponse<ApiErrorResponse> {
  return errorResponse(ErrorCode.UNAUTHORIZED, message)
}

/** 403 Forbidden */
export function forbiddenResponse(message = 'Access denied'): NextResponse<ApiErrorResponse> {
  return errorResponse(ErrorCode.FORBIDDEN, message)
}

/** 404 Not Found */
export function notFoundResponse(entity: string, id?: string): NextResponse<ApiErrorResponse> {
  const message = id ? `${entity} '${id}' not found` : `${entity} not found`
  return errorResponse(ErrorCode.ENTITY_NOT_FOUND, message)
}

/** Zod validation error → structured field-level details */
export function validationErrorResponse(zodError: ZodError): NextResponse<ApiErrorResponse> {
  const details: ApiErrorDetail[] = zodError.issues.map((issue) => ({
    field: issue.path.join('.') || undefined,
    message: issue.message,
  }))
  return errorResponse(ErrorCode.VALIDATION_ERROR, 'Validation failed', details)
}

/** 409 Conflict / Duplicate */
export function conflictResponse(message = 'Resource already exists'): NextResponse<ApiErrorResponse> {
  return errorResponse(ErrorCode.CONFLICT, message)
}

/** 429 Rate Limited */
export function rateLimitedResponse(message = 'Too many requests'): NextResponse<ApiErrorResponse> {
  return errorResponse(ErrorCode.RATE_LIMITED, message)
}

/** 500 Internal Error — logs to console, returns sanitized message */
export function internalErrorResponse(error: unknown, context?: string): NextResponse<ApiErrorResponse> {
  const msg = error instanceof Error ? error.message : 'Unknown error'
  console.error(`[api-error]${context ? ` ${context}:` : ''}`, msg)
  return errorResponse(ErrorCode.INTERNAL_ERROR, 'An internal error occurred')
}

// ─── Re-export ErrorCode for convenience ────────────────────────────────────

export { ErrorCode } from './error-codes'

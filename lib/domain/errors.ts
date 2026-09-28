import { ErrorCodeSchema, type ErrorCode } from '@/contracts';

/**
 * Domain-level errors and the database-error translation they depend on.
 *
 * Deliberately free of any HTTP import so the domain layer can be used from a
 * Server Component, a Server Action or a route handler without pulling
 * `next/server` along. `lib/security/api.ts` re-exports these.
 */

/**
 * An error that is safe to show a client.
 *
 * Anything thrown that is not an ApiError is reported to the user as INTERNAL
 * with a fixed message, so stack traces, SQL text and PostgREST internals never
 * reach a response body or a rendered page.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly fields?: Record<string, string>;

  constructor(code: ErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.fields = fields;
  }

  static unauthorized(message = 'Authentication required.') {
    return new ApiError('UNAUTHORIZED', message);
  }
  static forbidden(message = 'Not permitted.') {
    return new ApiError('FORBIDDEN', message);
  }
  /**
   * The single not-found response.
   *
   * Used for both "row does not exist" and "row belongs to another site". The
   * caller cannot distinguish the two, which is what stops a staff member from
   * probing ids to learn whether they exist.
   */
  static notFound() {
    return new ApiError('NOT_FOUND', 'Not found.');
  }
  static validation(fields: Record<string, string>, message = 'Invalid request.') {
    return new ApiError('VALIDATION', message, fields);
  }
}

/** True for the codes that mean "the caller is not allowed to do this". */
export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'UNAUTHORIZED';
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'NOT_FOUND';
}

/**
 * Translates a PostgREST error into a client-safe ApiError.
 *
 * Every branch either maps to a specific, actionable code or collapses to a
 * fixed INTERNAL message. The raw `error.message` is never returned: PostgREST
 * messages quote table, column and constraint names.
 */
export function fromPostgrest(error: { code?: string; message: string }): ApiError {
  switch (error.code) {
    case '23505':
      return new ApiError('VALIDATION', 'A record with these values already exists.');
    case '23503':
      return new ApiError('VALIDATION', 'Referenced record does not exist.');
    case '23514':
      return new ApiError('VALIDATION', 'Value violates a database constraint.');
    case '42501':
      // PostgreSQL `insufficient_privilege`: a row-level security policy
      // refused the statement. Surface it as NOT_FOUND, not FORBIDDEN, so the
      // response is identical to a genuinely absent row.
      return ApiError.notFound();
    default:
      return new ApiError('INTERNAL', 'Request could not be completed.');
  }
}

export { ErrorCodeSchema };

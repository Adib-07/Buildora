import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ZodError, type ZodType } from 'zod';

import { errorStatus, type ErrorCode, type ErrorResponse, type Role } from '@/contracts';

import {
  cookieStoreFromNext,
  createSessionClient,
  resolveSessionUser,
  type SessionUser,
} from '@/lib/auth/session';
import { logger, newRequestId } from '@/lib/security/logger';

/**
 * An error that is safe to show a client.
 *
 * Anything thrown that is not an ApiError is reported as INTERNAL with a fixed
 * message, so stack traces, SQL text and PostgREST internals never reach the
 * response body. They go to the log with the request id instead.
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
   * caller cannot distinguish the two, which is what stops a site-B staff member
   * from probing site-A ids to learn whether they exist.
   */
  static notFound() {
    return new ApiError('NOT_FOUND', 'Not found.');
  }
  static validation(fields: Record<string, string>, message = 'Invalid request.') {
    return new ApiError('VALIDATION', message, fields);
  }
}

/** Translates a PostgREST error into a client-safe ApiError. */
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

export type ApiContext = {
  requestId: string;
  db: SupabaseClient;
  user: SessionUser;
};

type Options<T, B, Q> = {
  /** Response schema. The handler's return value is parsed before it is sent,
   *  so a response that violates the contract fails in development rather than
   *  reaching the client. */
  response: ZodType<T>;
  /** JSON body schema. A parse failure is VALIDATION (422) with per-field keys. */
  body?: ZodType<B>;
  /** Query-string schema, parsed from the raw search string. */
  query?: ZodType<Q>;
  /** Roles permitted to call the route. Omit to allow any authenticated role. */
  roles?: readonly Role[];
  /** Set false only for routes that establish their own identity. */
  auth?: boolean;
  handler: (ctx: ApiContext & { input: { body: B; query: Q } }) => Promise<T>;
};

function fieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_root';
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

function errorResponse(requestId: string, error: ApiError) {
  const body: ErrorResponse = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
    },
    requestId,
  };
  return NextResponse.json(body, {
    status: errorStatus[error.code],
    headers: { 'x-request-id': requestId },
  });
}

export function withApi<T, B = undefined, Q = undefined>(options: Options<T, B, Q>) {
  const { response, body, query, roles, auth = true, handler } = options;

  return async (request: Request): Promise<NextResponse> => {
    const requestId = newRequestId();
    const started = Date.now();

    try {
      const url = new URL(request.url);
      let parsedBody = undefined as B;
      let parsedQuery = undefined as Q;

      if (query) {
        const raw: Record<string, string> = {};
        for (const [key, value] of url.searchParams) raw[key] = value;
        parsedQuery = query.parse(raw) as Q;
      }

      if (body) {
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          throw ApiError.validation({ _: 'Request body must be valid JSON.' });
        }
        parsedBody = body.parse(json) as B;
      }

      const { cookies } = await import('next/headers');
      const db = createSessionClient(cookieStoreFromNext(await cookies()));

      let user: SessionUser | null = null;
      if (auth) {
        user = await resolveSessionUser(db);
        if (!user) throw ApiError.unauthorized();
        if (roles && !roles.includes(user.role)) throw ApiError.forbidden();
      }

      const data = await handler({
        requestId,
        db,
        user: user as SessionUser,
        input: { body: parsedBody, query: parsedQuery },
      });

      let parsed: T;
      try {
        parsed = response.parse(data);
      } catch (error) {
        // The handler produced something that violates the contract. That is a
        // server fault, not a client error, so it must not surface as 422 --
        // reporting it as VALIDATION would blame the caller for our bug.
        logger.error(
          {
            requestId,
            route: url.pathname,
            issues: error instanceof ZodError ? error.issues : undefined,
          },
          'response violates its contract schema',
        );
        throw new ApiError('INTERNAL', 'Request could not be completed.');
      }

      logger.info(
        { requestId, route: url.pathname, status: 200, durationMs: Date.now() - started },
        'api ok',
      );
      return NextResponse.json(parsed, { headers: { 'x-request-id': requestId } });
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : error instanceof ZodError
            ? ApiError.validation(fieldErrors(error))
            : new ApiError('INTERNAL', 'Request could not be completed.');

      if (apiError.code === 'INTERNAL') {
        // Full detail stays server-side.
        logger.error(
          { requestId, err: error instanceof Error ? error.message : String(error) },
          'api failed',
        );
      } else {
        logger.info({ requestId, code: apiError.code }, 'api rejected');
      }

      return errorResponse(requestId, apiError);
    }
  };
}

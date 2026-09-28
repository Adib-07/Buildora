import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ZodError, type ZodType } from 'zod';

import { errorStatus, type ErrorResponse, type Role } from '@/contracts';

import {
  cookieStoreFromNext,
  createSessionClient,
  resolveSessionUser,
  type SessionUser,
} from '@/lib/auth/session';
import { ApiError, fromPostgrest } from '@/lib/domain/errors';
import { serviceRoleClient } from '@/lib/db/service-role';
import { logger, newRequestId } from '@/lib/security/logger';

export type ApiContext = {
  requestId: string;
  /** Reads run as the signed-in user, so RLS scopes every query to the caller's
   *  own site. This is the tenant-isolation boundary. */
  db: SupabaseClient;
  user: SessionUser;
  /**
   * Writes run with the service role, because the rules that guard them
   * (expectedVersion, the day lock, exactly one task owner) live in this layer
   * and must not be skippable by a caller holding a valid JWT.
   *
   * A getter, so the key is only required by routes that actually write: a
   * read-only deployment does not need `SUPABASE_SERVICE_ROLE_KEY` at all.
   */
  readonly writer: SupabaseClient;
  /** Dynamic route segments, already resolved by Next. */
  params: Record<string, string>;
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

  return async (
    request: Request,
    context?: { params?: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const requestId = newRequestId();
    const started = Date.now();

    try {
      const url = new URL(request.url);
      let parsedBody = undefined as B;
      let parsedQuery = undefined as Q;
      // Next resolves dynamic segments before the handler runs; await the
      // promise so handlers see plain values.
      const params = (await context?.params) ?? {};

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
        get writer() {
          return serviceRoleClient();
        },
        params,
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

export { ApiError, fromPostgrest };

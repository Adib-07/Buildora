// Guards the distinction between a caller mistake and our own mistake: a
// handler that returns something violating its contract schema is an internal
// fault (500) and must not be reported to the client as VALIDATION (422).
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { withApi } from '@/lib/security/api';
import { ErrorResponseSchema } from '@/contracts';

describe('response contract enforcement', () => {
  it('reports a contract-violating handler as INTERNAL, not VALIDATION', async () => {
    const route = withApi({
      auth: false,
      response: z.object({ ok: z.boolean() }),
      handler: async () => ({ ok: 'not-a-boolean' }) as never,
    });
    const response = await route(new Request('http://localhost/x', { method: 'POST' }));
    expect(response.status).toBe(500);
    const body = ErrorResponseSchema.parse(await response.json());
    expect(body.error.code).toBe('INTERNAL');
    // Must not leak the internals of the failure.
    expect(body.error.message).not.toMatch(/zod|schema|boolean/i);
  });
});

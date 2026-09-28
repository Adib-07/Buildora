import { ApiError } from '@/lib/domain/errors';
import { isDemoMode } from '@/lib/config/env';

/**
 * Gate for every `/api/demo/*` route.
 *
 * These endpoints exist so a demo can be driven by hand without a live SMS
 * gateway. That makes them a way to write to `public.inbound_messages` and flip
 * `sites.demo_now`, which is exactly the kind of thing that must not be
 * reachable on a production deployment.
 *
 * The check is server-side and not configurable from the client, and it is
 * paired with `sites.demo_now` being NULL and the demo endpoints being absent
 * from any production build intent. When DEMO_MODE is off every route below
 * answers FORBIDDEN -- indistinguishable from a route that was never deployed.
 *
 * `publicEnvSchema` and this guard read the same variable, so there is one
 * answer to "is this a demo build" rather than two that can disagree.
 */
export function requireDemoMode(): void {
  if (!isDemoMode()) {
    throw ApiError.forbidden('Demo mode is not enabled on this deployment.');
  }
}

/**
 * Prefix that marks a row as created by the simulator rather than by a real
 * gateway. `POST /api/demo/reset` deletes exactly these, so a reset cannot
 * reach a message a real worker sent.
 */
export const DEMO_PROVIDER_PREFIX = 'demo:';

import { Effect, Layer } from 'effect';
import type { Limits } from '../../config/limits.ts';
import type { RequestBoundary } from '../server-factory.ts';
import type { AuthenticateOptions } from '../hooks/authenticate.ts';
import {
  authenticateLiveViewer,
  type LiveTicketOptions,
} from '../hooks/live-ticket.ts';
import {
  checkRequestOrigin,
  type RequestOriginOptions,
} from '../hooks/request-origin.ts';
import { requestPolicy } from '../hooks/request-policy.ts';
import {
  liveUpdates,
  type LiveUpdatesOptions,
} from '../protocol/live-updates.ts';

export type LiveUseCases = AuthenticateOptions &
  LiveUpdatesOptions & {
    access: RequestOriginOptions['access'] & LiveTicketOptions['access'];
  };
export function liveScope(options: {
  boundary: RequestBoundary;
  limits: Limits;
  application: LiveUseCases;
  allowedHosts: readonly string[];
}) {
  return liveUpdates(options.application).pipe(
    Layer.provide(
      requestPolicy(
        checkRequestOrigin(
          {
            access: options.application.access,
            allowedHosts: options.allowedHosts,
          },
          { crossOrigin: 'ticket', requireSameOrigin: true },
        ).pipe(
          Effect.andThen(
            authenticateLiveViewer(options.application, {
              cookieMaxAgeSeconds:
                options.limits.access.device.cookieMaxAgeSeconds,
            }),
          ),
        ),
      ).combine(options.boundary).layer,
    ),
  );
}

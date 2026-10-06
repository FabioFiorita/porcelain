import type { RequestBoundary } from '../server-factory.ts';
import { Effect, Layer } from 'effect';
import { HttpRouter } from 'effect/http';
import type { Limits } from '../../config/limits.ts';
import type { AuthenticateOptions } from '../hooks/authenticate.ts';
import { corsPreflight } from '../hooks/cross-origin-clients.ts';
import { preventCaching } from '../hooks/prevent-caching.ts';
import {
  checkRequestOrigin,
  type RequestOriginOptions,
} from '../hooks/request-origin.ts';
import { requestPolicy } from '../hooks/request-policy.ts';
import { hostScope, type HostUseCases } from './host.ts';
import { liveScope, type LiveUseCases } from './live.ts';
import { pairedScope, type PairedUseCases } from './paired.ts';
import { publicScope, type PublicUseCases } from './public.ts';

export type ApiUseCases = LiveUseCases &
  PairedUseCases &
  AuthenticateOptions & {
    access: PublicUseCases['access'] &
      RequestOriginOptions['access'] &
      HostUseCases['access'];
  };
export function apiScope(options: {
  boundary: RequestBoundary;
  application: ApiUseCases;
  allowedHosts: readonly string[];
  limits: Limits;
}) {
  const { application, allowedHosts, limits } = options;
  const origins = { access: application.access, allowedHosts };
  return Layer.mergeAll(
    liveScope(options),
    publicScope(options),
    pairedScope({
      ...options,
      boundary: requestPolicy(
        checkRequestOrigin(origins, { crossOrigin: 'bearer' }),
      ).combine(options.boundary),
    }),
    hostScope({
      ...options,
      boundary: requestPolicy(
        checkRequestOrigin(origins, { crossOrigin: 'refused' }),
      ).combine(options.boundary),
    }),
    corsPreflight({ maxAgeSeconds: limits.http.corsMaxAgeSeconds }).pipe(
      Layer.provide(requestPolicy(Effect.void).combine(options.boundary).layer),
    ),
  ).pipe(Layer.provide(HttpRouter.middleware(preventCaching).layer));
}

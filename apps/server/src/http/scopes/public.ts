import type { RequestBoundary } from '../server-factory.ts';
import { Effect, Layer } from 'effect';
import type { Limits } from '../../config/limits.ts';
import type { HttpApplication } from '../application.ts';
import {
  clearBrowserCredential,
  requireBrowserRequest,
} from '../hooks/browser-credential.ts';
import {
  pairingResponse,
  takePairingAttempt,
  type PairingAttemptOptions,
} from '../hooks/pairing-attempts.ts';
import {
  checkRequestOrigin,
  type RequestOriginOptions,
} from '../hooks/request-origin.ts';
import { requestPolicy } from '../hooks/request-policy.ts';

export type PublicUseCases = {
  access: PairingAttemptOptions['access'] &
    RequestOriginOptions['access'] & {
      routes: {
        public: HttpApplication;
        browser: HttpApplication;
        pairing: HttpApplication;
      };
    };
};
export function publicScope(options: {
  boundary: RequestBoundary;
  application: PublicUseCases;
  allowedHosts: readonly string[];
  limits: Limits;
}) {
  const { application } = options;
  const origins = {
    access: application.access,
    allowedHosts: options.allowedHosts,
  };
  return Layer.mergeAll(
    application.access.routes.public.pipe(
      Layer.provide(
        requestPolicy(
          checkRequestOrigin(origins, { crossOrigin: 'refused' }),
        ).combine(options.boundary).layer,
      ),
    ),
    application.access.routes.browser.pipe(
      Layer.provide(
        requestPolicy(
          checkRequestOrigin(origins, { crossOrigin: 'refused' }).pipe(
            Effect.andThen(requireBrowserRequest),
            Effect.andThen(clearBrowserCredential),
          ),
        ).combine(options.boundary).layer,
      ),
    ),
    application.access.routes.pairing.pipe(
      Layer.provide(
        requestPolicy(
          checkRequestOrigin(origins, { crossOrigin: 'anyone' }).pipe(
            Effect.andThen(takePairingAttempt(application)),
          ),
          pairingResponse(application, {
            cookieMaxAgeSeconds:
              options.limits.access.device.cookieMaxAgeSeconds,
          }),
        ).combine(options.boundary).layer,
      ),
    ),
  );
}

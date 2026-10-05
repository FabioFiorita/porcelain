import type { RequestBoundary } from '../server-factory.ts';
import { Effect, Layer } from 'effect';
import type { Limits } from '../../config/limits.ts';
import type { HttpApplication } from '../application.ts';
import {
  authenticate,
  type AuthenticateOptions,
} from '../hooks/authenticate.ts';
import {
  recognizeLocalRequest,
  type LocalDeviceOptions,
} from '../hooks/local-device.ts';
import { requestPolicy } from '../hooks/request-policy.ts';

export type PairedUseCases = {
  access: LocalDeviceOptions['access'] & {
    routes: { session: HttpApplication; updates: HttpApplication };
  };
  projects: HttpApplication;
  files: HttpApplication;
  changes: HttpApplication;
  reviews: HttpApplication;
  gitActions: HttpApplication;
};
export function pairedScope(options: {
  boundary: RequestBoundary;
  application: PairedUseCases & AuthenticateOptions;
  limits: Limits;
}) {
  const { application, limits } = options;
  const authenticated = authenticate(application, {
    cookieMaxAgeSeconds: limits.access.device.cookieMaxAgeSeconds,
  });
  return Layer.mergeAll(
    application.access.routes.updates.pipe(
      Layer.provide(
        requestPolicy(
          authenticated.pipe(
            Effect.andThen(recognizeLocalRequest(application)),
          ),
        ).combine(options.boundary).layer,
      ),
    ),
    Layer.mergeAll(
      application.access.routes.session,
      application.gitActions,
      application.reviews,
      application.files,
      application.changes,
      application.projects,
    ).pipe(
      Layer.provide(
        requestPolicy(authenticated).combine(options.boundary).layer,
      ),
    ),
  );
}

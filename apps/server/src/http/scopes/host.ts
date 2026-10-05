import type { RequestBoundary } from '../server-factory.ts';
import { Effect, Layer } from 'effect';
import type { Limits } from '../../config/limits.ts';
import type { HttpApplication } from '../application.ts';
import {
  authenticate,
  type AuthenticateOptions,
} from '../hooks/authenticate.ts';
import {
  requireLocalDevice,
  type LocalDeviceOptions,
} from '../hooks/local-device.ts';
import { requestPolicy } from '../hooks/request-policy.ts';

export type HostUseCases = {
  access: LocalDeviceOptions['access'] & { routes: { host: HttpApplication } };
};
export function hostScope(options: {
  boundary: RequestBoundary;
  application: HostUseCases & AuthenticateOptions;
  limits: Limits;
}) {
  return options.application.access.routes.host.pipe(
    Layer.provide(
      requestPolicy(
        authenticate(options.application, {
          cookieMaxAgeSeconds: options.limits.access.device.cookieMaxAgeSeconds,
        }).pipe(Effect.andThen(requireLocalDevice(options.application))),
      ).combine(options.boundary).layer,
    ),
  );
}

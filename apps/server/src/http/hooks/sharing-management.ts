import { Effect } from 'effect';
import type { AuthorizeSharingUseCasePort } from '../../ports/authorize-sharing-use-case-port.ts';
import { RequestError } from '../../runtime/errors/request-error.ts';
import { RequestContext } from '../request-context.ts';

export type SharingManagementOptions = {
  access: { authorizeSharing: AuthorizeSharingUseCasePort };
};

export function requireSharingManagement(options: SharingManagementOptions) {
  return Effect.gen(function* () {
    const context = yield* RequestContext;
    const viewer = context.principal;
    if (
      !viewer ||
      !(yield* options.access.authorizeSharing.execute({
        viewer,
        local: context.local,
        route: context.client.route,
      }))
    )
      return yield* Effect.die(
        new RequestError({
          statusCode: 403,
          message:
            'This device cannot manage sharing. Allow it from a device with sharing access.',
        }),
      );
  });
}

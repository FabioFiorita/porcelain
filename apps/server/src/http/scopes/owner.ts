import { Effect, Layer } from 'effect';
import { HttpRouter } from 'effect/http';
import type { HttpApplication } from '../application.ts';
import type { RequestBoundary } from '../server-factory.ts';
import { preventCaching } from '../hooks/prevent-caching.ts';
import { requestPolicy } from '../hooks/request-policy.ts';

export type OwnerUseCases = {
  access: { routes: { owner: HttpApplication } };
  comments: { owner: HttpApplication };
};
export function ownerScope(options: {
  boundary: RequestBoundary;
  application: OwnerUseCases;
}) {
  return Layer.mergeAll(
    options.application.access.routes.owner,
    options.application.comments.owner,
  ).pipe(
    Layer.provide(requestPolicy(Effect.void).combine(options.boundary).layer),
    Layer.provide(HttpRouter.middleware(preventCaching).layer),
  );
}

import { Effect, Layer } from 'effect';
import { HttpRouter } from 'effect/http';
import type { Limits } from '../../config/limits.ts';
import type { HttpApplication } from '../application.ts';
import type { RequestBoundary } from '../server-factory.ts';
import { preventCaching } from '../hooks/prevent-caching.ts';
import { requestPolicy } from '../hooks/request-policy.ts';
import type { ReviewMcpUseCases } from '../mcp/review-server.ts';
import { reviewMcp } from '../protocol/mcp.ts';

export type OwnerUseCases = ReviewMcpUseCases & {
  access: { routes: { owner: HttpApplication } };
};
export function ownerScope(options: {
  boundary: RequestBoundary;
  application: OwnerUseCases;
  limits: Limits;
}) {
  return Layer.mergeAll(
    options.application.access.routes.owner,
    reviewMcp({ useCases: options.application, limits: options.limits.http }),
  ).pipe(
    Layer.provide(requestPolicy(Effect.void).combine(options.boundary).layer),
    Layer.provide(HttpRouter.middleware(preventCaching).layer),
  );
}

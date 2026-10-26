import { Context, Effect, Layer } from 'effect';
import type { Review } from '../models/review.ts';
import type {
  ReviewLinks,
  ReviewLinkRoutes,
} from '../models/review-management.ts';

export class BuildReviewLinksService extends Context.Service<
  BuildReviewLinksService,
  {
    readonly execute: (input: {
      review: Review;
      environmentId: string;
      routes: ReviewLinkRoutes;
    }) => Effect.Effect<ReviewLinks>;
  }
>()('@porcelain/reviews/BuildReviewLinksService') {
  static readonly layer = Layer.effect(
    BuildReviewLinksService,
    Effect.sync(() => ({
      execute: Effect.fn('BuildReviewLinksService.execute')((input) =>
        Effect.sync(() => {
          const { review, routes } = input;
          const origin = routes.origins[0];
          if (origin === undefined)
            return {
              kind: 'unavailable' as const,
              reason: 'no-reachable-route' as const,
            };
          const route = new URL(origin);
          const link = (revision?: number, decision?: string) => {
            const path = `/reviews/${review.reviewId}${revision === undefined ? '' : `/${revision}`}${decision === undefined ? '' : `/decisions/${decision}`}`;
            const app = new URL(
              `/open/reviews/${review.reviewId}`,
              input.routes.hubOrigin,
            );
            app.searchParams.set('environment', input.environmentId);
            app.searchParams.set('host', route.host);
            app.searchParams.set('protocol', route.protocol.slice(0, -1));
            if (revision !== undefined)
              app.searchParams.set('revision', String(revision));
            if (decision !== undefined)
              app.searchParams.set('decision', decision);
            return { web: `${route.origin}${path}`, app: app.toString() };
          };
          return {
            kind: 'available' as const,
            ...link(),
            revision: link(review.revision),
            decisions: review.layers.map((layer) => ({
              layerId: layer.id,
              ...link(review.revision, layer.id),
            })),
          };
        }),
      ),
    })),
  );
}

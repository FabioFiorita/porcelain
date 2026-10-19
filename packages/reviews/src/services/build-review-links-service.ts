import { Context, Effect, Layer } from 'effect';
import type { Review } from '../models/review.ts';
import type {
  ReviewLinks,
  ReviewLinkHosts,
} from '../models/review-management.ts';

export class BuildReviewLinksService extends Context.Service<
  BuildReviewLinksService,
  {
    readonly execute: (input: {
      review: Review;
      environmentId: string;
      hosts: ReviewLinkHosts;
    }) => Effect.Effect<ReviewLinks>;
  }
>()('@porcelain/reviews/BuildReviewLinksService') {
  static readonly layer = Layer.effect(
    BuildReviewLinksService,
    Effect.sync(() => ({
      execute: Effect.fn('BuildReviewLinksService.execute')((input) =>
        Effect.sync(() => {
          const { review, hosts } = input;
          const localHost = hosts.localHost.includes(':')
            ? `[${hosts.localHost}]`
            : hosts.localHost;
          const host =
            hosts.cloudflare ??
            (hosts.tailnet === undefined
              ? `${localHost}:${hosts.localPort}`
              : `${hosts.tailnet}${hosts.tailnetPort === undefined || hosts.tailnetPort === 443 ? '' : `:${hosts.tailnetPort}`}`);
          const link = (revision?: number, decision?: string) => {
            const path = `/reviews/${review.reviewId}${revision === undefined ? '' : `/${revision}`}${decision === undefined ? '' : `/decisions/${decision}`}`;
            const app = new URL(
              `/open/reviews/${review.reviewId}`,
              input.hosts.hubOrigin,
            );
            app.searchParams.set('environment', input.environmentId);
            app.searchParams.set('host', host);
            if (revision !== undefined)
              app.searchParams.set('revision', String(revision));
            if (decision !== undefined)
              app.searchParams.set('decision', decision);
            return { web: `https://${host}${path}`, app: app.toString() };
          };
          return {
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

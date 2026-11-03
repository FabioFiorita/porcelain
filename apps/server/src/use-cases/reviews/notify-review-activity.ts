import { Cause, Context, Effect, Layer } from 'effect';
import type { PushEvent } from '@porcelain/access/models';
import { ReadEnvironmentService } from '@porcelain/access/services';
import { FindProjectService } from '@porcelain/projects/services';
import {
  BuildReviewLinksService,
  ReadReviewRevisionService,
} from '@porcelain/reviews/services';
import { Logger } from '../../ports/logger.ts';
import { NotifyDevicesUseCasePort } from '../../ports/notify-devices-use-case-port.ts';
import { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';
import { ReviewLinkSource } from '../../ports/review-link-source.ts';
import { type ReviewActivity } from '../../ports/notify-review-activity-use-case-port.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class NotifyReviewActivityUseCase extends Context.Service<
  NotifyReviewActivityUseCase,
  {
    readonly execute: (activity: ReviewActivity) => Effect.Effect<void>;
  }
>()('@porcelain/server/NotifyReviewActivityUseCase') {
  static readonly layer = Layer.effect(
    NotifyReviewActivityUseCase,
    Effect.gen(function* () {
      const revisions = yield* ReadReviewRevisionService;
      const projects = yield* FindProjectService;
      const worktrees = yield* CheckWorktreeUseCasePort;
      const links = yield* BuildReviewLinksService;
      const routes = yield* ReviewLinkSource;
      const environment = yield* ReadEnvironmentService;
      const notifyDevices = yield* NotifyDevicesUseCasePort;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      const logger = yield* Logger;

      const event = Effect.fn('NotifyReviewActivityUseCase.event')(function* (
        activity: ReviewActivity,
      ): Effect.fn.Return<PushEvent | undefined> {
        const { reviewId } = activity;
        const review =
          reviewId === undefined
            ? undefined
            : yield* lanes
                .run(
                  keys.reviews({ repositoryId: `review:${reviewId}` }),
                  'read',
                  () => revisions.execute({ reviewId, revision: undefined }),
                )
                .pipe(
                  Effect.catchTag('ReviewNotFoundError', () =>
                    Effect.succeed(undefined),
                  ),
                );
        if (review === undefined && activity.kind === 'agent-reply') {
          const worktree = yield* worktrees
            .execute({
              worktreeId: activity.worktreeId,
              requireAvailableProject: false,
            })
            .pipe(Effect.option);
          const project =
            worktree._tag === 'Some'
              ? yield* projects.execute({ projectId: worktree.value.projectId })
              : undefined;
          return {
            kind: 'agent-reply',
            project: project?.kind === 'found' ? project.project.name : '',
            reply: activity.reply,
            link: undefined,
          };
        }
        if (review === undefined) return undefined;
        const project = yield* projects.execute({
          projectId: review.projectId,
        });
        const environmentId = yield* environment.execute().pipe(
          Effect.map((found) => found.environmentId),
          Effect.catchTag('MissingEnvironmentIdentityError', () =>
            Effect.succeed(undefined),
          ),
        );
        const built =
          environmentId === undefined
            ? undefined
            : yield* links.execute({
                review,
                environmentId,
                routes: yield* routes.read(),
              });
        const link = built?.kind === 'available' ? built.app : undefined;
        const name =
          project.kind === 'found' ? project.project.name : review.worktreeName;
        return activity.kind === 'review-ready'
          ? {
              kind: 'review-ready',
              project: name,
              title: review.verdict.asked.text || review.branch,
              link,
            }
          : { kind: 'agent-reply', project: name, reply: activity.reply, link };
      });

      return {
        execute: Effect.fn('NotifyReviewActivityUseCase.execute')(function* (
          activity: ReviewActivity,
        ): Effect.fn.Return<void> {
          yield* lanes.start(
            () =>
              Effect.gen(function* () {
                const found = yield* event(activity);
                if (found !== undefined) yield* notifyDevices.execute(found);
              }),
            (cause) =>
              Effect.sync(() =>
                logger.failure({
                  kind: 'push-notifications',
                  error: Cause.squash(cause),
                }),
              ),
          );
        }),
      };
    }),
  );
}

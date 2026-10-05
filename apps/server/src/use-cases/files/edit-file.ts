import {
  type EditFileRequest,
  type EditFileResponse,
} from '@porcelain/contracts/files';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import {
  type EditFileFailure,
  EditFileService,
} from '@porcelain/files/services';
import { Cause, Effect, Context, Layer } from 'effect';
import { EditAnnouncementWriter } from '../../ports/edit-announcement-writer.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { Logger } from '../../ports/logger.ts';
import { InvalidateReviewedMarksUseCasePort } from '../../ports/invalidate-reviewed-marks-use-case-port.ts';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';

export class EditFileUseCase extends Context.Service<
  EditFileUseCase,
  {
    readonly execute: (
      input: WorktreeParams & EditFileRequest,
    ) => Effect.Effect<
      EditFileResponse,
      EditFileFailure | WorktreeAccessFailure
    >;
  }
>()('@porcelain/server/EditFileUseCase') {
  static readonly layer = Layer.effect(
    EditFileUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const editFileCapability = yield* EditFileService;
      const invalidateReviewedMarksCapability =
        yield* InvalidateReviewedMarksUseCasePort;
      const eventsCapability = yield* EventPublisher;
      const editAnnouncementsCapability = yield* EditAnnouncementWriter;
      const loggerCapability = yield* Logger;
      const operationAnnounce = Effect.fn('EditFileUseCase.announce')(
        function* (
          worktreeId: string,
          paths: string[],
        ): Effect.fn.Return<void> {
          yield* editAnnouncementsCapability.announce({ worktreeId, paths });
          const invalidated = invalidateReviewedMarksCapability.execute({
            worktreeId,
            paths,
          });
          yield* Effect.catchCause(invalidated, (cause) =>
            Effect.sync(() =>
              loggerCapability.failure({
                kind: 'reviewed-marks',
                worktreeId,
                error: Cause.squash(cause),
              }),
            ),
          );
          yield* eventsCapability.filesChanged({ worktreeId, paths });
        },
      );
      return {
        execute: Effect.fn('EditFileUseCase.execute')(function* (
          input: WorktreeParams & EditFileRequest,
        ): Effect.fn.Return<
          EditFileResponse,
          EditFileFailure | WorktreeAccessFailure
        > {
          const { worktreeId } = input;
          const paths =
            input.kind === 'move'
              ? [input.path, input.destination]
              : input.kind === 'copy'
                ? [input.destination]
                : [input.path];
          return yield* accessCapability.write(
            worktreeId,
            (worktree) =>
              editFileCapability.execute({
                worktreeId: worktree.id,
                command: input,
              }),
            () => operationAnnounce(worktreeId, paths),
          );
        }),
      };
    }),
  );
}

import type { QueryClient } from '@tanstack/query-core';
import type {
  EditFileRequest,
  EditFileResponse,
} from '@porcelain/contracts/files';
import { withSignal } from '@porcelain/effects';
import { Effect } from 'effect';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import type { RequestError } from '../../../shared/api/request-error.ts';
import { FileDrafts, fileDraftRuntime } from '../store.ts';
import { filesApi } from '../api.ts';
import { refreshFileEdit } from './edit-file.ts';
type FileEditFailure =
  | Effect.Error<ReturnType<ReturnType<typeof filesApi>['editFile']>>
  | ConnectionError
  | RequestError;

export class FileEditCoordinator {
  private readonly connection: WorktreeConnection;
  private readonly scope: WorktreeScope;
  private readonly cache: QueryClient;
  private readonly createId: () => string;

  constructor(
    connection: WorktreeConnection,
    scope: WorktreeScope,
    cache: QueryClient,
    createId: () => string,
  ) {
    this.connection = connection;
    this.scope = scope;
    this.cache = cache;
    this.createId = createId;
  }

  execute(
    input: EditFileRequest,
  ): Effect.Effect<EditFileResponse, FileEditFailure> {
    return Effect.suspend(() => {
      const { signal } = this.connection.request();
      return withSignal(this.edit(input, signal), signal);
    });
  }

  private edit(
    input: EditFileRequest,
    signal: AbortSignal,
  ): Effect.Effect<EditFileResponse, FileEditFailure> {
    const prefix = `${JSON.stringify([this.scope.projectId, this.scope.worktreeId])}/`;
    const retained = fileDraftRuntime
      .runSync(FileDrafts)
      .entries(this.connection);
    const moving =
      input.kind === 'move' || input.kind === 'trash'
        ? [...retained].filter(
            ([key]) =>
              key === `${prefix}${input.path}` ||
              key.startsWith(`${prefix}${input.path}/`),
          )
        : [];
    return Effect.acquireUseRelease(
      Effect.sync(this.createId),
      (owner) =>
        Effect.uninterruptibleMask((restore) =>
          Effect.gen({ self: this }, function* () {
            if (moving.some(([, draft]) => draft.state.value.owner !== null))
              return yield* Effect.fail(
                new ConnectionError({
                  message:
                    'Finish editing this file or its open children before moving this entry.',
                }),
              );
            for (const [, draft] of moving)
              if (!draft.claim(owner))
                return yield* Effect.fail(
                  new ConnectionError({
                    message:
                      'Finish editing this file or its open children before moving this entry.',
                  }),
                );
            for (const [, draft] of moving)
              if (!(yield* restore(draft.save())))
                return yield* Effect.fail(
                  new ConnectionError({
                    message:
                      'Save or discard the unsaved draft before moving this entry.',
                  }),
                );
            const api = filesApi(this.connection);
            const params = { worktreeId: this.scope.worktreeId };
            const request = (() => {
              switch (input.kind) {
                case 'write':
                  return api.editFile({ params, payload: input });
                case 'create':
                  return api.editFile({ params, payload: input });
                case 'move':
                  return api.editFile({ params, payload: input });
                case 'copy':
                  return api.editFile({ params, payload: input });
                case 'trash':
                  return api.editFile({ params, payload: input });
              }
            })();
            const edited = yield* restore(requestEffect(request));
            if (input.kind === 'move' || input.kind === 'trash')
              yield* fileDraftRuntime.runSync(FileDrafts).relocate(
                this.connection.environmentId,
                moving.map(([key]) => key),
                input,
                this.scope,
              );
            return edited;
          }),
        ),
      (owner) =>
        Effect.gen({ self: this }, function* () {
          for (const [, draft] of moving) draft.release(owner);
          if (!signal.aborted)
            yield* refreshFileEdit(
              this.cache,
              this.connection,
              this.scope,
              input,
            );
        }),
    );
  }
}

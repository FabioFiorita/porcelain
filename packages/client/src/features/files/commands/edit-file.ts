import type {
  EditFileRequest,
  EditFileResponse,
} from '@porcelain/contracts/files';
import { withSignal } from '@porcelain/effects';
import { Context, Effect, Layer } from 'effect';
import { Atom, AtomRegistry, Reactivity } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { FileDrafts, fileDraftRuntime } from '../store.ts';
import type { FileDraftWriteFailure } from '../ports/file-draft-writer.ts';

class FileEdits extends Context.Service<
  FileEdits,
  {
    readonly execute: (
      input: EditFileRequest,
    ) => Effect.Effect<EditFileResponse, FileDraftWriteFailure>;
  }
>()('@porcelain/client/FileEdits') {
  static layer(connection: RuntimeConnection, scope: WorktreeScope) {
    return Layer.effect(
      FileEdits,
      Effect.gen(function* () {
        const api = yield* porcelainClient(connection);
        const drafts = yield* FileDrafts;
        const reactivity = yield* Reactivity.Reactivity;
        const execute = Effect.fn('Files.edit')(function* (
          input: EditFileRequest,
        ) {
          const signal = connection.request().signal;
          const prefix = `${JSON.stringify([scope.projectId, scope.worktreeId])}/`;
          const moving =
            input.kind === 'move' || input.kind === 'trash'
              ? [...drafts.entries(connection)].filter(
                  ([key]) =>
                    key === `${prefix}${input.path}` ||
                    key.startsWith(`${prefix}${input.path}/`),
                )
              : [];
          return yield* withSignal(
            Effect.acquireUseRelease(
              Effect.sync(Symbol),
              (owner) =>
                Effect.uninterruptibleMask((restore) =>
                  Effect.gen(function* () {
                    yield* restore(currentAnswerEffect(signal));
                    if (
                      moving.some(
                        ([, draft]) => draft.state.value.owner !== null,
                      )
                    )
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
                    const params = { worktreeId: scope.worktreeId };
                    const request = (() => {
                      switch (input.kind) {
                        case 'write':
                          return api.files.editFile({ params, payload: input });
                        case 'create':
                          return api.files.editFile({ params, payload: input });
                        case 'move':
                          return api.files.editFile({ params, payload: input });
                        case 'copy':
                          return api.files.editFile({ params, payload: input });
                        case 'trash':
                          return api.files.editFile({ params, payload: input });
                      }
                    })();
                    const edited = yield* restore(requestEffect(request));
                    yield* currentAnswerEffect(
                      signal,
                      edited.path ===
                        (input.kind === 'move' || input.kind === 'copy'
                          ? input.destination
                          : input.path),
                    );
                    if (input.kind === 'move' || input.kind === 'trash')
                      yield* drafts.relocate(
                        connection.environmentId,
                        moving.map(([key]) => key),
                        input,
                        scope,
                      );
                    return edited;
                  }),
                ),
              (owner) =>
                Effect.gen(function* () {
                  for (const [, draft] of moving) draft.release(owner);
                  if (!signal.aborted)
                    yield* reactivity.invalidate([
                      queryKeys.review(connection.environmentId, scope),
                    ]);
                }),
            ),
            signal,
          );
        });
        return { execute };
      }),
    );
  }
}
const fileEditRuntime = Atom.family(
  ({
    connection,
    scope,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
  }) =>
    connection.atoms((get) =>
      Layer.provideMerge(
        FileEdits.layer(connection, scope),
        Layer.merge(
          get(clientRuntime(connection).layer),
          Layer.effectContext(fileDraftRuntime.contextEffect),
        ),
      ),
    ),
);
export const editFile = Atom.family(
  (input: { connection: RuntimeConnection; scope: WorktreeScope }) =>
    fileEditRuntime(input).fn(
      (edit: EditFileRequest) => FileEdits.use((files) => files.execute(edit)),
      { concurrent: true },
    ),
);
export const retainFileDraft = Atom.family(
  (input: {
    readonly connection: RuntimeConnection;
    readonly scope: WorktreeScope;
    readonly path: string;
    readonly text: string;
    readonly fingerprint: string;
  }) =>
    Atom.make((get) => {
      const drafts = fileDraftRuntime.runSync(FileDrafts);
      const registry = get.registry;
      return fileDraftRuntime.runSync(
        drafts.retain({
          ...input,
          environmentId: input.connection.environmentId,
          writer: {
            write: ({ path, text, expectedFingerprint }) => {
              const runtime = fileEditRuntime({
                connection: drafts.connection(input.connection),
                scope: input.scope,
              });
              return Effect.acquireUseRelease(
                Effect.sync(() => registry.mount(runtime)),
                () =>
                  Effect.gen(function* () {
                    const services = yield* AtomRegistry.getResult(
                      registry,
                      runtime,
                    );
                    const result = yield* Context.get(
                      services,
                      FileEdits,
                    ).execute({
                      kind: 'write',
                      path,
                      text,
                      expectedFingerprint,
                    });
                    if (!result.contentFingerprint)
                      return yield* Effect.fail(
                        new ConnectionError({
                          message:
                            'The server did not confirm the saved version.',
                        }),
                      );
                    return result.contentFingerprint;
                  }),
                (stop) => Effect.sync(stop),
              );
            },
          },
        }),
      );
    }),
);

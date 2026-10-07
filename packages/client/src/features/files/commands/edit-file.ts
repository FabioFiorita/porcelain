import { entryName, topLevelDraggedPaths } from '../rules/tree-actions.ts';
import type { FileDraftHandle } from '../store.ts';
import type {
  EditFileRequest,
  EditFileResponse,
} from '@porcelain/contracts/files';
import { Context, Effect, Layer } from 'effect';
import { Atom, AtomRegistry, Reactivity } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { noticeReadKeys } from '../../live/commands/cache-updates.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { FileDrafts, fileDraftsRuntime } from '../store.ts';
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
        const client = yield* porcelainClient(connection);
        const drafts = yield* FileDrafts;
        const reactivity = yield* Reactivity.Reactivity;
        const execute = Effect.fn('Files.edit')(function* (
          input: EditFileRequest,
        ) {
          const prefix = `${JSON.stringify([scope.projectId, scope.worktreeId])}/`;
          const moving =
            input.kind === 'move' || input.kind === 'trash'
              ? [...drafts.entries(connection)].filter(
                  ([key]) =>
                    key === `${prefix}${input.path}` ||
                    key.startsWith(`${prefix}${input.path}/`),
                )
              : [];
          return yield* connection.request(
            Effect.acquireUseRelease(
              Effect.sync(Symbol),
              (owner) =>
                Effect.uninterruptibleMask((restore) =>
                  Effect.gen(function* () {
                    yield* restore(currentAnswerEffect(connection));
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
                    const edited = yield* restore(
                      client.request((api) => {
                        switch (input.kind) {
                          case 'write':
                            return api.files.editFile({
                              params,
                              payload: input,
                            });
                          case 'create':
                            return api.files.editFile({
                              params,
                              payload: input,
                            });
                          case 'move':
                            return api.files.editFile({
                              params,
                              payload: input,
                            });
                          case 'copy':
                            return api.files.editFile({
                              params,
                              payload: input,
                            });
                          case 'trash':
                            return api.files.editFile({
                              params,
                              payload: input,
                            });
                        }
                      }),
                    );
                    yield* currentAnswerEffect(
                      connection,
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
                  if (!connection.isClosed())
                    yield* reactivity.invalidate(
                      noticeReadKeys(connection.environmentId, {
                        type: 'worktree',
                        ...scope,
                        change: 'files',
                      }),
                    );
                }),
            ),
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
        Layer.merge(get(clientRuntime(connection).layer), FileDrafts.layer),
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
    fileDraftsRuntime(input.connection).atom(
      Effect.gen(function* () {
        const drafts = yield* FileDrafts;
        const registry = yield* AtomRegistry.AtomRegistry;
        return yield* drafts.retain({
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
        });
      }),
    ),
);

export const moveFileEntries = Effect.fn('Files.moveEntries')(function* <E>(
  paths: readonly string[],
  folder: string,
  move: (from: string, to: string) => Effect.Effect<void, E>,
) {
  for (const from of topLevelDraggedPaths(paths)) {
    const to = `${folder}${entryName(from)}`;
    if (from.replace(/\/$/, '') !== to.replace(/\/$/, ''))
      yield* move(from, to);
  }
});

export const completeFileDraft = Effect.fn('Files.completeDraft')(function* (
  draft: FileDraftHandle,
  complete: () => void,
) {
  if (yield* draft.save()) complete();
});

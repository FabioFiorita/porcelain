import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../shared/api/connection.ts';
import {
  Cause,
  Context,
  Duration,
  Effect,
  Exit,
  Fiber,
  Layer,
  ManagedRuntime,
  Ref,
  Semaphore,
  Scope,
  SynchronizedRef,
} from 'effect';
import { AtomRef } from 'effect/reactivity';
import { ContentChangedError } from '@porcelain/files/errors';
import {
  FILE_AUTOSAVE_WAIT_MS,
  FILE_DISK_CHANGE_NOTICE_MS,
} from '../../config/limits.ts';
import { FileDraftWriter } from './ports/file-draft-writer.ts';

type DraftSeed = { readonly text: string; readonly fingerprint: string };
export type FileDraftState = {
  readonly text: string;
  readonly savedText: string;
  readonly fingerprint: string;
  readonly saving: boolean;
  readonly owner: string | null;
  readonly error: unknown;
  readonly diskChanged: ReadonlySet<string>;
};

export const FileDraftTiming = Context.Reference<{
  readonly autosave: Duration.Duration;
  readonly diskNotice: Duration.Duration;
}>('@porcelain/client/FileDraftTiming', {
  defaultValue: () => ({
    autosave: Duration.millis(FILE_AUTOSAVE_WAIT_MS),
    diskNotice: Duration.millis(FILE_DISK_CHANGE_NOTICE_MS),
  }),
});

class FileDraft extends Context.Service<
  FileDraft,
  {
    readonly state: AtomRef.ReadonlyRef<FileDraftState>;
    readonly blocked: boolean;
    readonly claim: (owner: string) => boolean;
    readonly release: (owner: string) => void;
    readonly attachEditor: (owner: string) => void;
    readonly finishEditing: (
      owner: string,
      onUnsaved: () => void,
      onDetached?: () => void,
    ) => Effect.Effect<void>;
    readonly noticeDiskChange: (
      viewer: string,
      fingerprint: string | undefined,
    ) => Effect.Effect<void>;
    readonly forgetDiskChange: (viewer: string) => Effect.Effect<void>;
    readonly change: (text: string) => Effect.Effect<void>;
    readonly reset: (text: string, fingerprint: string) => Effect.Effect<void>;
    readonly save: () => Effect.Effect<boolean>;
    readonly dispose: () => Effect.Effect<void>;
  }
>()('@porcelain/client/FileDraft') {
  static layer(seed: DraftSeed, lifetime: Scope.Closeable) {
    return Layer.effect(
      FileDraft,
      Effect.gen(function* () {
        const writer = yield* FileDraftWriter;
        const timing = yield* FileDraftTiming;
        const state = AtomRef.make<FileDraftState>({
          text: seed.text,
          savedText: seed.text,
          fingerprint: seed.fingerprint,
          saving: false,
          owner: null,
          error: null,
          diskChanged: new Set(),
        });
        const disposed = AtomRef.make(false);
        const lastWritten = AtomRef.make<string | null>(null);
        const pending = yield* SynchronizedRef.make<
          Fiber.Fiber<boolean> | undefined
        >(undefined);
        const autosaveGate = yield* Semaphore.make(1);
        const autosave = yield* Ref.make<Fiber.Fiber<void> | undefined>(
          undefined,
        );
        const notices = yield* SynchronizedRef.make<
          ReadonlyMap<string, Fiber.Fiber<void>>
        >(new Map());
        const attachments = AtomRef.make<ReadonlyMap<string, symbol>>(
          new Map(),
        );
        const update = (change: Partial<FileDraftState>) =>
          state.update((current) => ({ ...current, ...change }));
        const blocked = () =>
          writer.isBlockedError
            ? writer.isBlockedError(state.value.error)
            : state.value.error instanceof ContentChangedError;
        const cancelAutosave = Effect.gen(function* () {
          const fiber = yield* Ref.getAndSet(autosave, undefined);
          if (fiber) yield* Fiber.interrupt(fiber);
        });
        const release = (owner: string) => {
          if (state.value.owner === owner) update({ owner: null });
        };
        const removeNotice = (viewer: string) => {
          const next = new Set(state.value.diskChanged);
          next.delete(viewer);
          update({ diskChanged: next });
        };
        const forgetDiskChange = Effect.fn('FileDraft.forgetDiskChange')(
          function* (viewer: string) {
            const fiber = yield* SynchronizedRef.modify(notices, (current) => {
              const next = new Map(current);
              next.delete(viewer);
              return [current.get(viewer), next];
            });
            if (fiber) yield* Fiber.interrupt(fiber);
            removeNotice(viewer);
          },
        );
        const save = Effect.fn('FileDraft.save')(function* () {
          yield* autosaveGate.withPermit(cancelAutosave);
          const work = yield* SynchronizedRef.modifyEffect(
            pending,
            (current) => {
              if (current)
                return Effect.succeed([Fiber.join(current), current] as const);
              if (disposed.value || blocked())
                return Effect.succeed([
                  Effect.succeed(false),
                  undefined,
                ] as const);
              if (state.value.text === state.value.savedText)
                return Effect.succeed([
                  Effect.succeed(true),
                  undefined,
                ] as const);
              update({ saving: true, error: null });
              const writing = Effect.gen(function* () {
                while (state.value.text !== state.value.savedText) {
                  const text = state.value.text;
                  const fingerprint = yield* writer.write(
                    text,
                    state.value.fingerprint,
                  );
                  lastWritten.set(fingerprint);
                  update({ savedText: text, fingerprint });
                }
                return true;
              }).pipe(
                Effect.catchCause((cause) =>
                  Effect.sync(() => {
                    update({ error: Cause.squash(cause) });
                    return false;
                  }),
                ),
                Effect.ensuring(
                  Effect.yieldNow.pipe(
                    Effect.andThen(SynchronizedRef.set(pending, undefined)),
                    Effect.andThen(
                      Effect.sync(() => update({ saving: false })),
                    ),
                  ),
                ),
              );
              return Effect.map(
                Effect.forkIn(writing, lifetime, { startImmediately: true }),
                (fiber) => [Fiber.join(fiber), fiber] as const,
              );
            },
          );
          return yield* work;
        });
        yield* Scope.addFinalizer(
          lifetime,
          Effect.sync(() => {
            disposed.set(true);
            attachments.set(new Map());
          }),
        );
        return {
          state,
          get blocked() {
            return blocked();
          },
          claim(owner) {
            if (
              disposed.value ||
              (state.value.owner !== null && state.value.owner !== owner)
            )
              return false;
            update({ owner });
            return true;
          },
          release,
          attachEditor: (owner) => {
            if (!disposed.value)
              attachments.update((current) =>
                new Map(current).set(owner, Symbol(owner)),
              );
          },
          finishEditing: Effect.fn('FileDraft.finishEditing')(function* (
            owner: string,
            onUnsaved: () => void,
            onDetached: () => void = () => {},
          ) {
            const attachment = attachments.value.get(owner);
            if (!attachment) return;
            yield* Effect.yieldNow;
            if (disposed.value || attachments.value.get(owner) !== attachment)
              return;
            attachments.update((current) => {
              const next = new Map(current);
              next.delete(owner);
              return next;
            });
            onDetached();
            release(owner);
            if (!state.value.error && !(yield* save())) onUnsaved();
          }),
          noticeDiskChange: Effect.fn('FileDraft.noticeDiskChange')(function* (
            viewer: string,
            fingerprint: string | undefined,
          ) {
            yield* SynchronizedRef.modifyEffect(notices, (current) => {
              if (
                disposed.value ||
                state.value.saving ||
                state.value.owner !== null ||
                current.has(viewer) ||
                lastWritten.value === fingerprint
              )
                return Effect.succeed([undefined, current] as const);
              update({
                diskChanged: new Set([...state.value.diskChanged, viewer]),
              });
              let own: Fiber.Fiber<void> | undefined;
              const expire = Effect.sleep(timing.diskNotice).pipe(
                Effect.andThen(
                  SynchronizedRef.update(notices, (entries) => {
                    if (entries.get(viewer) !== own) return entries;
                    const next = new Map(entries);
                    next.delete(viewer);
                    removeNotice(viewer);
                    return next;
                  }),
                ),
              );
              return Effect.map(
                Effect.forkIn(expire, lifetime, { startImmediately: true }),
                (fiber) => {
                  own = fiber;
                  return [
                    undefined,
                    new Map(current).set(viewer, fiber),
                  ] as const;
                },
              );
            });
          }),
          forgetDiskChange,
          change: Effect.fn('FileDraft.change')(function* (text: string) {
            if (disposed.value || state.value.text === text) return;
            update({ text });
            yield* autosaveGate.withPermit(
              Effect.gen(function* () {
                yield* cancelAutosave;
                if (disposed.value) return;
                const delayed = Effect.sleep(timing.autosave).pipe(
                  Effect.andThen(Ref.set(autosave, undefined)),
                  Effect.andThen(save()),
                  Effect.asVoid,
                );
                const fiber = yield* Effect.forkIn(delayed, lifetime, {
                  startImmediately: true,
                });
                yield* Ref.set(autosave, fiber);
              }),
            );
          }),
          reset: Effect.fn('FileDraft.reset')(function* (
            text: string,
            fingerprint: string,
          ) {
            yield* autosaveGate.withPermit(
              Effect.gen(function* () {
                if (disposed.value || state.value.saving) return;
                yield* cancelAutosave;
                update({ text, savedText: text, fingerprint, error: null });
              }),
            );
          }),
          save,
          dispose: () =>
            Effect.suspend(() => {
              disposed.set(true);
              return Scope.close(lifetime, Exit.void);
            }),
        };
      }),
    );
  }
}
export type FileDraftHandle = Context.Service.Shape<typeof FileDraft>;

type DraftEntry = {
  readonly scope: Scope.Closeable;
  readonly draft: FileDraftHandle;
  readonly path: AtomRef.AtomRef<string>;
};
type DraftInput = DraftSeed & {
  readonly environmentId: string;
  readonly scope: WorktreeScope;
  readonly path: string;
  readonly writer: Omit<
    Context.Service.Shape<typeof FileDraftWriter>,
    'write'
  > & {
    readonly write: (input: {
      readonly path: string;
      readonly text: string;
      readonly expectedFingerprint: string;
    }) => ReturnType<Context.Service.Shape<typeof FileDraftWriter>['write']>;
  };
};
const draftKey = (scope: WorktreeScope, path: string) =>
  `${JSON.stringify([scope.projectId, scope.worktreeId])}/${path}`;

export class FileDrafts extends Context.Service<
  FileDrafts,
  {
    readonly entries: (
      connection: Pick<WorktreeConnection, 'environmentId'>,
    ) => ReadonlyMap<string, FileDraftHandle>;
    readonly retain: (input: DraftInput) => Effect.Effect<FileDraftHandle>;
    readonly adopt: (connection: WorktreeConnection) => void;
    readonly connection: (connection: WorktreeConnection) => WorktreeConnection;
    readonly hasUnsaved: (environmentIds: readonly string[]) => boolean;
    readonly save: (environmentId: string) => Effect.Effect<boolean>;
    readonly drop: (environmentId: string) => Effect.Effect<void>;
    readonly relocate: (
      environmentId: string,
      keys: readonly string[],
      input:
        | { kind: 'move'; path: string; destination: string }
        | { kind: 'trash'; path: string },
      scope: WorktreeScope,
    ) => Effect.Effect<void>;
  }
>()('@porcelain/client/FileDrafts') {
  static readonly layer = Layer.effect(
    FileDrafts,
    Effect.gen(function* () {
      const lifetime = yield* Effect.scope;
      const drafts = AtomRef.make<
        ReadonlyMap<string, ReadonlyMap<string, DraftEntry>>
      >(new Map());
      const connections = AtomRef.make<ReadonlyMap<string, WorktreeConnection>>(
        new Map(),
      );
      const entries = (environmentId: string) =>
        drafts.value.get(environmentId) ?? new Map<string, DraftEntry>();
      const publish = (
        environmentId: string,
        next: ReadonlyMap<string, DraftEntry>,
      ) =>
        drafts.update((current) => {
          const all = new Map(current);
          if (next.size) all.set(environmentId, next);
          else all.delete(environmentId);
          return all;
        });
      return {
        entries: (connection) =>
          new Map(
            [...entries(connection.environmentId)].map(([key, entry]) => [
              key,
              entry.draft,
            ]),
          ),
        retain: Effect.fn('FileDrafts.retain')(function* (input: DraftInput) {
          const key = draftKey(input.scope, input.path);
          const existing = entries(input.environmentId).get(key);
          if (existing) return existing.draft;
          const scope = yield* Scope.fork(lifetime);
          const path = AtomRef.make(input.path);
          const layer = FileDraft.layer(input, scope).pipe(
            Layer.provide(
              Layer.succeed(FileDraftWriter, {
                ...input.writer,
                write: (text, expectedFingerprint) =>
                  input.writer.write({
                    path: path.value,
                    text,
                    expectedFingerprint,
                  }),
              }),
            ),
          );
          const services = yield* Layer.build(layer).pipe(
            Effect.provideService(Scope.Scope, scope),
          );
          const draft = Context.get(services, FileDraft);
          publish(
            input.environmentId,
            new Map(entries(input.environmentId)).set(key, {
              scope,
              draft,
              path,
            }),
          );
          yield* Scope.addFinalizer(
            scope,
            Effect.sync(() =>
              publish(
                input.environmentId,
                new Map(
                  [...entries(input.environmentId)].filter(
                    ([, entry]) => entry.scope !== scope,
                  ),
                ),
              ),
            ),
          );
          return draft;
        }),
        adopt: (connection) => {
          connections.update((current) =>
            new Map(current).set(connection.environmentId, connection),
          );
        },
        connection: (connection) =>
          connections.value.get(connection.environmentId) ?? connection,
        hasUnsaved: (environmentIds) =>
          environmentIds.some((environmentId) =>
            [...entries(environmentId).values()].some(
              ({ draft }) =>
                draft.state.value.saving ||
                draft.state.value.text !== draft.state.value.savedText,
            ),
          ),
        save: Effect.fn('FileDrafts.save')(function* (environmentId: string) {
          for (const { draft } of entries(environmentId).values())
            if (!(yield* draft.save())) return false;
          return true;
        }),
        drop: Effect.fn('FileDrafts.drop')(function* (environmentId: string) {
          const dropped = [...entries(environmentId).values()];
          publish(environmentId, new Map());
          connections.update((current) => {
            const next = new Map(current);
            next.delete(environmentId);
            return next;
          });
          yield* Effect.forEach(
            dropped,
            (entry) => Scope.close(entry.scope, Exit.void),
            { concurrency: 'unbounded', discard: true },
          );
        }),
        relocate: Effect.fn('FileDrafts.relocate')(function* (
          environmentId: string,
          keys: readonly string[],
          input:
            | { kind: 'move'; path: string; destination: string }
            | { kind: 'trash'; path: string },
          worktree: WorktreeScope,
        ) {
          const current = entries(environmentId);
          const next = new Map(current);
          const removed: DraftEntry[] = [];
          const prefix = draftKey(worktree, input.path);
          for (const key of keys) {
            const entry = current.get(key);
            if (!entry) continue;
            next.delete(key);
            if (input.kind === 'move') {
              const path = `${input.destination}${key.slice(prefix.length)}`;
              entry.path.set(path);
              next.set(draftKey(worktree, path), entry);
            } else removed.push(entry);
          }
          publish(environmentId, next);
          yield* Effect.forEach(
            removed,
            (entry) => Scope.close(entry.scope, Exit.void),
            { concurrency: 'unbounded', discard: true },
          );
        }),
      };
    }),
  );
}

export const fileDraftRuntime = ManagedRuntime.make(FileDrafts.layer);

import type { WorktreeConnection } from '../../shared/api/connection.ts';
import { Cause, Effect, Fiber } from 'effect';
import { createStore } from 'zustand/vanilla';
import { ScopedTasks } from '@porcelain/effects';
import { ContentChangedError } from '@porcelain/files/errors';
import {
  FILE_AUTOSAVE_WAIT_MS,
  FILE_DISK_CHANGE_NOTICE_MS,
} from '../../config/limits.ts';

type FileDraftOptions = { autosaveWaitMs: number; diskChangeNoticeMs: number };

export type FileDraftState = {
  text: string;
  savedText: string;
  fingerprint: string;
  saving: boolean;
  owner: string | null;
  error: unknown;
  diskChanged: ReadonlySet<string>;
};

export class FileDraft<E = unknown> {
  readonly store;
  lastWrittenFingerprint: string | null = null;
  private pending: Fiber.Fiber<boolean> | undefined;
  private disposed = false;
  private readonly diskNotices = new Map<string, () => void>();
  private readonly editorAttachments = new Map<string, object>();
  private readonly write: (
    text: string,
    expectedFingerprint: string,
  ) => Effect.Effect<string, E>;
  private readonly isBlockedError: (error: unknown) => boolean;
  private cancelAutosave: (() => void) | undefined;
  private readonly options: FileDraftOptions;
  private readonly tasks: ScopedTasks;
  constructor(
    text: string,
    fingerprint: string,
    write: (
      text: string,
      expectedFingerprint: string,
    ) => Effect.Effect<string, E>,
    isBlockedError: (error: unknown) => boolean = (error) =>
      error instanceof ContentChangedError,
    options: FileDraftOptions = {
      autosaveWaitMs: FILE_AUTOSAVE_WAIT_MS,
      diskChangeNoticeMs: FILE_DISK_CHANGE_NOTICE_MS,
    },
    tasks: ScopedTasks = new ScopedTasks(),
  ) {
    this.options = options;
    this.tasks = tasks;
    this.store = createStore<FileDraftState>(() => ({
      text,
      savedText: text,
      fingerprint,
      saving: false,
      owner: null,
      error: null,
      diskChanged: new Set(),
    }));
    this.write = write;
    this.isBlockedError = isBlockedError;
  }
  readonly snapshot = () => this.store.getState();
  get blocked(): boolean {
    return this.isBlockedError(this.snapshot().error);
  }
  private update(change: Partial<FileDraftState>) {
    this.store.setState(change);
  }
  claim(owner: string) {
    if (this.disposed) return false;
    if (this.snapshot().owner && this.snapshot().owner !== owner) return false;
    this.update({ owner });
    return true;
  }
  release(owner: string) {
    if (this.snapshot().owner === owner) this.update({ owner: null });
  }
  attachEditor(owner: string) {
    this.editorAttachments.set(owner, {});
  }
  finishEditing(
    owner: string,
    onUnsaved: () => void,
    onDetached: () => void = () => {},
  ): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      const attachment = this.editorAttachments.get(owner);
      if (!attachment) return;
      yield* Effect.yieldNow;
      if (this.disposed || this.editorAttachments.get(owner) !== attachment)
        return;
      this.editorAttachments.delete(owner);
      onDetached();
      this.release(owner);
      if (!this.snapshot().error && !(yield* this.save())) onUnsaved();
    });
  }
  noticeDiskChange(viewer: string, fingerprint: string | undefined) {
    const state = this.snapshot();
    if (
      state.saving ||
      state.owner !== null ||
      this.diskNotices.has(viewer) ||
      this.lastWrittenFingerprint === fingerprint
    )
      return;
    this.diskNotices.set(
      viewer,
      this.tasks.after(this.options.diskChangeNoticeMs, () =>
        this.forgetDiskChange(viewer),
      ),
    );
    this.update({ diskChanged: new Set([...state.diskChanged, viewer]) });
  }
  forgetDiskChange(viewer: string) {
    this.diskNotices.get(viewer)?.();
    this.diskNotices.delete(viewer);
    const { diskChanged } = this.snapshot();
    if (!diskChanged.has(viewer)) return;
    const next = new Set(diskChanged);
    next.delete(viewer);
    this.update({ diskChanged: next });
  }
  change(text: string) {
    if (this.snapshot().text === text) return;
    this.update({ text });
    this.cancelAutosave?.();
    this.cancelAutosave = this.tasks.after(this.options.autosaveWaitMs, () => {
      void this.tasks.run(this.save()).catch(() => undefined);
    });
  }
  reset(text: string, fingerprint: string) {
    if (!this.snapshot().saving) {
      this.cancelAutosave?.();
      this.cancelAutosave = undefined;
      this.update({ text, savedText: text, fingerprint, error: null });
    }
  }
  dispose(): Effect.Effect<void> {
    return Effect.suspend(() => {
      this.disposed = true;
      this.cancelAutosave?.();
      this.cancelAutosave = undefined;
      for (const cancel of this.diskNotices.values()) cancel();
      this.diskNotices.clear();
      this.editorAttachments.clear();
      return this.tasks.close();
    });
  }
  save(): Effect.Effect<boolean> {
    return Effect.suspend(() => {
      this.cancelAutosave?.();
      this.cancelAutosave = undefined;
      if (this.pending) return Fiber.join(this.pending);
      if (this.disposed || this.blocked) return Effect.succeed(false);
      if (this.snapshot().text === this.snapshot().savedText)
        return Effect.succeed(true);
      this.update({ saving: true, error: null });
      const work = Effect.gen({ self: this }, function* () {
        while (this.snapshot().text !== this.snapshot().savedText) {
          const text = this.snapshot().text;
          const fingerprint = yield* this.write(
            text,
            this.snapshot().fingerprint,
          );
          this.lastWrittenFingerprint = fingerprint;
          this.update({ savedText: text, fingerprint });
        }
        return true;
      }).pipe(
        Effect.catchCause((cause) =>
          Effect.uninterruptible(
            Effect.sync(() => {
              this.update({ error: Cause.squash(cause) });
              return false;
            }),
          ),
        ),
        Effect.ensuring(
          Effect.yieldNow.pipe(
            Effect.andThen(
              Effect.sync(() => {
                this.update({ saving: false });
                this.pending = undefined;
              }),
            ),
          ),
        ),
      );
      this.pending = this.tasks.fork(work);
      return Fiber.join(this.pending);
    });
  }
}

const drafts = new Map<string, Map<string, FileDraft>>();
const connections = new Map<string, WorktreeConnection>();

export function retainedFileDrafts(
  connection: Pick<WorktreeConnection, 'environmentId'>,
) {
  let entries = drafts.get(connection.environmentId);
  if (!entries) {
    entries = new Map();
    drafts.set(connection.environmentId, entries);
  }
  return entries;
}

export function adoptFileDrafts(connection: WorktreeConnection) {
  connections.set(connection.environmentId, connection);
}

export function draftConnection(
  connection: WorktreeConnection,
): WorktreeConnection {
  return connections.get(connection.environmentId) ?? connection;
}

export function hasUnsavedFileDrafts(environmentIds: readonly string[]) {
  return environmentIds.some((environmentId) =>
    [...(drafts.get(environmentId)?.values() ?? [])].some((draft) => {
      const state = draft.snapshot();
      return state.saving || state.text !== state.savedText;
    }),
  );
}

export function saveFileDrafts(environmentId: string): Effect.Effect<boolean> {
  return Effect.gen(function* () {
    for (const draft of drafts.get(environmentId)?.values() ?? [])
      if (!(yield* draft.save())) return false;
    return true;
  });
}

export function dropFileDrafts(environmentId: string): Effect.Effect<void> {
  return Effect.suspend(() => {
    const dropped = [...(drafts.get(environmentId)?.values() ?? [])];
    drafts.delete(environmentId);
    connections.delete(environmentId);
    return Effect.forEach(dropped, (draft) => draft.dispose(), {
      concurrency: 'unbounded',
      discard: true,
    });
  });
}

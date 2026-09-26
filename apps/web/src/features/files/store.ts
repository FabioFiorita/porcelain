import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { Debouncer } from '@tanstack/pacer';
import { FILE_AUTOSAVE_WAIT_MS } from '@/config/limits';

export type FileDraftState = {
  text: string;
  savedText: string;
  fingerprint: string;
  saving: boolean;
  owner: string | null;
  error: unknown;
};

export class FileDraft {
  readonly store;
  private readonly editorFiles = new Map<
    string,
    {
      file: { name: string; contents: string };
      initialText: string;
      attached: boolean;
    }
  >();
  lastWrittenFingerprint: string | null = null;
  private pending: Promise<boolean> | undefined;
  private readonly write: (
    text: string,
    expectedFingerprint: string,
  ) => Promise<string>;
  private readonly isBlockedError: (error: unknown) => boolean;
  private readonly autosave = new Debouncer(
    () => {
      void this.save();
    },
    { wait: FILE_AUTOSAVE_WAIT_MS },
  );
  constructor(
    text: string,
    fingerprint: string,
    write: (text: string, expectedFingerprint: string) => Promise<string>,
    isBlockedError: (error: unknown) => boolean,
  ) {
    this.store = createStore<FileDraftState>(() => ({
      text,
      savedText: text,
      fingerprint,
      saving: false,
      owner: null,
      error: null,
    }));
    this.write = write;
    this.isBlockedError = isBlockedError;
  }
  readonly snapshot = () => this.store.getState();
  private update(change: Partial<FileDraftState>) {
    this.store.setState(change);
  }
  claim(owner: string) {
    if (this.snapshot().owner && this.snapshot().owner !== owner) return false;
    this.update({ owner });
    return true;
  }
  release(owner: string) {
    if (this.snapshot().owner === owner) this.update({ owner: null });
  }
  editorFile(owner: string, path: string, text: string) {
    let session = this.editorFiles.get(owner);
    if (!session) {
      session = {
        file: { name: path, contents: text },
        initialText: text,
        attached: false,
      };
      this.editorFiles.set(owner, session);
    }
    return session;
  }
  attachEditor(owner: string) {
    const session = this.editorFiles.get(owner);
    if (session) session.attached = true;
  }
  clearEditorFile(owner: string) {
    this.editorFiles.delete(owner);
  }
  finishEditing(owner: string, onUnsaved: () => void) {
    const session = this.editorFiles.get(owner);
    if (session) session.attached = false;
    queueMicrotask(() => {
      const current = this.editorFiles.get(owner);
      if (current?.attached) return;
      if (current === session) this.editorFiles.delete(owner);
      this.release(owner);
      if (!this.snapshot().error)
        void this.save().then((saved) => {
          if (!saved) onUnsaved();
        });
    });
  }
  change(text: string) {
    if (this.snapshot().text === text) return;
    this.update({ text });
    this.autosave.maybeExecute();
  }
  sync(text: string, fingerprint: string) {
    if (
      this.snapshot().owner === null &&
      !this.snapshot().saving &&
      this.snapshot().text === this.snapshot().savedText &&
      (this.snapshot().savedText !== text ||
        this.snapshot().fingerprint !== fingerprint)
    )
      this.update({ text, savedText: text, fingerprint, error: null });
  }
  reset(text: string, fingerprint: string) {
    if (!this.snapshot().saving) {
      this.autosave.cancel();
      this.update({ text, savedText: text, fingerprint, error: null });
    }
  }
  save(): Promise<boolean> {
    this.autosave.cancel();
    if (this.pending) return this.pending;
    if (this.isBlockedError(this.snapshot().error))
      return Promise.resolve(false);
    if (this.snapshot().text === this.snapshot().savedText)
      return Promise.resolve(true);
    this.update({ saving: true, error: null });
    const run = async () => {
      let saved = false;
      try {
        while (this.snapshot().text !== this.snapshot().savedText) {
          const text = this.snapshot().text;
          const fingerprint = await this.write(
            text,
            this.snapshot().fingerprint,
          );
          this.lastWrittenFingerprint = fingerprint;
          this.update({ savedText: text, fingerprint });
        }
        this.update({ saving: false });
        saved = true;
      } catch (error) {
        this.update({ saving: false, error });
      }
      this.pending = undefined;
      return saved;
    };
    this.pending = run();
    return this.pending;
  }
}

const filesStore = createStore<{
  quickOpenQuery: string;
  setQuickOpenQuery: (query: string) => void;
}>((set) => ({
  quickOpenQuery: '',
  setQuickOpenQuery: (quickOpenQuery) => set({ quickOpenQuery }),
}));

export function useQuickOpenQuery() {
  const query = useStore(filesStore, (state) => state.quickOpenQuery);
  return { query, setQuery: filesStore.getState().setQuickOpenQuery };
}

export function useFileDraftState(draft: FileDraft) {
  return useStore(draft.store);
}

import { useSyncExternalStore } from 'react';

/**
 * An edit that has not landed on disk, left behind when its editor closed (another
 * tab, another surface, Done during a conflict). View state only: a reload loses it.
 */
export type EditDraft = {
  text: string;
  /** What the edit started from: the text last read or saved, and the fingerprint every save sends. */
  base: { text: string; fingerprint: string };
  /** `saving` while the save on the way out runs; then why it did not land. */
  state: 'saving' | 'conflict' | 'failed';
};

const drafts = new Map<string, EditDraft>();
const listeners = new Set<() => void>();
const keyOf = (worktreeId: string, path: string) => `${worktreeId}\0${path}`;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const editDrafts = {
  get: (worktreeId: string, path: string) =>
    drafts.get(keyOf(worktreeId, path)) ?? null,
  set(worktreeId: string, path: string, draft: EditDraft) {
    drafts.set(keyOf(worktreeId, path), draft);
    for (const listener of listeners) listener();
  },
  remove(worktreeId: string, path: string) {
    if (!drafts.delete(keyOf(worktreeId, path))) return;
    for (const listener of listeners) listener();
  },
};

export function useEditDraft(
  worktreeId: string,
  path: string,
): EditDraft | null {
  return useSyncExternalStore(subscribe, () =>
    editDrafts.get(worktreeId, path),
  );
}

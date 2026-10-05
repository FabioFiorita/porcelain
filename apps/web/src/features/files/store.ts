import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { FileDraft } from '@porcelain/client/files';

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

type EditorFile = {
  file: { name: string; contents: string };
  initialText: string;
};
const sessions = new WeakMap<FileDraft, Map<string, EditorFile>>();

export function editorFile(
  draft: FileDraft,
  owner: string,
  path: string,
  text: string,
) {
  let files = sessions.get(draft);
  if (!files) {
    files = new Map();
    sessions.set(draft, files);
  }
  let session = files.get(owner);
  if (!session) {
    session = { file: { name: path, contents: text }, initialText: text };
    files.set(owner, session);
  }
  return session;
}

export function clearEditorFile(
  draft: FileDraft,
  owner: string,
  expected?: EditorFile,
) {
  const files = sessions.get(draft);
  if (!expected || files?.get(owner) === expected) files?.delete(owner);
}

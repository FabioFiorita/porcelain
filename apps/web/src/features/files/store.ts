import { AtomRef } from 'effect/reactivity';
import { useAtomRef } from '@effect/atom-react';
import type { FileDraftHandle } from '@porcelain/client/files';

const quickOpenQuery = AtomRef.make('');
export function useQuickOpenQuery() {
  return {
    query: useAtomRef(quickOpenQuery),
    setQuery: (query: string) => {
      quickOpenQuery.set(query);
    },
  };
}
export function useFileDraftState(draft: FileDraftHandle) {
  return useAtomRef(draft.state);
}

type EditorFile = {
  file: { name: string; contents: string };
  initialText: string;
};
const sessions = new WeakMap<FileDraftHandle, Map<string, EditorFile>>();

export function editorFile(
  draft: FileDraftHandle,
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
  draft: FileDraftHandle,
  owner: string,
  expected?: EditorFile,
) {
  const files = sessions.get(draft);
  if (!expected || files?.get(owner) === expected) files?.delete(owner);
}

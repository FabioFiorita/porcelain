import { Effect } from 'effect';
import { Atom, AtomRef } from 'effect/reactivity';
import { Option } from 'effect';
import type { ReactNode } from 'react';
import type { ContextMenuItem, GitStatusEntry } from '@pierre/trees';
import type { FileTreeEntry } from '@porcelain/client/files/rules';
import { useAtomRef, useAtomSet, useAtomValue } from '@effect/atom-react';
import { atomRegistry } from '@/shared/store';
import {
  readTextFile,
  retainFileDraft,
  type FileDraftHandle,
} from '@porcelain/client/files';
import {
  workspaceWriteAvailability,
  type ConnectionContext,
} from '@/shared/workspace/connection';
import type { FilesScope } from '@porcelain/client/files/rules';

export const readFileDraft = Atom.family(
  (selection: {
    context: ConnectionContext;
    scope: FilesScope;
    path: string;
  }) =>
    Atom.make((get) =>
      Effect.gen(function* () {
        const { context, ...fileSelection } = selection;
        const input = { ...fileSelection, connection: context.connection };
        const file = yield* get.result(readTextFile(input), {
          suspendOnWaiting: true,
        });
        const draft = yield* get.result(
          retainFileDraft({
            ...input,
            writeAvailability: workspaceWriteAvailability(context),
            text: 'kind' in file ? '' : file.text,
            fingerprint: 'kind' in file ? '' : (file.contentFingerprint ?? ''),
          }),
        );
        if (!('kind' in file) && file.contentFingerprint)
          yield* draft.refresh(file.text, file.contentFingerprint);
        return { file, draft };
      }),
    ),
);

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

export type PierreFileTreeInput = {
  owner: string;
  paths: readonly string[];
  kinds: ReadonlyMap<string, FileTreeEntry['kind']>;
  links: readonly { path: string; kind: string; target?: string | undefined }[];
  creating?:
    | {
        kind: 'file' | 'directory';
        folder: string;
        nonce: number;
        onStart: () => void;
      }
    | undefined;
  renameRequest?:
    | { path: string; nonce: number; onStart: () => void }
    | undefined;
  onRequestRename: (path: string) => void;
  onCreate: (path: string, kind: 'file' | 'directory') => Promise<void>;
  writeBlock?: string | undefined;
  onMove: (from: string, to: string) => Promise<void>;
  gitStatus: readonly GitStatusEntry[];
  selected: string;
  onExpand: (paths: readonly string[]) => void;
  bindRename: (rename: (path: string) => void) => void;
  bindCollapseAll: (collapse: () => void) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  renderMenu: (
    item: ContextMenuItem,
    context: {
      finalFocus: 'none' | (() => HTMLElement | null);
      close: (restoreFocus: boolean) => void;
    },
    rename: () => void,
  ) => ReactNode;
  onInvalidName: (error: string) => void;
  onSelect: (path: string, toSide?: boolean) => void;
  onContentHeight?: ((height: number) => void) | undefined;
};

export const fileTreePlaces = Atom.family((_owner: string) =>
  Atom.make<{
    expanded: readonly string[];
    selected: readonly string[];
    focused: string | null;
    anchor: string | null;
    document: string;
  }>({
    expanded: [],
    selected: [],
    focused: null,
    anchor: null,
    document: '',
  }).pipe(Atom.keepAlive),
);

const navigationState = Atom.family((_owner: string) =>
  Atom.make({
    showHidden: false,
    query: '',
    requested: [] as readonly string[],
    pinnedExpanded: [] as readonly string[],
  }).pipe(Atom.keepAlive),
);

export function useFileNavigationState(owner: string) {
  const atom = navigationState(owner);
  return { state: useAtomValue(atom), set: useAtomSet(atom) };
}

export const fileTreeInputs = Atom.family((_id: string) =>
  Atom.make<Option.Option<PierreFileTreeInput>>(Option.none()),
);

const treeControls = Atom.family((_scope: string) =>
  Atom.make(() => {
    let collapse = () => {};
    let rename = (_path: string) => {};
    return {
      collapseAll: () => collapse(),
      renameFile: (path: string) => rename(path),
      bindCollapseAll: (next: () => void) => {
        collapse = next;
      },
      bindRename: (next: (path: string) => void) => {
        rename = next;
      },
    };
  }),
);
export function useFileTreeControls(scope: string) {
  return useAtomValue(treeControls(scope));
}

type DiskViewer = { draft: FileDraftHandle; viewer: string };
const observedFingerprint = Atom.family((_viewer: DiskViewer) =>
  Atom.make<Option.Option<string | undefined>>(Option.none()),
);
export const diskChangeViewer = Atom.family((viewer: DiskViewer) =>
  Atom.make((get) => {
    get.mount(observedFingerprint(viewer));
    get.addFinalizer(() => {
      Effect.runFork(viewer.draft.forgetDiskChange(viewer.viewer));
    });
  }),
);
export const diskChangeObservation = Atom.family(
  ({
    draft,
    viewer,
    fingerprint,
  }: DiskViewer & {
    fingerprint: string | undefined;
  }) =>
    Atom.make((get) => {
      const previous = observedFingerprint({ draft, viewer });
      get.mount(previous);
      const value = get.once(previous);
      get.set(previous, Option.some(fingerprint));
      if (Option.isSome(value) && value.value !== fingerprint)
        Effect.runFork(draft.noticeDiskChange(viewer, fingerprint));
    }),
);

const readerPlaces = Atom.family((_document: string) =>
  Atom.make<{ scrollTop: number; anchor: string }>({
    scrollTop: 0,
    anchor: '',
  }).pipe(Atom.keepAlive),
);

export function useReaderPlaces() {
  const registry = useAtomValue(atomRegistry);
  return {
    place: (document: string) => registry.get(readerPlaces(document)),
    clearAnchor: (document: string) =>
      registry.set(readerPlaces(document), {
        ...registry.get(readerPlaces(document)),
        anchor: '',
      }),
    rememberScroll: (document: string, scrollTop: number) =>
      registry.set(readerPlaces(document), {
        ...registry.get(readerPlaces(document)),
        scrollTop,
      }),
    openAt: (document: string, anchor: string) =>
      registry.set(readerPlaces(document), { scrollTop: 0, anchor }),
  };
}

export const noAsset = Atom.make<undefined>(undefined);

import { useAtomRef } from '@effect/atom-react';
import { AtomRef } from 'effect/reactivity';
import type { ReviewComparison } from '../reviews';
import {
  activateDocument,
  emptyDocuments,
  openDocument,
  type DocumentTabsState,
} from '../../shared/rules/document-tabs';
import {
  documentMode,
  documentTab,
  type InspectorMode,
  type WorkspaceDocument,
  type WorkspaceTab,
} from './rules/documents';

type WorkspaceSession = {
  readonly documents: DocumentTabsState<WorkspaceTab>;
  readonly mode: InspectorMode;
  readonly inspectorOpen: boolean;
  readonly comparison: ReviewComparison;
  readonly selected: Readonly<Record<InspectorMode, WorkspaceTab | undefined>>;
};

const sessions = AtomRef.make<ReadonlyMap<string, WorkspaceSession>>(new Map());

function initialSession(mode: InspectorMode): WorkspaceSession {
  return {
    documents: emptyDocuments<WorkspaceTab>(),
    mode,
    inspectorOpen: true,
    comparison: { kind: 'worktree' },
    selected: { files: undefined, review: undefined, history: undefined },
  };
}

function withDocuments(
  session: WorkspaceSession,
  documents: DocumentTabsState<WorkspaceTab>,
): WorkspaceSession {
  const active = documents.tabs.find((tab) => tab.key === documents.active);
  return {
    ...session,
    documents,
    selected: active
      ? { ...session.selected, [documentMode(active)]: active }
      : session.selected,
  };
}

export function useWorkspaceSession(
  workspace: string,
  initialMode: InspectorMode,
) {
  const session =
    useAtomRef(sessions).get(workspace) ?? initialSession(initialMode);
  const update = (change: (session: WorkspaceSession) => WorkspaceSession) =>
    sessions.update((current) =>
      new Map(current).set(
        workspace,
        change(current.get(workspace) ?? initialSession(initialMode)),
      ),
    );
  return {
    session,
    changeMode: (mode: InspectorMode) =>
      update((current) => ({ ...current, mode })),
    changeInspector: (inspectorOpen: boolean) =>
      update((current) => ({ ...current, inspectorOpen })),
    changeComparison: (comparison: ReviewComparison) =>
      update((current) => ({
        ...current,
        comparison,
        selected: { ...current.selected, review: undefined },
      })),
    changeDocuments: (
      change: (
        documents: DocumentTabsState<WorkspaceTab>,
      ) => DocumentTabsState<WorkspaceTab>,
    ) => update((current) => withDocuments(current, change(current.documents))),
    open: (document: WorkspaceDocument) =>
      update((current) => {
        const tab = documentTab(document);
        const documents = current.documents.tabs.some(
          (entry) => entry.key === tab.key,
        )
          ? activateDocument(current.documents, tab.key)
          : openDocument(current.documents, tab);
        return withDocuments(current, documents);
      }),
  };
}

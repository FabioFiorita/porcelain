import { useEffect, useId } from 'react';
import {
  leaveDocuments,
  type DocumentLeaveGuard,
} from '../../shared/rules/document-leave';
import { useAtom, useAtomRef } from '@effect/atom-react';
import {
  sameRemoteConnection,
  type Remote,
} from '@porcelain/client/access/rules';
import {
  remoteConnectionState,
  selectionState,
} from '../../shared/application/store';

import { Schema, SchemaGetter } from 'effect';
import { Atom, AtomRef } from 'effect/reactivity';
import { workspaceStorageRuntime } from '../../shared/adapters/workspace-storage';
import type { ReviewComparison } from '../../shared/rules/review-comparison';
import type { DocumentTabsState } from '../../shared/rules/document-tabs';
import {
  changePane,
  focusPane,
  openInPane,
  openToSide,
  type PaneId,
} from '../../shared/rules/document-panes';
import {
  initialWorkspaceSnapshot,
  readWorkspaceSnapshot,
  restoreWorkspace,
  workspaceSnapshot,
  workspaceSnapshotSchema,
  type WorkspaceSession,
} from '../../shared/rules/workspace-session';
import {
  documentTab,
  type InspectorMode,
  type WorkspaceDocument,
  type WorkspaceTab,
} from '../../shared/rules/workspace-documents';

export function useProjectSelection() {
  return useAtomRef(selectionState);
}

export function useProjectConnection(remote: Remote | undefined) {
  return useAtomRef(remoteConnectionState).find(
    (entry) => remote && sameRemoteConnection(entry.remote, remote),
  )?.connection;
}

const sessions = Atom.family((workspace: string) =>
  Atom.kvs({
    runtime: workspaceStorageRuntime,
    key: `workspace.v1.${workspace}`,
    schema: Schema.Unknown.pipe(
      Schema.decodeTo(workspaceSnapshotSchema, {
        decode: SchemaGetter.transform(readWorkspaceSnapshot),
        encode: SchemaGetter.passthrough(),
      }),
    ),
    defaultValue: initialWorkspaceSnapshot,
  }).pipe(Atom.keepAlive),
);

export function useWorkspaceSession(
  workspace: string,
  initialMode: InspectorMode,
) {
  const [snapshot, setSnapshot] = useAtom(sessions(workspace));
  const session = restoreWorkspace(snapshot, initialMode);
  const update = (change: (session: WorkspaceSession) => WorkspaceSession) =>
    setSnapshot((current) =>
      workspaceSnapshot(change(restoreWorkspace(current, initialMode))),
    );
  return {
    session,
    changeMode: (mode: InspectorMode) =>
      update((current) => ({ ...current, mode })),
    changeInspector: (inspectorOpen: boolean) =>
      update((current) => ({ ...current, inspectorOpen })),
    changeComparison: (comparison: ReviewComparison) =>
      update((current) => ({ ...current, comparison })),
    focus: (pane: PaneId) =>
      update((current) => ({ ...current, ...focusPane(current, pane) })),
    changeDocuments: (
      pane: PaneId,
      change: (
        documents: DocumentTabsState<WorkspaceTab>,
      ) => DocumentTabsState<WorkspaceTab>,
    ) =>
      update((current) => ({
        ...current,
        ...changePane(current, pane, change),
      })),
    open: (document: WorkspaceDocument, pane?: PaneId) =>
      update((current) => ({
        ...current,
        ...openInPane(current, documentTab(document), pane),
      })),
    openBeside: (document: WorkspaceDocument, source?: PaneId) =>
      update((current) => ({
        ...current,
        ...openToSide(current, documentTab(document), source),
      })),
  };
}

const leaveGuards = AtomRef.make<
  ReadonlyMap<string, { scope: string; guard: DocumentLeaveGuard }>
>(new Map());

export function useDocumentLeave(
  scope: string | undefined,
  guard: DocumentLeaveGuard | undefined,
) {
  const owner = useId();
  useEffect(() => {
    if (!guard) return;
    leaveGuards.update((current) =>
      new Map(current).set(owner, { scope: scope ?? owner, guard }),
    );
    return () => {
      leaveGuards.update((current) => {
        const next = new Map(current);
        next.delete(owner);
        return next;
      });
    };
  }, [scope, guard, owner]);
}

export function requestDocumentLeave(leave: () => void, scope?: string) {
  leaveDocuments(
    [...leaveGuards.value.values()]
      .filter((entry) => scope === undefined || entry.scope === scope)
      .map((entry) => entry.guard),
    leave,
  );
}

import * as Schema from 'effect/Schema';
import { emptyPanes, type DocumentPanes } from './document-panes';
import { type DocumentTabsState } from './document-tabs';
import { reviewComparisonSchema } from './review-comparison';
import {
  documentMode,
  documentTab,
  workspaceDocumentSchema,
  type InspectorMode,
  type WorkspaceTab,
} from './workspace-documents';

const tabsSchema = Schema.Struct({
  tabs: Schema.Array(workspaceDocumentSchema),
  active: Schema.NullOr(Schema.String),
});

export const workspaceSnapshotSchema = Schema.Struct({
  version: Schema.Literal(1),
  left: tabsSchema,
  right: Schema.NullOr(tabsSchema),
  focused: Schema.Literals(['left', 'right']),
  mode: Schema.optional(Schema.Literals(['files', 'review', 'history'])),
  inspectorOpen: Schema.Boolean,
  comparison: reviewComparisonSchema,
});
type WorkspaceSnapshot = typeof workspaceSnapshotSchema.Type;
export type WorkspaceSession = DocumentPanes<WorkspaceTab> & {
  readonly mode: InspectorMode;
  readonly inspectorOpen: boolean;
  readonly comparison: typeof reviewComparisonSchema.Type;
};

export function initialWorkspaceSnapshot(): WorkspaceSnapshot {
  return {
    version: 1,
    ...emptyPanes<WorkspaceTab>(),
    inspectorOpen: true,
    comparison: { kind: 'worktree' },
  };
}

export function restoreWorkspace(
  snapshot: WorkspaceSnapshot,
  initialMode: InspectorMode,
): WorkspaceSession {
  const restoreTabs = (
    pane: typeof tabsSchema.Type,
  ): DocumentTabsState<WorkspaceTab> => {
    const tabs = [
      ...new Map(
        pane.tabs.map((document) => {
          const tab = documentTab(document);
          return [tab.key, tab] as const;
        }),
      ).values(),
    ];
    return {
      tabs,
      active:
        tabs.find((tab) => tab.key === pane.active)?.key ??
        tabs[0]?.key ??
        null,
    };
  };
  const left = restoreTabs(snapshot.left);
  const right = snapshot.right ? restoreTabs(snapshot.right) : null;
  const panes =
    right && right.tabs.length > 0
      ? left.tabs.length === 0
        ? { left: right, right: null, focused: 'left' as const }
        : { left, right, focused: snapshot.focused }
      : { left, right: null, focused: 'left' as const };
  return {
    ...panes,
    mode: snapshot.mode ?? initialMode,
    comparison: snapshot.comparison,
    inspectorOpen: snapshot.inspectorOpen,
  };
}

export function workspaceSnapshot(
  session: WorkspaceSession,
): WorkspaceSnapshot {
  return { version: 1, ...session };
}

export function selectedDocument(
  session: WorkspaceSession,
  mode: InspectorMode,
): WorkspaceTab | undefined {
  const pane = session[session.focused] ?? session.left;
  const active = pane.tabs.find((tab) => tab.key === pane.active);
  return active && documentMode(active) === mode
    ? active
    : [...pane.tabs].reverse().find((tab) => documentMode(tab) === mode);
}

export function readWorkspaceSnapshot(value: unknown): WorkspaceSnapshot {
  const result = Schema.decodeUnknownResult(workspaceSnapshotSchema)(value);
  return result._tag === 'Success'
    ? result.success
    : initialWorkspaceSnapshot();
}

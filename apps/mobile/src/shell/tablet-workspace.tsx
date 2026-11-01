import { Stack, useRouter, useSegments } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { TabletSurface } from './tablet-surface';
import { Box } from '../components/ui/box';
import { DocumentTabs } from '../components/ui/document-tabs';
import { IconButton } from '../components/ui/icon-button';
import { Separator } from '../components/ui/separator';
import { FilesNavigation, FileContent } from '../features/files';
import {
  HistoryNavigation,
  CommitContent,
  HistoryDiffContent,
  FileTimelineContent,
} from '../features/history';
import {
  PullRequestDocumentContent,
  ReviewNavigation,
  ReviewOverview,
  ReviewFileContent,
  useReviewTab,
} from '../features/reviews';
import { useAppSidebar } from '../features/preferences';
import {
  WorkspaceGate,
  useWorkspaceSession,
  requestDocumentLeave,
  type Workspace,
} from '../features/projects';
import { visiblePanes } from '../shared/rules/document-panes';
import type { ReviewComparison } from '../shared/rules/review-comparison';
import {
  reviewPanelSelection,
  selectedDocument,
} from '../shared/rules/workspace-session';
import {
  documentTab,
  type InspectorMode,
  type WorkspaceDocument,
  type WorkspaceTab,
} from '../shared/rules/workspace-documents';
import {
  DockedPanel,
  PanelButtons,
  PanelSheet,
  TabletRail,
  panelEntries,
} from './tablet-panel';

export function TabletWorkspace({
  initialMode = 'files',
}: {
  initialMode?: InspectorMode;
}) {
  return (
    <TabletSurface>
      <Stack.Screen options={{ headerShown: false }} />
      <WorkspaceGate
        title="Workspace"
        fallbackFrame={(content) => (
          <Box className="min-w-0 flex-1" surface="panel">
            <PaneBar />
            {content}
          </Box>
        )}
      >
        {(workspace) => (
          <SelectedWorkspace
            key={workspace.key}
            workspace={workspace}
            initialMode={initialMode}
          />
        )}
      </WorkspaceGate>
    </TabletSurface>
  );
}

function SelectedWorkspace({
  workspace,
  initialMode,
}: {
  workspace: Workspace;
  initialMode: InspectorMode;
}) {
  const { sidebar } = useAppSidebar();
  const {
    session,
    changeMode,
    changeInspector,
    changeComparison,
    changeDocuments,
    open,
    openBeside,
    showReview,
    focus,
  } = useWorkspaceSession(workspace.key, initialMode);
  const reviewTab = useReviewTab(workspace, session.comparison);
  const window = useWindowDimensions();
  const landscape = window.width > window.height;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [contentWidth, setContentWidth] = useState(0);
  const panes = visiblePanes(session, {
    width: contentWidth,
    orientation: landscape ? 'landscape' : 'portrait',
  });
  const entries = panelEntries(reviewTab.title);
  const panelTitle =
    entries.find((entry) => entry.mode === session.mode)?.title ?? 'Files';
  const reviewShown = session.left.active === null;
  const fileSelection = selectedDocument(session, 'files');
  const historySelection = selectedDocument(session, 'history');
  const scope = (pane: 'left' | 'right') => `${workspace.key}:${pane}`;
  const showContent = () => {
    if (!landscape) setSheetOpen(false);
  };
  const choosePanel = (mode: InspectorMode) => {
    if (landscape) {
      const closing = session.inspectorOpen && session.mode === mode;
      if (!closing) changeMode(mode);
      changeInspector(!closing);
    } else {
      changeMode(mode);
      setSheetOpen(true);
    }
  };
  const changePaneDocuments = (
    pane: 'left' | 'right',
    change: Parameters<typeof changeDocuments>[1],
  ) => {
    const documents = session[pane];
    if (!documents) return;
    const next = change(documents);
    const folded = pane === 'right' && next.tabs.length === 0;
    if (folded || documents.active !== next.active)
      requestDocumentLeave(
        () => changeDocuments(pane, change),
        folded ? undefined : scope(pane),
      );
    else changeDocuments(pane, change);
  };
  const openDocument = (
    document: WorkspaceDocument,
    pane?: 'left' | 'right',
  ) => {
    const targetPane = pane ?? session.focused;
    const tab = documentTab(document);
    if (session[targetPane]?.active === tab.key) open(document, targetPane);
    else
      requestDocumentLeave(() => open(document, targetPane), scope(targetPane));
  };
  const openSide = (document: WorkspaceDocument, pane?: 'left' | 'right') => {
    const source = pane ?? session.focused;
    const destination = source === 'left' ? 'right' : 'left';
    requestDocumentLeave(
      () => openBeside(document, source),
      scope(destination),
    );
  };
  const openReview = () => {
    if (reviewShown) showReview();
    else requestDocumentLeave(showReview, scope('left'));
  };
  const openFromPanel = (document: WorkspaceDocument) => {
    openDocument(document);
    showContent();
  };
  const panel = (
    <Box className="min-w-0 flex-1">
      <Box className={session.mode === 'files' ? 'flex-1' : 'hidden'}>
        <FilesNavigation
          active={
            session.mode === 'files' &&
            (landscape ? session.inspectorOpen : sheetOpen)
          }
          selected={workspace}
          comparison={session.comparison}
          sidebar={sidebar}
          embedded
          activePath={
            fileSelection?.kind === 'file' ? fileSelection.path : undefined
          }
          onOpen={(path) => openFromPanel({ kind: 'file', path })}
          onOpenTimeline={(path) => openFromPanel({ kind: 'timeline', path })}
          onOpenToSide={(path) => {
            openSide({ kind: 'file', path });
            showContent();
          }}
        />
      </Box>
      <Box className={session.mode === 'review' ? 'flex-1' : 'hidden'}>
        <ReviewNavigation
          active={
            session.mode === 'review' &&
            (landscape ? session.inspectorOpen : sheetOpen)
          }
          workspace={workspace}
          comparison={session.comparison}
          onComparison={changeComparison}
          selection={reviewPanelSelection(session)}
          onOverview={() => {
            openReview();
            showContent();
          }}
          onFile={(path) =>
            openFromPanel({
              kind: 'review-file',
              path,
              comparison: session.comparison,
            })
          }
        />
      </Box>
      <Box className={session.mode === 'history' ? 'flex-1' : 'hidden'}>
        <HistoryNavigation
          active={
            session.mode === 'history' &&
            (landscape ? session.inspectorOpen : sheetOpen)
          }
          selection={workspace}
          workspace={workspace.key}
          selected={
            historySelection?.kind === 'commit' ||
            historySelection?.kind === 'diff'
              ? historySelection.oid
              : undefined
          }
          onOpen={(oid) => openFromPanel({ kind: 'commit', oid, parent: 1 })}
        />
      </Box>
    </Box>
  );
  return (
    <Box className="min-w-0 flex-1 flex-row" gap={2}>
      <Box className="min-w-0 flex-1" surface="panel">
        <PaneBar>
          {panes.map((pane, index) => (
            <Box key={pane} className="min-w-0 flex-1 flex-row items-center">
              {index > 0 ? <Separator orientation="vertical" /> : null}
              <DocumentTabs
                focused={session.focused === pane}
                documents={session[pane] ?? session.left}
                label={`${pane === 'left' ? 'Left' : 'Right'} pane documents`}
                pinned={
                  pane === 'left'
                    ? {
                        title: reviewTab.title,
                        icon:
                          reviewTab.title === 'Review' ? 'checklist' : 'review',
                        detail: reviewTab.progress,
                        selected: reviewShown,
                        onPress: () => {
                          focus('left');
                          openReview();
                        },
                      }
                    : undefined
                }
                onChange={(change) => changePaneDocuments(pane, change)}
                onSelect={() => focus(pane)}
                onOpenToSide={(document) => openSide(document, pane)}
              />
            </Box>
          ))}
          {session.right && panes.length === 1 ? (
            <IconButton
              icon="split"
              accessibilityLabel={`Show ${session.focused === 'left' ? 'right' : 'left'} document pane`}
              onPress={() =>
                focus(session.focused === 'left' ? 'right' : 'left')
              }
            />
          ) : null}
          {landscape ? null : (
            <>
              <Separator orientation="vertical" />
              <PanelButtons
                entries={entries}
                mode={session.mode}
                open={sheetOpen}
                onPress={choosePanel}
              />
            </>
          )}
        </PaneBar>
        <Box
          className="min-w-0 flex-1 flex-row"
          onLayout={({ nativeEvent: { layout } }) =>
            setContentWidth(layout.width)
          }
        >
          {(['left', 'right'] as const).map((pane) => {
            const documents = session[pane];
            if (!documents) return null;
            const active = documents.tabs.find(
              (tab) => tab.key === documents.active,
            );
            return (
              <Box
                key={pane}
                className={
                  panes.includes(pane) ? 'min-w-0 flex-1 flex-row' : 'hidden'
                }
              >
                {pane === 'right' && panes.length === 2 ? (
                  <Separator orientation="vertical" />
                ) : null}
                <Box
                  className="min-w-0 flex-1"
                  accessibilityLabel={`${pane === 'left' ? 'Left' : 'Right'} document pane`}
                  onPointerDown={() => {
                    if (session.focused !== pane) focus(pane);
                  }}
                  onTouchStart={() => {
                    if (session.focused !== pane) focus(pane);
                  }}
                >
                  {active ? (
                    <WorkspaceDocumentContent
                      key={active.key}
                      document={active}
                      leaveScope={scope(pane)}
                      workspace={workspace}
                      onOpen={(document) => openDocument(document, pane)}
                      onParentChange={(parent) =>
                        changeDocuments(pane, (current) => ({
                          ...current,
                          tabs: current.tabs.map((tab) =>
                            tab.key === active.key && tab.kind === 'commit'
                              ? documentTab({ ...tab, parent })
                              : tab,
                          ),
                        }))
                      }
                    />
                  ) : null}
                  {!active && pane === 'left' ? (
                    <ReviewPage
                      workspace={workspace}
                      comparison={session.comparison}
                      onFile={(path) =>
                        openDocument(
                          {
                            kind: 'review-file',
                            path,
                            comparison: session.comparison,
                          },
                          'left',
                        )
                      }
                    />
                  ) : null}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
      {landscape && session.inspectorOpen ? (
        <DockedPanel title={panelTitle}>{panel}</DockedPanel>
      ) : null}
      {landscape ? (
        <TabletRail
          entries={entries}
          mode={session.mode}
          open={session.inspectorOpen}
          onPress={choosePanel}
          onToggle={() => changeInspector(!session.inspectorOpen)}
        />
      ) : null}
      <PanelSheet
        title={panelTitle}
        presented={!landscape && sheetOpen}
        onClose={() => setSheetOpen(false)}
      >
        {panel}
      </PanelSheet>
    </Box>
  );
}

function PaneBar({ children }: { children?: ReactNode }) {
  const inWorktrees = useSegments().at(-1) === 'workspaces';
  const window = useWindowDimensions();
  const landscape = window.width > window.height;
  const router = useRouter();
  const { sidebar } = useAppSidebar();
  return (
    <Box
      className="h-13 min-w-0 flex-row items-center"
      gap={1}
      paddingX={2}
      divider="bottom"
    >
      {!landscape && !inWorktrees ? (
        <IconButton
          icon="folder"
          accessibilityLabel="Worktrees"
          onPress={() =>
            requestDocumentLeave(() => router.push('/(files)/workspaces'))
          }
        />
      ) : null}
      {landscape && sidebar ? (
        <IconButton
          icon="sidebar"
          accessibilityLabel={sidebar.visible ? 'Hide sidebar' : 'Show sidebar'}
          onPress={sidebar.toggle}
        />
      ) : null}
      {children}
    </Box>
  );
}

function ReviewPage({
  workspace,
  comparison,
  onFile,
}: {
  workspace: Workspace;
  comparison: ReviewComparison;
  onFile: (path: string) => void;
}) {
  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="grow gap-3 p-4"
    >
      <ReviewOverview
        workspace={workspace}
        comparison={comparison}
        onFile={onFile}
      />
    </ScrollView>
  );
}

function WorkspaceDocumentContent({
  document,
  workspace,
  onOpen,
  onParentChange,
  leaveScope,
}: {
  document: WorkspaceTab;
  leaveScope: string;
  workspace: Workspace;
  onOpen: (document: WorkspaceDocument) => void;
  onParentChange: (parent: number) => void;
}) {
  switch (document.kind) {
    case 'pull-request':
      return <PullRequestDocumentContent document={document} />;
    case 'file':
      return (
        <FileContent
          selected={workspace}
          path={document.path}
          onOpenTimeline={(path) => onOpen({ kind: 'timeline', path })}
          inlineComments
          leaveScope={leaveScope}
        />
      );
    case 'timeline':
      return (
        <FileTimelineContent
          selection={workspace}
          path={document.path}
          onOpen={(oid, path) =>
            onOpen({ kind: 'commit', oid, path, parent: 1 })
          }
        />
      );
    case 'review-file':
      return (
        <ReviewFileContent
          workspace={workspace}
          path={document.path}
          comparison={document.comparison}
          inlineComments
          leaveScope={leaveScope}
        />
      );
    case 'commit':
      return (
        <CommitContent
          key={`${workspace.key}:${document.oid}:${document.parent}`}
          selection={workspace}
          oid={document.oid}
          parent={document.parent}
          selectedPath={document.path}
          onParentChange={onParentChange}
          onOpenFile={(path) =>
            onOpen({
              kind: 'diff',
              oid: document.oid,
              parent: document.parent,
              path,
            })
          }
        />
      );
    case 'diff':
      return (
        <HistoryDiffContent
          selection={workspace}
          oid={document.oid}
          parent={document.parent}
          path={document.path}
          inlineComments
          leaveScope={leaveScope}
        />
      );
  }
}

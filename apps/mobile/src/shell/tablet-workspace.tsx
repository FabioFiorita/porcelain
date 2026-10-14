import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { TabletSurface } from '../components/ui/tablet-surface';
import { Box } from '../components/ui/box';
import { ChromeButton } from '../components/ui/chrome-button';
import { DocumentTabs } from '../components/ui/document-tabs';
import { Empty } from '../components/ui/empty';
import { IconButton } from '../components/ui/icon-button';
import { Separator } from '../components/ui/separator';
import { WorkspaceModeTabs } from '../components/ui/workspace-mode-tabs';
import { WorkspacePanes } from '../components/ui/workspace-panes';
import { FilesNavigation, FileContent } from '../features/files';
import {
  HistoryNavigation,
  CommitContent,
  HistoryDiffContent,
} from '../features/history';
import {
  ReviewNavigation,
  ReviewOverview,
  ReviewFileContent,
} from '../features/reviews';
import { useAppSidebar } from '../features/preferences';
import {
  WorkspaceGate,
  useWorkspaceSession,
  requestDocumentLeave,
  type Workspace,
} from '../features/projects';
import { visiblePanes } from '../shared/rules/document-panes';
import { selectedDocument } from '../shared/rules/workspace-session';
import {
  documentTab,
  type InspectorMode,
  type WorkspaceDocument,
  type WorkspaceTab,
} from '../shared/rules/workspace-documents';

export function TabletWorkspace({
  initialMode = 'files',
}: {
  initialMode?: InspectorMode;
}) {
  const { sidebar } = useAppSidebar();
  return (
    <TabletSurface>
      <Stack.Screen options={{ headerShown: false }} />
      <WorkspaceGate
        title="Workspace"
        fallbackToolbar={
          sidebar ? (
            <Box
              className="items-start"
              paddingX={4}
              paddingY={2}
              divider="bottom"
            >
              <ChromeButton
                icon="sidebar"
                label={sidebar.visible ? 'Hide sidebar' : 'Show sidebar'}
                onPress={sidebar.toggle}
              />
            </Box>
          ) : null
        }
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
    focus,
  } = useWorkspaceSession(workspace.key, initialMode);
  const [contentWidth, setContentWidth] = useState(0);
  const panes = visiblePanes(session, contentWidth);
  const fileSelection = selectedDocument(session, 'files');
  const historySelection = selectedDocument(session, 'history');
  const reviewSelection = selectedDocument(session, 'review');
  const selectedReviewPath =
    reviewSelection?.kind === 'review-file' &&
    reviewSelection.key ===
      documentTab({
        kind: 'review-file',
        path: reviewSelection.path,
        comparison: session.comparison,
      }).key
      ? reviewSelection.path
      : undefined;
  const overviewSelected =
    reviewSelection?.key ===
    documentTab({ kind: 'review-overview', comparison: session.comparison })
      .key;
  const scope = (pane: 'left' | 'right') => `${workspace.key}:${pane}`;
  const changePaneDocuments = (
    pane: 'left' | 'right',
    change: Parameters<typeof changeDocuments>[1],
  ) => {
    const documents = session[pane];
    if (!documents) return;
    const next = change(documents);
    const folded = session.right !== null && next.tabs.length === 0;
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
  return (
    <WorkspacePanes
      navigationVisible={session.inspectorOpen}
      onNavigationVisibleChange={changeInspector}
      header={(showContent) => (
        <Box
          className="min-w-0 flex-row items-center"
          gap={2}
          paddingX={4}
          paddingY={2}
          divider="bottom"
        >
          {sidebar ? (
            <ChromeButton
              icon="sidebar"
              label={sidebar.visible ? 'Hide sidebar' : 'Show sidebar'}
              onPress={sidebar.toggle}
            />
          ) : null}
          {panes.map((pane, index) => (
            <Box key={pane} className="min-w-0 flex-1 flex-row items-center">
              {index > 0 ? <Separator orientation="vertical" /> : null}
              <DocumentTabs
                focused={session.focused === pane}
                documents={session[pane] ?? session.left}
                label={`${pane === 'left' ? 'Left' : 'Right'} pane documents`}
                onChange={(change) => changePaneDocuments(pane, change)}
                onSelect={() => {
                  focus(pane);
                  showContent();
                }}
                onOpenToSide={(document) => {
                  openSide(document, pane);
                  showContent();
                }}
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
          <ChromeButton
            icon="inspector"
            label={session.inspectorOpen ? 'Hide inspector' : 'Show inspector'}
            onPress={() => changeInspector(!session.inspectorOpen)}
          />
        </Box>
      )}
      navigation={(showContent) => {
        const openFromInspector = (document: WorkspaceDocument) => {
          openDocument(document);
          showContent();
        };
        return (
          <Box className="min-w-0 flex-1">
            <Box
              className="flex-row"
              gap={1}
              paddingX={4}
              paddingY={2}
              divider="bottom"
            >
              <WorkspaceModeTabs value={session.mode} onChange={changeMode} />
            </Box>
            <Box className={session.mode === 'files' ? 'flex-1' : 'hidden'}>
              <FilesNavigation
                selected={workspace}
                sidebar={sidebar}
                embedded
                activePath={
                  fileSelection?.kind === 'file'
                    ? fileSelection.path
                    : undefined
                }
                onOpen={(path) => openFromInspector({ kind: 'file', path })}
                onOpenToSide={(path) => {
                  openSide({ kind: 'file', path });
                  showContent();
                }}
              />
            </Box>
            <Box className={session.mode === 'review' ? 'flex-1' : 'hidden'}>
              <ReviewNavigation
                workspace={workspace}
                comparison={session.comparison}
                onComparison={changeComparison}
                embedded
                selectedPath={selectedReviewPath}
                overviewSelected={overviewSelected}
                onOverview={() =>
                  openFromInspector({
                    kind: 'review-overview',
                    comparison: session.comparison,
                  })
                }
                onFile={(path) =>
                  openFromInspector({
                    kind: 'review-file',
                    path,
                    comparison: session.comparison,
                  })
                }
              />
            </Box>
            <Box className={session.mode === 'history' ? 'flex-1' : 'hidden'}>
              <HistoryNavigation
                selection={workspace}
                workspace={workspace.key}
                selected={
                  historySelection?.kind === 'commit' ||
                  historySelection?.kind === 'diff'
                    ? historySelection.oid
                    : undefined
                }
                onOpen={(oid) =>
                  openFromInspector({ kind: 'commit', oid, parent: 1 })
                }
              />
            </Box>
          </Box>
        );
      }}
    >
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
                ) : (
                  <Empty
                    title="Choose a document"
                    description="Open a file, review or commit from the inspector."
                  />
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </WorkspacePanes>
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
    case 'file':
      return (
        <FileContent
          selected={workspace}
          path={document.path}
          inlineComments
          leaveScope={leaveScope}
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
    case 'review-overview':
      return (
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="grow gap-3 p-4"
        >
          <ReviewOverview
            workspace={workspace}
            comparison={document.comparison}
            empty
            onFile={(path) =>
              onOpen({
                kind: 'review-file',
                path,
                comparison: document.comparison,
              })
            }
          />
        </ScrollView>
      );
    case 'commit':
      return (
        <CommitContent
          selection={workspace}
          oid={document.oid}
          parent={document.parent}
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

import { Stack, useRouter } from 'expo-router';
import { Dimensions, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { Box } from '../components/ui/box';
import { ChromeButton } from '../components/ui/chrome-button';
import { DocumentTabs } from '../components/ui/document-tabs';
import { Empty } from '../components/ui/empty';
import { Item } from '../components/ui/item';
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
  type Workspace,
} from '../features/projects';
import {
  documentTab,
  type InspectorMode,
  type WorkspaceDocument,
  type WorkspaceTab,
} from '../shared/rules/workspace-documents';

const modes = [
  { id: 'files', title: 'Files' },
  { id: 'review', title: 'Review' },
  { id: 'history', title: 'History' },
] as const;

const StyledSafeAreaView = withUniwind(SafeAreaView);

export function TabletWorkspace({
  initialMode = 'files',
}: {
  initialMode?: InspectorMode;
}) {
  const { sidebar } = useAppSidebar();
  const window = useWindowDimensions();
  const screen = Dimensions.get('screen');
  const windowed = window.width < screen.width || window.height < screen.height;
  return (
    <StyledSafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      className="min-w-0 flex-1 bg-background"
    >
      <Stack.Screen options={{ headerShown: false }} />
      <Box className="min-w-0 flex-1" {...(windowed ? { paddingTop: 8 } : {})}>
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
      </Box>
    </StyledSafeAreaView>
  );
}

function SelectedWorkspace({
  workspace,
  initialMode,
}: {
  workspace: Workspace;
  initialMode: InspectorMode;
}) {
  const router = useRouter();
  const { sidebar } = useAppSidebar();
  const {
    session,
    changeMode,
    changeInspector,
    changeComparison,
    changeDocuments,
    open,
  } = useWorkspaceSession(workspace.key, initialMode);
  const active = session.documents.tabs.find(
    (tab) => tab.key === session.documents.active,
  );
  const fileSelection = session.selected.files;
  const historySelection = session.selected.history;
  const reviewSelection = session.selected.review;
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
          <DocumentTabs
            documents={session.documents}
            onChange={changeDocuments}
            onSelect={showContent}
          />
          <ChromeButton
            icon="inspector"
            label={session.inspectorOpen ? 'Hide inspector' : 'Show inspector'}
            onPress={() => changeInspector(!session.inspectorOpen)}
          />
        </Box>
      )}
      navigation={(showContent) => {
        const openFromInspector = (document: WorkspaceDocument) => {
          open(document);
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
              {modes.map((mode) => (
                <Box className="min-w-0 flex-1" key={mode.id}>
                  <Item
                    title={mode.title}
                    size="xs"
                    selected={session.mode === mode.id}
                    onPress={() => changeMode(mode.id)}
                  />
                </Box>
              ))}
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
      {active ? (
        <WorkspaceDocumentContent
          key={active.key}
          document={active}
          workspace={workspace}
          onOpen={open}
          onEdit={(path) =>
            router.push({
              pathname: '/file-edit',
              params: { path, workspace: workspace.key },
            })
          }
          onParentChange={(parent) =>
            changeDocuments((documents) => ({
              ...documents,
              tabs: documents.tabs.map((tab) =>
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
    </WorkspacePanes>
  );
}

function WorkspaceDocumentContent({
  document,
  workspace,
  onOpen,
  onEdit,
  onParentChange,
}: {
  document: WorkspaceTab;
  workspace: Workspace;
  onOpen: (document: WorkspaceDocument) => void;
  onEdit: (path: string) => void;
  onParentChange: (parent: number) => void;
}) {
  switch (document.kind) {
    case 'file':
      return (
        <FileContent
          selected={workspace}
          path={document.path}
          onEdit={() => onEdit(document.path)}
        />
      );
    case 'review-file':
      return (
        <ReviewFileContent
          workspace={workspace}
          path={document.path}
          comparison={document.comparison}
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
        />
      );
  }
}

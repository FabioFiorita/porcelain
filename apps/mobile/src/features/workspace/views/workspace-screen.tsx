import { Stack, useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { worktreeLabel } from '@porcelain/client/projects/rules';
import { Box } from '../../../components/ui/box';
import { DocumentTabs } from '../../../components/ui/document-tabs';
import { Empty } from '../../../components/ui/empty';
import { Item } from '../../../components/ui/item';
import { LeadingToolbar } from '../../../components/ui/leading-toolbar';
import { WorkspacePanes } from '../../../components/ui/workspace-panes';
import { headerIcon } from '../../../shared/icons/header-icon';
import { FilesNavigation, FileContent } from '../../files';
import {
  HistoryNavigation,
  CommitContent,
  HistoryDiffContent,
} from '../../history';
import {
  ReviewNavigation,
  ReviewOverview,
  ReviewFileContent,
} from '../../reviews';
import { useAppSidebar } from '../../preferences';
import { WorkspaceGate, type Workspace } from '../../projects';
import {
  documentTab,
  type InspectorMode,
  type WorkspaceDocument,
  type WorkspaceTab,
} from '../rules/documents';
import { useWorkspaceSession } from '../store';

const modes = [
  { id: 'files', title: 'Files' },
  { id: 'review', title: 'Review' },
  { id: 'history', title: 'History' },
] as const;

export function WorkspaceScreen({
  initialMode = 'files',
}: {
  initialMode?: InspectorMode;
}) {
  const { sidebar } = useAppSidebar();
  return (
    <WorkspaceGate
      title="Workspace"
      fallbackToolbar={<LeadingToolbar sidebar={sidebar} />}
    >
      {(workspace) => (
        <SelectedWorkspace
          key={workspace.key}
          workspace={workspace}
          initialMode={initialMode}
        />
      )}
    </WorkspaceGate>
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
    <Box className="min-w-0 flex-1" surface="background">
      <Stack.Screen
        options={{
          title: `${workspace.project.name} · ${worktreeLabel(workspace.worktree.branch)}`,
        }}
      />
      <LeadingToolbar sidebar={sidebar} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={headerIcon('inspector')}
          accessibilityLabel={
            session.inspectorOpen ? 'Hide inspector' : 'Show inspector'
          }
          onPress={() => changeInspector(!session.inspectorOpen)}
        />
      </Stack.Toolbar>
      <WorkspacePanes
        navigationLabel="Inspector"
        hasSelection={active !== undefined}
        navigationVisible={session.inspectorOpen}
        onNavigationVisibleChange={changeInspector}
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
        <DocumentTabs
          documents={session.documents}
          onChange={changeDocuments}
        />
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
    </Box>
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

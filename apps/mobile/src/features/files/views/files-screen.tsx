import { Box } from '../../../components/ui/box';
import {
  LeadingToolbar,
  type LeadingToolbarProps,
} from '../../../components/ui/leading-toolbar';
import { WorkspaceGate, type Workspace } from '../../projects';
import { worktreeLabel } from '@porcelain/client/projects/rules';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { Array, Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  fileErrorMessage,
  quickOpenMatches,
  mergeFileTreeEntries,
  entryTreeActions,
} from '@porcelain/client/files/rules';
import { FileTree } from '../../../components/ui/file-tree';
import { Input } from '../../../components/ui/input';
import { Loading } from '../../../components/ui/loading';
import { ErrorState } from '../../../components/ui/error-state';
import { Text } from '../../../components/ui/text';
import { headerIcon } from '../../../shared/icons/header-icon';
import { directoryRequests } from '../rules/directory-requests';
import { useDirectories } from '../queries/directory';
import { directoryLoading } from '../rules/directory-loading';
import { useFilePaths } from '../queries/paths';
import { FileActionSheet } from './file-action';
import type { FileAction } from '../commands/edit-file';

export function FilesScreen({
  onOpen,
  sidebar,
}: {
  onOpen: (path: string, workspace: string) => void;
  sidebar: LeadingToolbarProps['sidebar'];
}) {
  return (
    <WorkspaceGate
      title="Files"
      fallbackToolbar={<LeadingToolbar sidebar={sidebar} />}
    >
      {(selected) => (
        <WorktreeFiles
          key={selected.key}
          selected={selected}
          onOpen={onOpen}
          sidebar={sidebar}
        />
      )}
    </WorkspaceGate>
  );
}

function WorktreeFiles({
  selected,
  onOpen,
  sidebar,
}: {
  selected: Workspace;
  onOpen: (path: string, workspace: string) => void;
  sidebar: LeadingToolbarProps['sidebar'];
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [requested, setRequested] = useState<readonly string[]>(['']);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState<FileAction>();
  const [refreshRequested, setRefreshRequested] = useState(false);
  const directories = useDirectories({
    connection: selected.connection,
    scope: selected.scope,
    paths: requested,
  });
  const data = directories.results.flatMap((result) =>
    Option.toArray(AsyncResult.value(result)),
  );
  useEffect(() => {
    const confirmed = directories.results.flatMap((result) =>
      AsyncResult.isSuccess(result) && !result.waiting ? [result.value] : [],
    );
    const reachable = directoryRequests(requested, confirmed);
    if (reachable.length === requested.length) return;
    setRequested(reachable);
    setExpanded(
      (current) =>
        new Set([...current].filter((path) => reachable.includes(path))),
    );
  }, [directories.results, requested]);
  const failure = directories.results.find(AsyncResult.isFailure);
  const loading = directoryLoading(
    Array.zip(requested, directories.results).map(([path, result]) => ({
      path,
      result,
    })),
  );
  const pending = directories.results.some(
    (result) => AsyncResult.isInitial(result) || result.waiting,
  );
  const refreshing = refreshRequested && pending;
  useEffect(() => {
    if (refreshRequested && !pending) setRefreshRequested(false);
  }, [pending, refreshRequested]);
  const refresh = () => {
    setRefreshRequested(true);
    directories.refresh();
  };
  const paths = useFilePaths(selected.connection, selected.scope);
  const pathData = Option.getOrUndefined(AsyncResult.value(paths.result));
  const searching = Boolean(query.trim());
  const open = (path: string) => onOpen(path, selected.key);
  const nodes = mergeFileTreeEntries(data);
  const header = (
    <Box gap={3} paddingX={4} paddingY={3}>
      <Input
        accessibilityLabel="Search files"
        placeholder="Search files"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text variant="caption" tone="muted">
        {selected.project.name} · {worktreeLabel(selected.worktree.branch)}
      </Text>
      {failure ? (
        <ErrorState
          message={fileErrorMessage(Cause.squash(failure.cause))}
          retry={{
            label: 'Read folders again',
            onPress: refresh,
            pending: refreshing,
          }}
        />
      ) : null}
      {loading.initialRoot ? <Loading label="Reading files…" /> : null}
      {searching && AsyncResult.isFailure(paths.result) ? (
        <ErrorState
          message={fileErrorMessage(Cause.squash(paths.result.cause))}
          retry={{ label: 'Search again', onPress: paths.refresh }}
        />
      ) : null}
      {searching && !pathData ? <Loading label="Searching files…" /> : null}
    </Box>
  );
  return (
    <Box className="flex-1" surface="background" collapsable={false}>
      <LeadingToolbar sidebar={sidebar}>
        <Stack.Toolbar.Button
          icon={headerIcon('refresh')}
          accessibilityLabel={refreshing ? 'Refreshing files' : 'Refresh files'}
          disabled={refreshing}
          onPress={refresh}
        />
        <Stack.Toolbar.Menu
          icon={headerIcon('add')}
          accessibilityLabel="Create file or folder"
          title="Create file or folder"
        >
          <Stack.Toolbar.MenuAction
            onPress={() =>
              setAction({ kind: 'create', entryKind: 'file', folder: '' })
            }
          >
            New file
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            onPress={() =>
              setAction({ kind: 'create', entryKind: 'directory', folder: '' })
            }
          >
            New folder
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </LeadingToolbar>
      <FileTree
        header={header}
        flat={searching}
        loaded={
          searching ? AsyncResult.isSuccess(paths.result) : loading.rootLoaded
        }
        nodes={
          searching
            ? quickOpenMatches(pathData?.paths ?? [], query).map((path) => ({
                path,
                kind: 'file' as const,
              }))
            : nodes
        }
        expanded={expanded}
        loading={loading.folders}
        onToggle={(id) => {
          setExpanded((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
          setRequested((current) =>
            current.includes(id) ? current : [...current, id],
          );
        }}
        onSelect={(path) => {
          if (
            searching ||
            nodes.some((node) => node.path === path && node.kind === 'file')
          )
            open(path);
        }}
        contextMenu={
          searching
            ? undefined
            : (node) => {
                const path = node.path.replace(/\/$/, '');
                return entryTreeActions(node, {
                  changed: false,
                  hiddenEntry: null,
                  ownHidden: false,
                  hiddenName: '',
                })
                  .filter(
                    ({ id }) =>
                      id === 'new-file' ||
                      id === 'new-folder' ||
                      id === 'open' ||
                      id === 'rename' ||
                      id === 'trash',
                  )
                  .map(({ id, label }) => ({
                    id,
                    label,
                    destructive: id === 'trash',
                    onPress: () => {
                      switch (id) {
                        case 'new-file':
                        case 'new-folder':
                          setAction({
                            kind: 'create',
                            entryKind: id === 'new-file' ? 'file' : 'directory',
                            folder: path,
                          });
                          break;
                        case 'open':
                          open(path);
                          break;
                        case 'rename':
                          setAction({ kind: 'move', path });
                          break;
                        case 'trash':
                          setAction({ kind: 'trash', path });
                          break;
                      }
                    },
                  }));
              }
        }
      />
      <FileActionSheet
        selected={selected}
        action={action}
        onClose={() => setAction(undefined)}
        onCreated={open}
      />
    </Box>
  );
}

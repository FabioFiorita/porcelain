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
  mergeFileTreeEntries,
  entryName,
  type FileTreeEntry,
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
import { CreateMenu } from './create-menu';
import type { FileAction } from '../commands/edit-file';
import { Button } from '../../../components/ui/button';
import { IconButton } from '../../../components/ui/icon-button';
import { FileIcon } from '../../../components/ui/file-icon';
import { ItemMenu } from '../../../components/ui/item-menu';
import { useFilePreferences } from '../queries/file-preferences';
import { useSetFilePreference } from '../commands/file-preferences';
import {
  filePreferenceActions,
  filePreferenceEntries,
} from '../rules/file-preferences';

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
        <FilesNavigation
          key={selected.key}
          selected={selected}
          onOpen={onOpen}
          sidebar={sidebar}
        />
      )}
    </WorkspaceGate>
  );
}

type FilesNavigationProps = {
  selected: Workspace;
  onOpen: (path: string, workspace: string) => void;
  sidebar: LeadingToolbarProps['sidebar'];
  activePath?: string | undefined;
  embedded?: boolean;
  onOpenToSide?: ((path: string) => void) | undefined;
};

export function FilesNavigation(props: FilesNavigationProps) {
  return <FilesNavigationView key={props.selected.key} {...props} />;
}

function FilesNavigationView({
  selected,
  onOpen,
  sidebar,
  activePath,
  embedded = false,
  onOpenToSide,
}: FilesNavigationProps) {
  const preferences = {
    read: useFilePreferences(selected.connection, selected.scope.projectId),
    write: useSetFilePreference(selected.connection, selected.scope.projectId),
  };
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [requested, setRequested] = useState<readonly string[]>(['']);
  const [query, setQuery] = useState('');
  const [showHidden, setShowHidden] = useState(false);
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
  const preferenceData = Option.getOrUndefined(
    AsyncResult.value(preferences.read.result),
  );
  const preferenceEntries = filePreferenceEntries({
    entries: nodes,
    paths: pathData?.paths ?? [],
    preferences: preferenceData?.preferences ?? [],
    showHidden,
    query,
  });
  const preferencesLoaded = preferenceData !== undefined;
  const visibleEntries = searching
    ? preferenceEntries.matches
    : preferenceEntries.nodes;
  const preferencePending =
    !preferenceData ||
    preferences.read.result.waiting ||
    preferences.write.result.waiting;
  const menuFor = (node: FileTreeEntry) => {
    const { path, pin, hide, actions } = filePreferenceActions(
      node,
      preferenceEntries.hidden,
      preferenceEntries.pinned,
      embedded && onOpenToSide !== undefined,
    );
    return actions.map(({ id, label }) => ({
      id,
      label,
      destructive: id === 'trash',
      disabled: (id === 'pin' || id === 'hide') && preferencePending,
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
          case 'open-to-side':
            onOpenToSide?.(path);
            break;
          case 'rename':
            setAction({ kind: 'move', path });
            break;
          case 'trash':
            setAction({ kind: 'trash', path });
            break;
          case 'pin':
            if (!preferencePending) preferences.write.submit(pin);
            break;
          case 'hide':
            if (!preferencePending) preferences.write.submit(hide);
            break;
        }
      },
    }));
  };
  const header = (
    <Box gap={3} paddingX={4} paddingY={3}>
      <Box className="flex-row items-center" gap={2}>
        <Box className="min-w-0 flex-1">
          <Input
            accessibilityLabel="Search files"
            placeholder="Search files"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Box>
        <IconButton
          icon="collapse"
          accessibilityLabel={
            searching ? 'Clear search and collapse all' : 'Collapse all'
          }
          onPress={() => {
            setQuery('');
            setExpanded(new Set());
          }}
        />
        {embedded ? (
          <CreateMenu
            onFile={() =>
              setAction({ kind: 'create', entryKind: 'file', folder: '' })
            }
            onFolder={() =>
              setAction({
                kind: 'create',
                entryKind: 'directory',
                folder: '',
              })
            }
          />
        ) : null}
      </Box>
      {preferenceEntries.hidden.size > 0 ? (
        <Button
          label={`${showHidden ? 'Hide hidden' : 'Show hidden'} (${preferenceEntries.hidden.size})`}
          variant={showHidden ? 'secondary' : 'ghost'}
          onPress={() => setShowHidden((current) => !current)}
        />
      ) : null}
      {!embedded ? (
        <Text variant="caption" tone="muted">
          {selected.project.name} · {worktreeLabel(selected.worktree.branch)}
        </Text>
      ) : null}
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
      {!preferenceData && !AsyncResult.isFailure(preferences.read.result) ? (
        <Loading label="Reading file preferences…" />
      ) : null}
      {AsyncResult.isFailure(preferences.read.result) ? (
        <ErrorState
          message={fileErrorMessage(
            Cause.squash(preferences.read.result.cause),
          )}
          retry={{
            label: 'Read file preferences again',
            onPress: preferences.read.refresh,
            pending: preferences.read.result.waiting,
          }}
        />
      ) : null}
      {preferences.write.result.waiting ? (
        <Loading label="Saving file preference…" />
      ) : null}
      {AsyncResult.isFailure(preferences.write.result) ? (
        <ErrorState
          message={fileErrorMessage(
            Cause.squash(preferences.write.result.cause),
          )}
          retry={{
            label: 'Save file preference again',
            onPress: preferences.write.retry,
            pending: preferences.write.result.waiting,
          }}
        />
      ) : null}
      {preferenceEntries.pinnedPaths.length > 0 ? (
        <Box gap={1}>
          <Text variant="caption" tone="muted" weight="medium">
            Pinned files
          </Text>
          {preferenceEntries.pinnedPaths.map((path) => (
            <ItemMenu
              key={path}
              title={entryName(path)}
              description={path}
              leading={<FileIcon kind="file" />}
              size="sm"
              selected={path === activePath}
              accessibilityLabel={`Open pinned file ${path}`}
              onPress={() => open(path)}
              actions={menuFor({ path, kind: 'file' })}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  );
  return (
    <Box className="flex-1" surface="background" collapsable={false}>
      {!embedded ? (
        <LeadingToolbar sidebar={sidebar}>
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
                setAction({
                  kind: 'create',
                  entryKind: 'directory',
                  folder: '',
                })
              }
            >
              New folder
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </LeadingToolbar>
      ) : null}
      <FileTree
        header={header}
        flat={searching}
        loaded={
          preferencesLoaded &&
          (searching ? AsyncResult.isSuccess(paths.result) : loading.rootLoaded)
        }
        nodes={preferencesLoaded ? visibleEntries : []}
        expanded={expanded}
        {...(activePath ? { selected: activePath } : {})}
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
        contextMenu={menuFor}
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

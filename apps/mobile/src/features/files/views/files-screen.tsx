import { Box } from '../../../components/ui/box';
import {
  LeadingToolbar,
  type LeadingToolbarProps,
} from '../../../components/ui/leading-toolbar';
import { WorkspaceGate, type Workspace } from '../../projects';
import { useFileReview } from '../../reviews';
import type { ReviewComparison } from '../../../shared/rules/review-comparison';
import { worktreeLabel } from '@porcelain/client/projects/rules';
import { useState } from 'react';
import { useFileNavigation } from '../store';
import { Stack } from 'expo-router';
import { Array, Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  fileErrorMessage,
  fileTreeAncestors,
  mergeFileTreeEntries,
  type FileTreeEntry,
} from '@porcelain/client/files/rules';
import { FileTree, FileTreeItem } from '../../../components/ui/file-tree';
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
import { ButtonSurface } from '../../../components/ui/button-surface';
import { GroupHeader } from '../../../components/ui/group-header';
import { Icon } from '../../../components/ui/icon';
import { IconButton } from '../../../components/ui/icon-button';
import { useFilePreferences } from '../queries/file-preferences';
import { useSetFilePreference } from '../commands/file-preferences';
import {
  filePreferenceActions,
  filePreferenceEntries,
  pinnedParentDirectories,
  pinnedFileTreeRows,
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
      fallbackFrame={(content) => (
        <>
          <LeadingToolbar sidebar={sidebar} />
          {content}
        </>
      )}
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
  comparison?: ReviewComparison;
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
  comparison = { kind: 'worktree' },
}: FilesNavigationProps) {
  const review = useFileReview(selected, comparison);
  const preferences = {
    read: useFilePreferences(selected.connection, selected.scope.projectId),
    write: useSetFilePreference(selected.connection, selected.scope.projectId),
  };
  const {
    expanded,
    setExpanded,
    requested,
    setRequested,
    query,
    setQuery,
    showHidden,
    setShowHidden,
    pinnedOpen,
    setPinnedOpen,
    allOpen,
    setAllOpen,
  } = useFileNavigation(selected.key, embedded);
  const [action, setAction] = useState<FileAction>();
  const [refreshRequested, setRefreshRequested] = useState(false);
  const preferenceData = Option.getOrUndefined(
    AsyncResult.value(preferences.read.result),
  );
  const pinDirectories = useDirectories({
    connection: selected.connection,
    scope: selected.scope,
    paths: pinnedParentDirectories(preferenceData?.preferences ?? []),
  });
  const directories = useDirectories({
    connection: selected.connection,
    scope: selected.scope,
    paths: requested,
  });
  const data = [...directories.results, ...pinDirectories.results].flatMap(
    (result) => Option.toArray(AsyncResult.value(result)),
  );
  {
    const confirmed = directories.results.flatMap((result) =>
      AsyncResult.isSuccess(result) && !result.waiting ? [result.value] : [],
    );
    const reachable = directoryRequests(requested, confirmed);
    if (reachable.length !== requested.length) {
      setRequested(reachable);
      setExpanded(
        (current) =>
          new Set([...current].filter((path) => reachable.includes(path))),
      );
    }
  }
  const failure = [...directories.results, ...pinDirectories.results].find(
    AsyncResult.isFailure,
  );
  const loading = directoryLoading(
    Array.zip(requested, directories.results).map(([path, result]) => ({
      path,
      result,
    })),
  );
  const pending = [...directories.results, ...pinDirectories.results].some(
    (result) => AsyncResult.isInitial(result) || result.waiting,
  );
  const readingPins =
    directories.results.some(
      (result, index) =>
        requested[index] === '' && AsyncResult.isInitial(result),
    ) || pinDirectories.results.some(AsyncResult.isInitial);
  const refreshing = refreshRequested && pending;
  if (refreshRequested && !pending) setRefreshRequested(false);
  const refresh = () => {
    setRefreshRequested(true);
    directories.refresh();
    pinDirectories.refresh();
  };
  const paths = useFilePaths(selected.connection, selected.scope);
  const pathData = Option.getOrUndefined(AsyncResult.value(paths.result));
  const searching = Boolean(query.trim());
  const open = (path: string) => onOpen(path, selected.key);
  const nodes = mergeFileTreeEntries(data);
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
  const toggleFolder = (path: string) => {
    setExpanded((current) => {
      const next = new Set([...current, ...fileTreeAncestors(path)]);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
    setRequested((current) => [
      ...new Set([...current, ...fileTreeAncestors(path), path]),
    ]);
  };
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
    <Box
      gap={embedded ? 3 : 2}
      {...(embedded ? { paddingX: 4, paddingY: 3 } : { paddingY: 2 })}
    >
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
      {!embedded || preferenceEntries.hidden.size > 0 ? (
        <Box className="min-h-8 flex-row items-center" gap={2}>
          <Box className="min-w-0 flex-1">
            {!embedded ? (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {selected.project.name} ·{' '}
                {worktreeLabel(selected.worktree.branch)}
              </Text>
            ) : null}
          </Box>
          {preferenceEntries.hidden.size > 0 ? (
            <ButtonSurface
              variant="link"
              size="sm"
              accessibilityLabel={`${showHidden ? 'Hide hidden' : 'Show hidden'} (${preferenceEntries.hidden.size})`}
              onPress={() => setShowHidden((current) => !current)}
            >
              <Icon
                name={showHidden ? 'visible' : 'hidden'}
                tone="brand"
                size="small"
              />
              <Text variant="caption" tone="brand" weight="medium">
                {showHidden ? 'Hide hidden' : 'Show hidden'} (
                {preferenceEntries.hidden.size})
              </Text>
            </ButtonSurface>
          ) : null}
        </Box>
      ) : null}
      {embedded ? (
        <Text variant="caption" tone="muted">
          {comparison.kind === 'worktree'
            ? 'Uncommitted review status'
            : 'Branch review status'}
        </Text>
      ) : null}
      {review.unavailable ? (
        <ErrorState
          message="File review status is unavailable."
          retry={{
            label: 'Read file review status again',
            onPress: review.refresh,
            pending: review.pending,
          }}
        />
      ) : null}
      {!review.unavailable && review.pending ? (
        <Loading label="Reading file review status…" />
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
      {!searching && preferenceEntries.pinnedEntries.length > 0 ? (
        <Box gap={1}>
          <GroupHeader
            label="Pinned"
            count={preferenceEntries.pinnedEntries.length}
            expanded={pinnedOpen}
            onPress={() => setPinnedOpen((current) => !current)}
          />
          {pinnedOpen && readingPins ? (
            <Loading label="Reading pinned paths…" />
          ) : null}
          {pinnedOpen && !readingPins
            ? pinnedFileTreeRows(
                preferenceEntries.pinnedEntries,
                preferenceEntries.nodes,
                expanded,
              ).map(({ entry, depth, pin, key }) => (
                <FileTreeItem
                  key={key}
                  node={entry}
                  depth={depth}
                  expanded={expanded}
                  selected={activePath}
                  loading={loading.folders}
                  onToggle={toggleFolder}
                  onSelect={open}
                  contextMenu={menuFor}
                  showParent={pin}
                  pinned={pin}
                  annotations={review.labels}
                  changes={review.changes}
                />
              ))
            : null}
        </Box>
      ) : null}
      {searching ? null : (
        <GroupHeader
          label="All files"
          expanded={allOpen}
          onPress={() => setAllOpen((current) => !current)}
        />
      )}
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
          (searching
            ? AsyncResult.isSuccess(paths.result)
            : allOpen && loading.rootLoaded)
        }
        nodes={
          preferencesLoaded && (searching || allOpen) ? visibleEntries : []
        }
        annotations={review.labels}
        changes={review.changes}
        expanded={expanded}
        {...(activePath ? { selected: activePath } : {})}
        loading={loading.folders}
        onToggle={toggleFolder}
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

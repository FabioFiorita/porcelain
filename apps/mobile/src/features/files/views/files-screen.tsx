import { Box } from '../../../components/ui/box';
import { WorkspaceGate, type Workspace } from '../../projects/index';
import { useFileReview } from '../../workspace/index';
import { worktreeLabel } from '@porcelain/client/projects/rules';
import { useState } from 'react';
import { useFileNavigation } from '../store';
import { Stack, useIsFocused, useRouter } from 'expo-router';
import type { SearchBarCommands } from 'react-native-screens';
import { Alert } from 'react-native';
import { Array, Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  hiddenPathFor,
  fileErrorMessage,
  mergeFileTreeEntries,
  type FileTreeEntry,
  type PinnedDirectoryState,
  pinnedFileEntries,
  pinnedParentDirectories,
  visibleFileTreeRows,
  filePreferenceActions,
  filePreferenceEntries,
  quickOpenPath,
} from '@porcelain/client/files/rules';
import { FileTree, type FileTreeRow } from '../../../components/ui/file-tree';
import { Input } from '../../../components/ui/input';
import { Loading } from '../../../components/ui/loading';
import { ErrorState } from '../../../components/ui/error-state';
import { Text } from '../../../components/ui/text';
import { Empty } from '../../../components/ui/empty';
import { headerIcon } from '../../../shared/icons/header-icon';
import { useDirectories } from '../queries/directory';
import { directoryLoading } from '../rules/directory-loading';
import { useFilePaths } from '../queries/paths';
import { useEditFile, type FileAction } from '../commands/edit-file';
import { ButtonSurface } from '../../../components/ui/button-surface';
import { GroupHeader } from '../../../components/ui/group-header';
import { Icon } from '../../../components/ui/icon';
import { IconButton } from '../../../components/ui/icon-button';
import { useFilePreferences } from '../queries/file-preferences';
import { useSetFilePreference } from '../commands/file-preferences';
import { pinnedNavigationRows } from '../rules/file-navigation';
import { useOpenFileBeside } from '../commands/open-file';
import { FilePane } from './file-screen';
import { ListDetail } from '../../../components/ui/list-detail';
import type { DocumentAction } from '../../../components/ui/document-header';
import type { ListDetailMode } from '../../../shared/rules/list-detail';

export function FilesScreen({
  mode,
  workspace,
}: {
  mode: ListDetailMode;
  workspace?: string | undefined;
}) {
  return (
    <WorkspaceGate
      title="Files"
      expectedWorkspace={workspace}
      changed={
        <Empty
          title="Workspace changed"
          description="Another worktree is selected now. Open Files again from the worktree you want."
        />
      }
    >
      {(selected) => (
        <FilesNavigation key={selected.key} selected={selected} mode={mode} />
      )}
    </WorkspaceGate>
  );
}

function restoringSearchBar(query: string) {
  let bar: SearchBarCommands | null = null;
  return {
    get current() {
      return bar;
    },
    set current(next: SearchBarCommands | null) {
      bar = next;
      if (query) next?.setText(query);
    },
  };
}

type FilesNavigationProps = {
  selected: Workspace;
  mode: ListDetailMode;
};

function FilesNavigation(props: FilesNavigationProps) {
  const focused = useIsFocused();
  return focused ? (
    <FilesNavigationView key={props.selected.key} {...props} />
  ) : null;
}

function FilesNavigationView({ selected, mode }: FilesNavigationProps) {
  const search = mode === 'beside' ? 'content' : 'top-bar';
  const openBeside = useOpenFileBeside(selected.key);
  const review = useFileReview(selected, { kind: 'worktree' });
  const preferences = {
    read: useFilePreferences(selected.connection, selected.scope.projectId),
    write: useSetFilePreference(selected.connection, selected.scope.projectId),
  };
  const {
    expanded,
    setExpanded,
    requested,
    setRequested,
    reconcileDirectories,
    query,
    setQuery,
    showHidden,
    setShowHidden,
    scrollOffset,
    setScrollOffset,
    selectedPath,
    setSelectedPath,
  } = useFileNavigation(selected.key);
  const router = useRouter();
  const trash = useEditFile(selected.connection, selected.scope);
  const openAction = (action: FileAction) =>
    router.navigate({
      pathname: '/file-action',
      params: { workspace: selected.key, opened: mode, ...action },
    });
  const confirmTrash = (path: string) =>
    Alert.alert(
      'Move to trash?',
      `Move ${path} to the server's trash? This changes your worktree. You can restore it from the computer's system trash.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to trash',
          style: 'destructive',
          onPress: () =>
            trash.trash(path, (message) =>
              Alert.alert('Not moved to trash', message),
            ),
        },
      ],
    );
  const [refreshRequested, setRefreshRequested] = useState(false);
  const [searchBar] = useState(() => restoringSearchBar(query));
  const preferenceData = Option.getOrUndefined(
    AsyncResult.value(preferences.read.result),
  );
  const requestPaths = [
    ...new Set([
      ...requested,
      ...pinnedParentDirectories(preferenceData?.preferences ?? []),
    ]),
  ];
  const directories = useDirectories({
    connection: selected.connection,
    scope: selected.scope,
    paths: requestPaths,
  });
  const data = directories.results.flatMap((result) =>
    Option.toArray(AsyncResult.value(result)),
  );
  const confirmed = directories.results.flatMap((result) =>
    AsyncResult.isSuccess(result) && !result.waiting ? [result.value] : [],
  );
  const failure = directories.results.find(AsyncResult.isFailure);
  const loading = directoryLoading(
    Array.zip(requestPaths, directories.results).map(([path, result]) => ({
      path,
      result,
    })),
  );
  const pending = directories.results.some(
    (result) => AsyncResult.isInitial(result) || result.waiting,
  );
  const refreshing = refreshRequested && pending;
  if (refreshRequested && !pending) setRefreshRequested(false);
  const refresh = () => {
    setRefreshRequested(true);
    directories.refresh();
  };
  const paths = useFilePaths(selected.connection, selected.scope);
  const pathData = Option.getOrUndefined(AsyncResult.value(paths.result));
  const searching = Boolean(query.trim());
  const open = (path: string) => {
    if (mode === 'beside') {
      openBeside(path);
      return;
    }
    setSelectedPath(path);
    router.push({
      pathname: '/file',
      params: { path, workspace: selected.key },
    });
  };
  const create = {
    kind: 'choice',
    id: 'create',
    label: 'Create file or folder',
    icon: 'add',
    choices: [
      {
        label: 'New file',
        onPress: () =>
          openAction({ kind: 'create', entryKind: 'file', folder: '' }),
      },
      {
        label: 'New folder',
        onPress: () =>
          openAction({ kind: 'create', entryKind: 'directory', folder: '' }),
      },
    ],
  } as const satisfies DocumentAction;
  const nodes = mergeFileTreeEntries(data);
  const preferenceEntries = filePreferenceEntries({
    entries: nodes,
    paths: pathData?.paths ?? [],
    preferences: preferenceData?.preferences ?? [],
    showHidden,
    query,
  });
  const preferencesLoaded = preferenceData !== undefined;
  const candidate = quickOpenPath(query);
  const knownPath =
    preferencesLoaded &&
    candidate &&
    (showHidden || hiddenPathFor(candidate, preferenceEntries.hidden) === null)
      ? candidate
      : null;
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
      false,
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
            openAction({
              kind: 'create',
              entryKind: id === 'new-file' ? 'file' : 'directory',
              folder: path,
            });
            break;
          case 'open':
            open(path);
            break;
          case 'timeline':
            router.push({
              pathname: '/timeline',
              params: { path, workspace: selected.key },
            });
            break;
          case 'rename':
            openAction({ kind: 'move', path });
            break;
          case 'trash':
            confirmTrash(path);
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
  const collapseAll = (
    <IconButton
      icon="collapse"
      accessibilityLabel={
        searching ? 'Clear search and collapse all' : 'Collapse all'
      }
      onPress={() => {
        setQuery('');
        searchBar.current?.setText('');
        setExpanded(new Set());
      }}
    />
  );
  const header = (
    <Box gap={2} paddingY={2}>
      {search === 'content' ? (
        <Box className="flex-row items-center" gap={2}>
          <Box className="min-w-0 flex-1">
            <Input
              accessibilityLabel="Search files"
              placeholder="Search files"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => {
                if (knownPath) open(knownPath);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Box>
          {collapseAll}
        </Box>
      ) : null}
      {knownPath ? (
        <ButtonSurface
          variant="tonal"
          size="sm"
          accessibilityLabel={`Open path ${knownPath}`}
          onPress={() => open(knownPath)}
        >
          <Text variant="caption">Open {knownPath}</Text>
        </ButtonSurface>
      ) : null}
      <Box className="min-h-8 flex-row items-center" gap={2}>
        <Box className="min-w-0 flex-1">
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {selected.project.name} · {worktreeLabel(selected.worktree.branch)}
          </Text>
        </Box>
        {preferenceEntries.hidden.size > 0 ? (
          <ButtonSurface
            variant="plain"
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
        {search === 'top-bar' ? collapseAll : null}
      </Box>
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
    </Box>
  );
  const pins = pinnedFileEntries(
    preferenceEntries.pinnedPaths,
    requestPaths.map((path, index): PinnedDirectoryState => {
      const result = directories.results[index];
      const value = result
        ? Option.getOrUndefined(AsyncResult.value(result))
        : undefined;
      if (value) return { path, status: 'loaded', entries: value.entries };
      return {
        path,
        status:
          result && AsyncResult.isFailure(result) ? 'unavailable' : 'loading',
      };
    }),
  );
  const rows: FileTreeRow[] = [];
  if (preferencesLoaded && searching)
    rows.push(
      ...visibleEntries.map((entry) => ({ key: entry.path, entry, depth: 0 })),
    );
  else if (preferencesLoaded)
    rows.push(
      ...[
        ...(pins.length
          ? [
              {
                key: 'pinned',
                header: <GroupHeader label="Pinned" count={pins.length} />,
              },
              ...pinnedNavigationRows(pins, preferenceEntries.nodes, expanded),
            ]
          : []),
        {
          key: 'all',
          header: <GroupHeader label="All files" />,
        },
        ...(loading.rootLoaded && preferenceEntries.nodes.length === 0
          ? [
              {
                key: 'empty',
                header: (
                  <Empty
                    title="No files"
                    description="This directory is empty."
                    icon="folder"
                  />
                ),
              },
            ]
          : []),
        ...visibleFileTreeRows(preferenceEntries.nodes, expanded).map(
          (row) => ({ ...row, key: `all:${row.entry.path}` }),
        ),
      ],
    );
  const tree = (createInTopBar: boolean) => (
    <Box
      className="flex-1"
      surface="background"
      collapsable={false}
      ref={(view) => {
        if (view) reconcileDirectories(confirmed);
      }}
    >
      {search === 'top-bar' ? (
        <Stack.SearchBar
          ref={searchBar}
          placeholder="Search files"
          autoCapitalize="none"
          hideWhenScrolling={false}
          onChangeText={(event) => setQuery(event.nativeEvent.text)}
          onCancelButtonPress={() => setQuery('')}
          onSearchButtonPress={() => {
            if (knownPath) open(knownPath);
          }}
        />
      ) : null}
      {createInTopBar ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu
            icon={headerIcon(create.icon)}
            accessibilityLabel={create.label}
            title={create.label}
          >
            {create.choices.map((choice) => (
              <Stack.Toolbar.MenuAction
                key={choice.label}
                onPress={choice.onPress}
              >
                {choice.label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}
      <FileTree
        header={header}
        rows={rows}
        scrollOffset={scrollOffset}
        restoreReady={
          preferencesLoaded &&
          (searching ? pathData !== undefined : !pending && loading.rootLoaded)
        }
        onScrollOffset={setScrollOffset}
        flat={searching}
        loaded={
          preferencesLoaded &&
          (searching ? AsyncResult.isSuccess(paths.result) : loading.rootLoaded)
        }
        nodes={preferencesLoaded ? visibleEntries : []}
        annotations={review.labels}
        changes={review.changes}
        expanded={expanded}
        {...(selectedPath ? { selected: selectedPath } : {})}
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
            pins.some(
              (pin) => pin.path === path && pin.state === 'unavailable',
            ) ||
            nodes.some((node) => node.path === path && node.kind === 'file')
          )
            open(path);
        }}
        contextMenu={menuFor}
      />
    </Box>
  );
  if (mode === 'stack') return tree(true);
  return (
    <ListDetail
      list={(inner) => tree(inner === 'stack' || !selectedPath)}
      detail={
        selectedPath ? (
          <FilePane
            key={selectedPath}
            path={selectedPath}
            selected={selected}
            actions={[create]}
          />
        ) : (
          <Empty
            title="Select a file"
            description="Choose a file on the left to read it here."
          />
        )
      }
    />
  );
}

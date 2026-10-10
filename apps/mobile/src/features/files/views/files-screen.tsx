import { Empty } from '../../../components/ui/empty';
import { useSelectedWorktree } from '../../projects';
import { worktreeLabel } from '@porcelain/client/projects/rules';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  fileErrorMessage,
  quickOpenMatches,
  mergeFileTreeEntries,
  treeActions,
} from '@porcelain/client/files/rules';
import { FileTree } from '../../../components/ui/file-tree';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Loading } from '../../../components/ui/loading';
import { ErrorState } from '../../../components/ui/error-state';
import { Text } from '../../../components/ui/text';
import { directoryRequests } from '../../../shared/rules/file-tree';
import { useDirectories } from '../queries/directory';
import { useFilePaths } from '../queries/paths';
import { FileActionSheet } from './file-action';
import type { FileAction } from '../commands/edit-file';

export function FilesScreen({
  onOpen,
}: {
  onOpen: (path: string, workspace: string) => void;
}) {
  const selected = useSelectedWorktree();
  return selected ? (
    <WorktreeFiles key={selected.key} selected={selected} onOpen={onOpen} />
  ) : (
    <Empty description="Select a worktree to continue." title="Files" />
  );
}

function WorktreeFiles({
  selected,
  onOpen,
}: {
  selected: NonNullable<ReturnType<typeof useSelectedWorktree>>;
  onOpen: (path: string, workspace: string) => void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [requested, setRequested] = useState<readonly string[]>(['']);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState<FileAction>();
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
  const pending = directories.results.some(
    (result) => AsyncResult.isInitial(result) || result.waiting,
  );
  const paths = useFilePaths(selected.connection, selected.scope);
  const pathData = Option.getOrUndefined(AsyncResult.value(paths.result));
  const searching = Boolean(query.trim());
  const open = (path: string) => onOpen(path, selected.key);
  const nodes = mergeFileTreeEntries(data);
  const header = (
    <View className="gap-3 px-4 py-3">
      <Input
        accessibilityLabel="Search files"
        placeholder="Search files"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View className="flex-row gap-2">
        <Button
          label="New file"
          variant="outline"
          size="sm"
          onPress={() =>
            setAction({ kind: 'create', entryKind: 'file', folder: '' })
          }
        />
        <Button
          label="New folder"
          variant="outline"
          size="sm"
          onPress={() =>
            setAction({ kind: 'create', entryKind: 'directory', folder: '' })
          }
        />
      </View>
      <Text variant="caption" tone="muted">
        {selected.project.name} · {worktreeLabel(selected.worktree.branch)}
      </Text>
      {failure ? (
        <ErrorState
          message={fileErrorMessage(Cause.squash(failure.cause))}
          retry={{
            label: 'Read folders again',
            onPress: directories.refresh,
          }}
        />
      ) : null}
      {pending ? <Loading label="Reading files…" /> : null}
      {searching && AsyncResult.isFailure(paths.result) ? (
        <ErrorState
          message={fileErrorMessage(Cause.squash(paths.result.cause))}
          retry={{ label: 'Search again', onPress: paths.refresh }}
        />
      ) : null}
      {searching && !pathData ? <Loading label="Searching files…" /> : null}
    </View>
  );
  return (
    <View className="flex-1 bg-background" collapsable={false}>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          accessibilityLabel="Refresh files"
          onPress={directories.refresh}
        >
          Refresh
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <FileTree
        header={header}
        flat={searching}
        nodes={
          searching
            ? quickOpenMatches(pathData?.paths ?? [], query).map((path) => ({
                path,
                kind: 'file' as const,
              }))
            : nodes
        }
        expanded={expanded}
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
                return treeActions({
                  folder: node.kind === 'directory',
                  link: node.kind === 'symlink',
                  changed: false,
                  openable: node.kind === 'file',
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
        action={action}
        onClose={() => setAction(undefined)}
        onCreated={open}
      />
    </View>
  );
}

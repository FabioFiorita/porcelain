import { useState, type ReactNode } from 'react';
import { useResolveClassNames } from 'uniwind';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { Item, type ItemProps } from './item';
import { ItemMenu } from './item-menu';
import type { ItemMenuProps } from './item-menu-props';
import { FileIcon } from './file-icon';
import { Icon } from './icon';
import { Badge } from './badge';
import { Empty } from './empty';
import { ChangeMark } from './change-mark';

import {
  changeStatusMarks,
  entryName,
  fileTreeAncestors,
  visibleFileTreeRows,
  type FileChangeMarks,
  type FileTreeEntry,
} from '@porcelain/client/files/rules';
import { isNativeImagePath } from '../../shared/rules/file-tree';

export type FileTreeRow =
  | { key: string; header: ReactNode }
  | {
      key: string;
      entry: FileTreeEntry;
      depth: number;
      pinned?: boolean;
      availability?: 'loading' | 'missing' | 'unavailable' | undefined;
    };

export function FileTree({
  nodes,
  expanded,
  selected,
  loading,
  onToggle,
  onSelect,
  contextMenu,
  header,
  rows,
  scrollOffset,
  onScrollOffset,
  loaded,
  restoreReady = loaded,
  flat = false,
  annotations,
  changes,
}: {
  nodes: readonly FileTreeEntry[];
  rows?: readonly FileTreeRow[];
  scrollOffset?: number | undefined;
  onScrollOffset?: ((offset: number) => void) | undefined;
  expanded: ReadonlySet<string>;
  selected?: string | undefined;
  loading?: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  header?: ReactNode;
  loaded: boolean;
  restoreReady?: boolean;
  flat?: boolean;
  annotations?: ReadonlyMap<string, string>;
  changes?: FileChangeMarks | undefined;
  contextMenu?: ((node: FileTreeEntry) => ItemMenuProps['actions']) | undefined;
}) {
  const padding = useResolveClassNames('px-2');
  const [initialOffset] = useState(scrollOffset ?? 0);
  const [restored, setRestored] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  return (
    <FlatList<FileTreeRow>
      ref={(list) => {
        if (!list || !restoreReady || restored || contentHeight === 0) return;
        list.scrollToOffset({ offset: initialOffset, animated: false });
        setRestored(true);
      }}
      onContentSizeChange={(_, height) => {
        if (!restored) setContentHeight(height);
      }}
      contentInsetAdjustmentBehavior="automatic"
      onScroll={
        onScrollOffset
          ? (event) => {
              if (restored) onScrollOffset(event.nativeEvent.contentOffset.y);
            }
          : undefined
      }
      scrollEventThrottle={100}
      ListHeaderComponent={<>{header}</>}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={false}
      contentContainerStyle={padding}
      data={
        rows ??
        (flat
          ? nodes.map((entry) => ({ key: entry.path, entry, depth: 0 }))
          : visibleFileTreeRows(nodes, expanded).map((row) => ({
              ...row,
              key: row.entry.path,
            })))
      }
      keyExtractor={(row) => row.key}
      ItemSeparatorComponent={() => <View className="h-1" />}
      ListEmptyComponent={
        loaded ? (
          <Empty
            title="No files"
            description={
              flat ? 'No files match this view.' : 'This directory is empty.'
            }
            icon="folder"
          />
        ) : undefined
      }
      renderItem={({ item }) =>
        'header' in item ? (
          <>{item.header}</>
        ) : (
          <FileTreeItem
            node={item.entry}
            depth={item.depth}
            pinned={item.pinned}
            availability={item.availability}
            expanded={expanded}
            selected={selected}
            loading={loading}
            onToggle={onToggle}
            onSelect={onSelect}
            contextMenu={contextMenu}
            showParent={flat || item.pinned === true}
            annotations={annotations}
            changes={changes}
          />
        )
      }
    />
  );
}

function FileTreeItem({
  node,
  depth,
  expanded,
  selected,
  loading,
  onToggle,
  onSelect,
  contextMenu,
  showParent = false,
  pinned = false,
  availability,
  annotations,
  changes,
}: {
  node: FileTreeEntry;
  depth: number;
  expanded: ReadonlySet<string>;
  selected?: string | undefined;
  loading?: ReadonlySet<string> | undefined;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  contextMenu?: ((node: FileTreeEntry) => ItemMenuProps['actions']) | undefined;
  showParent?: boolean;
  pinned?: boolean | undefined;
  availability?: 'loading' | 'missing' | 'unavailable' | undefined;
  annotations?: ReadonlyMap<string, string> | undefined;
  changes?: FileChangeMarks | undefined;
}) {
  const indent = useResolveClassNames('pl-4');
  const path = node.path.replace(/\/$/, '');
  const busy = node.kind === 'directory' && Boolean(loading?.has(path));
  const annotation =
    node.kind === 'directory' ? undefined : annotations?.get(path);
  const status =
    node.kind === 'directory' ? undefined : changes?.files.get(path);
  const mark = status ? changeStatusMarks[status] : undefined;
  const containsChanges =
    node.kind === 'directory' && Boolean(changes?.folders.has(path));
  const parent = showParent ? fileTreeAncestors(path).at(-1) : undefined;
  const item: ItemProps = {
    title: entryName(node.path),
    ...(availability
      ? {
          detail:
            availability === 'loading'
              ? 'Reading pinned entry…'
              : availability === 'missing'
                ? 'Pinned entry is missing'
                : 'Pinned entry is unavailable. Open as file.',
        }
      : parent
        ? { detail: parent }
        : {}),
    titleNumberOfLines: 1,
    size: 'sm',
    selected: path === selected,
    accessibilityLabel: [
      availability === 'unavailable'
        ? `Open pinned path ${path} as file`
        : availability
          ? `Pinned entry ${path}`
          : `${node.kind === 'directory' ? (expanded.has(path) ? 'Collapse' : 'Expand') : 'Open'} ${pinned ? `pinned ${node.kind === 'directory' ? 'folder' : 'file'} ` : ''}${path}`,
      busy ? 'loading' : undefined,
      availability,
      mark?.label,
      containsChanges ? 'contains changes' : undefined,
      annotation,
    ]
      .filter(Boolean)
      .join(', '),
    leading: (
      <View
        className="flex-row items-center gap-2"
        style={{ paddingLeft: depth * Number(indent.paddingLeft) }}
      >
        {node.kind === 'directory' ? (
          <FolderIndicator expanded={expanded.has(path)} loading={busy} />
        ) : null}
        <FileIcon
          kind={
            node.kind === 'directory' && expanded.has(path)
              ? 'openFolder'
              : node.kind === 'directory'
                ? 'folder'
                : isNativeImagePath(node.path)
                  ? 'image'
                  : 'file'
          }
        />
      </View>
    ),
    trailing:
      node.kind === 'symlink' ||
      node.kind === 'submodule' ||
      (node.kind === 'other' && !availability) ||
      node.ignored ||
      mark ||
      containsChanges ? (
        <View className="flex-row items-center gap-2">
          {node.kind === 'symlink' ||
          node.kind === 'submodule' ||
          (node.kind === 'other' && !availability) ||
          node.ignored ? (
            <Badge
              label={
                node.kind === 'symlink'
                  ? 'Symlink'
                  : node.kind === 'submodule'
                    ? 'Submodule'
                    : node.kind === 'other'
                      ? 'Unsupported'
                      : 'Ignored'
              }
              variant="outline"
            />
          ) : null}
          {mark || containsChanges ? (
            <ChangeMark letter={mark?.letter} />
          ) : null}
        </View>
      ) : undefined,
    onPress: () =>
      availability === 'unavailable'
        ? onSelect(path)
        : availability
          ? undefined
          : node.kind === 'directory'
            ? onToggle(path)
            : node.kind === 'file'
              ? onSelect(path)
              : undefined,
  };
  return (
    <>
      {contextMenu ? (
        <ItemMenu {...item} actions={contextMenu(node)} />
      ) : (
        <Item {...item} />
      )}
    </>
  );
}

function FolderIndicator({
  expanded,
  loading,
}: {
  expanded: boolean;
  loading: boolean;
}) {
  return (
    <View className="size-3.5 items-center justify-center">
      {loading ? (
        <ActivityIndicator
          accessible={false}
          size="small"
          style={{ transform: [{ scale: 0.7 }] }}
          colorClassName="accent-foreground"
        />
      ) : (
        <Icon name={expanded ? 'down' : 'chevron'} size="small" />
      )}
    </View>
  );
}

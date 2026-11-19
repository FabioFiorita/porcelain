import { type ReactNode } from 'react';
import { useListReadingOffset } from './list-reading-offset';
import { useListReveal } from './list-reveal';
import { useResolveClassNames } from 'uniwind';
import { FlatList, View } from 'react-native';
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
import type { CursorRow } from '../../shared/rules/list-cursor';

export type FileTreeRow =
  | { key: string; header: ReactNode }
  | {
      key: string;
      entry: FileTreeEntry;
      depth: number;
      pinned?: boolean;
      availability?: 'loading' | 'missing' | 'unavailable' | undefined;
    };

export function fileTreeCursorRows(
  rows: readonly FileTreeRow[],
  expanded: ReadonlySet<string>,
): (CursorRow & { path: string; directory: boolean })[] {
  return rows.flatMap((row) => {
    if (
      'header' in row ||
      row.availability === 'loading' ||
      row.availability === 'missing'
    )
      return [];
    const path = row.entry.path.replace(/\/$/, '');
    const directory = !row.availability && row.entry.kind === 'directory';
    return [
      {
        key: row.key,
        path,
        directory,
        depth: row.depth,
        folder: directory
          ? expanded.has(path)
            ? 'open'
            : 'closed'
          : undefined,
      },
    ];
  });
}

export function FileTree({
  nodes,
  expanded,
  selected,
  highlighted,
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
  highlighted?: string | undefined;
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
  const reading = useListReadingOffset(
    scrollOffset ?? 0,
    restoreReady,
    onScrollOffset,
  );
  const reveal = useListReveal();
  const data =
    rows ??
    (flat
      ? nodes.map((entry) => ({ key: entry.path, entry, depth: 0 }))
      : visibleFileTreeRows(nodes, expanded).map((row) => ({
          ...row,
          key: row.entry.path,
        })));
  const highlightedIndex = data.findIndex((row) => row.key === highlighted);
  return (
    <FlatList<FileTreeRow>
      {...reading}
      {...reveal.props}
      ref={(list) => {
        reading.ref(list);
        reveal.attach(list, highlightedIndex);
      }}
      contentInsetAdjustmentBehavior="automatic"
      ListHeaderComponent={<>{header}</>}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={false}
      contentContainerStyle={padding}
      data={data}
      keyExtractor={(row) => row.key}
      ItemSeparatorComponent={() => <View className="h-1" />}
      ListEmptyComponent={
        loaded ? (
          <Empty title={flat ? 'No files match this view.' : 'No files'} />
        ) : undefined
      }
      renderItem={({ item }) =>
        'header' in item ? (
          <>{item.header}</>
        ) : (
          <FileTreeItem
            node={item.entry}
            depth={item.depth}
            highlighted={item.key === highlighted}
            pinned={item.pinned}
            availability={item.availability}
            expanded={expanded}
            selected={selected}
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
  highlighted,
  expanded,
  selected,
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
  highlighted: boolean;
  expanded: ReadonlySet<string>;
  selected?: string | undefined;
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
    ...(availability === 'missing'
      ? { detail: 'Pinned entry is missing' }
      : availability === 'unavailable'
        ? { detail: 'Pinned entry is unavailable. Open as file.' }
        : parent
          ? { detail: parent }
          : {}),
    titleNumberOfLines: 1,
    selected: path === selected,
    highlighted,
    accessibilityLabel: [
      availability === 'unavailable'
        ? `Open pinned path ${path} as file`
        : availability
          ? `Pinned entry ${path}`
          : `${node.kind === 'directory' ? (expanded.has(path) ? 'Collapse' : 'Expand') : 'Open'} ${pinned ? `pinned ${node.kind === 'directory' ? 'folder' : 'file'} ` : ''}${path}`,
      availability === 'loading' ? undefined : availability,
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
          <View className="size-3.5 items-center justify-center">
            <Icon name={expanded.has(path) ? 'down' : 'chevron'} size="small" />
          </View>
        ) : null}
        <FileIcon
          path={node.path}
          kind={
            node.kind === 'directory' && expanded.has(path)
              ? 'openFolder'
              : node.kind === 'directory'
                ? 'folder'
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

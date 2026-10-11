import type { ReactNode } from 'react';
import { useResolveClassNames } from 'uniwind';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { Item, type ItemProps } from './item';
import { ItemMenu } from './item-menu';
import type { ItemMenuProps } from './item-menu-props';
import { FileIcon } from './file-icon';
import { Icon } from './icon';
import { Badge } from './badge';
import { Empty } from './empty';

import {
  entryName,
  visibleFileTreeRows,
  type FileTreeEntry,
} from '@porcelain/client/files/rules';
import { isNativeImagePath } from '../../shared/rules/file-tree';

export function FileTree({
  nodes,
  expanded,
  selected,
  loading,
  onToggle,
  onSelect,
  contextMenu,
  header,
  loaded,
  flat = false,
}: {
  nodes: readonly FileTreeEntry[];
  expanded: ReadonlySet<string>;
  selected?: string;
  loading?: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  header?: ReactNode;
  loaded: boolean;
  flat?: boolean;
  contextMenu?: ((node: FileTreeEntry) => ItemMenuProps['actions']) | undefined;
}) {
  const padding = useResolveClassNames('px-2');
  const indent = useResolveClassNames('pl-4');
  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      ListHeaderComponent={<>{header}</>}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={padding}
      data={
        flat
          ? nodes.map((entry) => ({ entry, depth: 0 }))
          : visibleFileTreeRows(nodes, expanded)
      }
      keyExtractor={({ entry }) => entry.path}
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
      renderItem={({ item: { entry: node, depth } }) => {
        const path = node.path.replace(/\/$/, '');
        const busy = node.kind === 'directory' && Boolean(loading?.has(path));
        const item: ItemProps = {
          title: flat ? node.path : entryName(node.path),
          size: 'sm',
          selected: path === selected,
          accessibilityLabel: `${node.kind === 'directory' ? (expanded.has(path) ? 'Collapse' : 'Expand') : 'Open'} ${entryName(node.path)}${busy ? ', loading' : ''}`,
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
            node.kind === 'other' ||
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
            ) : undefined,
          onPress: () =>
            node.kind === 'directory' ? onToggle(path) : onSelect(path),
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
      }}
    />
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

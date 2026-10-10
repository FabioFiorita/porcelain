import type { ReactNode } from 'react';
import { useResolveClassNames } from 'uniwind';
import { FlatList, View } from 'react-native';
import { Item, type ItemProps } from './item';
import { ItemMenu } from './item-menu';
import type { ItemMenuProps } from './item-menu-props';
import { FileIcon } from './file-icon';
import { Icon } from './icon';
import { Badge } from './badge';
import { Empty } from './empty';

import {
  entryName,
  fileTreeAncestors,
  type FileTreeEntry,
} from '@porcelain/client/files/rules';
type Row = { node: FileTreeEntry; depth: number };
function visibleRows(
  nodes: readonly FileTreeEntry[],
  expanded: ReadonlySet<string>,
): Row[] {
  return nodes
    .filter((node) =>
      fileTreeAncestors(node.path).every((ancestor) => expanded.has(ancestor)),
    )
    .sort((left, right) => {
      const leftParts = left.path.replace(/\/$/, '').split('/');
      const rightParts = right.path.replace(/\/$/, '').split('/');
      for (
        let index = 0;
        index < Math.min(leftParts.length, rightParts.length);
        index += 1
      ) {
        if (leftParts[index] === rightParts[index]) continue;
        const leftFolder =
          index < leftParts.length - 1 || left.kind === 'directory';
        const rightFolder =
          index < rightParts.length - 1 || right.kind === 'directory';
        return (
          Number(rightFolder) - Number(leftFolder) ||
          (leftParts[index] ?? '').localeCompare(rightParts[index] ?? '')
        );
      }
      return leftParts.length - rightParts.length;
    })
    .map((node) => ({ node, depth: fileTreeAncestors(node.path).length }));
}
export function FileTree({
  nodes,
  expanded,
  selected,
  onToggle,
  onSelect,
  contextMenu,
  header,
  flat = false,
}: {
  nodes: readonly FileTreeEntry[];
  expanded: ReadonlySet<string>;
  selected?: string;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  header?: ReactNode;
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
          ? nodes.map((node) => ({ node, depth: 0 }))
          : visibleRows(nodes, expanded)
      }
      keyExtractor={({ node }) => node.path}
      ItemSeparatorComponent={() => <View className="h-1" />}
      ListEmptyComponent={
        <Empty
          title="No files"
          description="No files match this view."
          icon="folder"
        />
      }
      renderItem={({ item: { node, depth } }) => {
        const item: ItemProps = {
          title: flat ? node.path : entryName(node.path),
          size: 'sm',
          selected: node.path.replace(/\/$/, '') === selected,
          accessibilityLabel: `${node.kind === 'directory' ? (expanded.has(node.path.replace(/\/$/, '')) ? 'Collapse' : 'Expand') : 'Open'} ${entryName(node.path)}`,
          leading: (
            <View
              className="flex-row items-center gap-2"
              style={{ paddingLeft: depth * Number(indent.paddingLeft) }}
            >
              {node.kind === 'directory' ? (
                <Icon
                  name={
                    expanded.has(node.path.replace(/\/$/, ''))
                      ? 'down'
                      : 'chevron'
                  }
                  size="small"
                />
              ) : null}
              <FileIcon
                kind={
                  node.kind === 'directory' &&
                  expanded.has(node.path.replace(/\/$/, ''))
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
            node.kind === 'directory'
              ? onToggle(node.path.replace(/\/$/, ''))
              : onSelect(node.path.replace(/\/$/, '')),
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

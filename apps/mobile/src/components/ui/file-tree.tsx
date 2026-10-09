import { useResolveClassNames } from 'uniwind';
import { FlatList, View } from 'react-native';
import { Item, type ItemProps } from './item';
import { ItemMenu } from './item-menu';
import type { ItemMenuProps } from './item-menu-props';
import { FileIcon } from './file-icon';
import { Icon } from './icon';
import { Badge } from './badge';
import { Empty } from './empty';

export type FileTreeNode = {
  id: string;
  name: string;
  kind: 'file' | 'folder' | 'code' | 'image';
  status?: string;
  children?: readonly FileTreeNode[];
};
type Row = { node: FileTreeNode; depth: number };
function visibleRows(
  nodes: readonly FileTreeNode[],
  expanded: ReadonlySet<string>,
  depth = 0,
): Row[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...(node.kind === 'folder' && expanded.has(node.id)
      ? visibleRows(node.children ?? [], expanded, depth + 1)
      : []),
  ]);
}
export function FileTree({
  nodes,
  expanded,
  selected,
  onToggle,
  onSelect,
  contextMenu,
}: {
  nodes: readonly FileTreeNode[];
  expanded: ReadonlySet<string>;
  selected?: string;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  contextMenu?: (node: FileTreeNode) => ItemMenuProps['actions'];
}) {
  const padding = useResolveClassNames('px-2');
  const indent = useResolveClassNames('pl-4');
  return (
    <FlatList
      contentContainerStyle={padding}
      data={visibleRows(nodes, expanded)}
      keyExtractor={({ node }) => node.id}
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
          title: node.name,
          size: 'sm',
          selected: node.id === selected,
          accessibilityLabel: `${node.kind === 'folder' ? (expanded.has(node.id) ? 'Collapse' : 'Expand') : 'Open'} ${node.name}`,
          leading: (
            <View
              className="flex-row items-center gap-2"
              style={{ paddingLeft: depth * Number(indent.paddingLeft) }}
            >
              {node.kind === 'folder' ? (
                <Icon
                  name={expanded.has(node.id) ? 'down' : 'chevron'}
                  size="small"
                />
              ) : null}
              <FileIcon
                kind={
                  node.kind === 'folder' && expanded.has(node.id)
                    ? 'openFolder'
                    : node.kind
                }
              />
            </View>
          ),
          trailing: node.status ? (
            <Badge label={node.status} variant="outline" />
          ) : undefined,
          onPress: () =>
            node.kind === 'folder' ? onToggle(node.id) : onSelect(node.id),
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

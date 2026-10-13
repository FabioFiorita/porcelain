import type { ReactNode } from 'react';
import { FlatList } from 'react-native';
import { Box } from '../../../components/ui/box';
import { Empty } from '../../../components/ui/empty';
import { Loading } from '../../../components/ui/loading';
import { Text } from '../../../components/ui/text';
import { Badge } from '../../../components/ui/badge';
import { Item } from '../../../components/ui/item';
import { useCommit, type HistorySelection } from '../queries/history';
import {
  commitPath,
  refLabel,
  shortOid,
} from '@porcelain/client/history/rules';
import { CommitReadState } from './commit-state';
import { CommitParentMenu } from './commit-parent-menu';

export function CommitContent({
  selection,
  oid,
  parent,
  onParentChange,
  onOpenFile,
  renderParentMenu,
}: {
  selection: HistorySelection;
  oid: string;
  parent: number;
  onParentChange: (parent: number) => void;
  onOpenFile: (path: string) => void;
  renderParentMenu?: (parentOids: readonly string[]) => ReactNode;
}) {
  const commit = useCommit(selection, oid, parent);
  return (
    <CommitReadState commit={commit}>
      {(value) => (
        <Box collapsable={false} className="flex-1" surface="background">
          {value.commit.parentOids.length > 1 && renderParentMenu
            ? renderParentMenu(value.commit.parentOids)
            : null}
          <FlatList
            contentInsetAdjustmentBehavior="automatic"
            data={value.files}
            keyExtractor={(file) =>
              `${file.oldPath ?? ''}\0${file.newPath ?? ''}`
            }
            ListHeaderComponent={
              <Box gap={3} divider="bottom" padding={4}>
                <Text variant="heading" selectable>
                  {value.commit.subject}
                </Text>
                {value.commit.body ? (
                  <Text variant="ui" tone="muted" selectable>
                    {value.commit.body}
                  </Text>
                ) : null}
                {value.commit.subjectTruncated || value.commit.bodyTruncated ? (
                  <Text variant="caption" tone="muted">
                    Commit message truncated
                  </Text>
                ) : null}
                <Text variant="caption" tone="muted">
                  {value.commit.author.name} ·{' '}
                  {new Date(value.commit.author.timestamp).toLocaleString()}
                </Text>
                <Text variant="code" tone="muted" selectable>
                  {oid}
                </Text>
                <Text variant="caption" tone="muted">
                  {value.comparison.kind === 'parent'
                    ? `Against ${shortOid(value.comparison.baseOid)} · Parent ${value.comparison.parentNumber}`
                    : 'Root commit'}
                </Text>
                {value.commit.parentOids.length > 1 && !renderParentMenu ? (
                  <CommitParentMenu
                    parentOids={value.commit.parentOids}
                    parent={parent}
                    onSelect={onParentChange}
                  />
                ) : null}
                <Box className="flex-row flex-wrap" gap={1}>
                  {value.commit.refs.map((ref) => (
                    <Badge
                      key={ref}
                      label={refLabel(ref)}
                      variant="secondary"
                    />
                  ))}
                </Box>
                <Text
                  variant="ui"
                  weight="medium"
                >{`${value.files.length} file${value.files.length === 1 ? '' : 's'} changed`}</Text>
                {commit.result.waiting ? (
                  <Loading label="Loading comparison…" />
                ) : null}
              </Box>
            }
            ListEmptyComponent={
              <Empty
                title="No changed files"
                description="This commit has no file changes against this comparison."
              />
            }
            renderItem={({ item }) => (
              <Item
                title={commitPath(item)}
                description={`${item.status}${item.status === 'renamed' ? ` from ${item.oldPath}` : ''}`}
                disabled={commit.result.waiting}
                onPress={() => onOpenFile(commitPath(item))}
              />
            )}
          />
        </Box>
      )}
    </CommitReadState>
  );
}

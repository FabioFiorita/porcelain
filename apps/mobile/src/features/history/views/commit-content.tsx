import { FlatList } from 'react-native';
import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react';
import { historyPlace, focusCommitFile } from '@porcelain/client/history';
import { useListReadingOffset } from '../../../components/ui/list-reading-offset';
import { Box } from '../../../components/ui/box';
import { Empty } from '../../../components/ui/empty';
import { Loading } from '../../../components/ui/loading';
import { Text } from '../../../components/ui/text';
import { Badge } from '../../../components/ui/badge';
import { Item } from '../../../components/ui/item';
import { useCommit, type HistorySelection } from '../queries/history';
import {
  commitPath,
  commitPaths,
  shortOid,
} from '@porcelain/client/history/rules';
import { CommitReadState } from './commit-state';
import { CommitParentMenu } from './commit-parent-menu';
import { commitRefLabel } from '../../../shared/rules/commit-ref';

type CommitContentProps = {
  selection: HistorySelection;
  oid: string;
  parent: number;
  onParentChange: (parent: number) => void;
  onOpenFile: (path: string) => void;
  selectedPath?: string | undefined;
};

export function CommitContent(props: CommitContentProps) {
  const resetId = useAtomValue(
    historyPlace({
      ...props.selection,
      kind: 'commit',
      oid: props.oid,
      parent: props.parent,
    }),
    (place) => place.resetId,
  );
  return <CommitContentView key={resetId} {...props} />;
}

function CommitContentView({
  selection,
  oid,
  parent,
  onParentChange,
  onOpenFile,
  selectedPath,
}: CommitContentProps) {
  const commit = useCommit(selection, oid, parent);
  const [place, setPlace] = useAtom(
    historyPlace({ ...selection, kind: 'commit', oid, parent }),
  );
  const focusedPath = place.selected ?? selectedPath;
  const focusFile = useAtomSet(focusCommitFile(selection));
  const reading = useListReadingOffset(
    place.scrollOffset,
    !commit.result.waiting,
    (scrollOffset) => setPlace((current) => ({ ...current, scrollOffset })),
  );
  return (
    <CommitReadState commit={commit}>
      {(value) => (
        <Box collapsable={false} className="flex-1" surface="background">
          <FlatList
            {...reading}
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
                {value.commit.parentOids.length > 1 ? (
                  <CommitParentMenu
                    parentOids={value.commit.parentOids}
                    parent={parent}
                    onSelect={(nextParent) => {
                      if (nextParent === parent) return;
                      if (focusedPath !== undefined)
                        focusFile({
                          oid,
                          parent: nextParent,
                          path: focusedPath,
                        });
                      onParentChange(nextParent);
                    }}
                  />
                ) : null}
                <Box className="flex-row flex-wrap" gap={1}>
                  {value.commit.refs.map((ref) => (
                    <Badge
                      key={`${ref.kind}:${ref.name}`}
                      label={commitRefLabel(ref)}
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
                selected={
                  focusedPath !== undefined &&
                  commitPaths(item).includes(focusedPath)
                }
                description={`${item.status}${item.status === 'renamed' ? ` from ${item.oldPath}` : ''}`}
                disabled={commit.result.waiting}
                onPress={() => {
                  const path = commitPath(item);
                  setPlace((current) => ({ ...current, selected: path }));
                  onOpenFile(path);
                }}
              />
            )}
          />
        </Box>
      )}
    </CommitReadState>
  );
}

import { CommitState } from './commit-state';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { AsyncResult } from 'effect/reactivity';
import { Empty } from '../../../components/ui/empty';

import { Loading } from '../../../components/ui/loading';
import { Text } from '../../../components/ui/text';
import { Badge } from '../../../components/ui/badge';
import { Item } from '../../../components/ui/item';
import { useSelectedWorktree } from '../../projects';
import { useCommit, type HistorySelection } from '../queries/history';
import {
  commitPath,
  refLabel,
  shortOid,
} from '@porcelain/client/history/rules';

export function CommitScreen() {
  const { oid, workspace } = useLocalSearchParams<{
    oid: string;
    workspace?: string;
  }>();
  const current = useSelectedWorktree();
  return current && (!workspace || current.key === workspace) ? (
    <CommitDetail
      key={`${current.key}:${oid}`}
      selection={current}
      workspace={current.key}
      oid={oid}
    />
  ) : (
    <Empty
      title="Workspace changed"
      description="Return to History to open a commit in the selected worktree."
    />
  );
}

function CommitDetail({
  selection,
  workspace,
  oid,
}: {
  selection: HistorySelection;
  workspace: string;
  oid: string;
}) {
  const [parent, setParent] = useState(1);
  const commit = useCommit(selection, oid, parent);
  const router = useRouter();
  if (AsyncResult.isFailure(commit.result) || !commit.value)
    return (
      <CommitState
        failed={AsyncResult.isFailure(commit.result)}
        retry={commit.retry}
      />
    );

  const value = commit.value;
  return (
    <View collapsable={false} className="flex-1 bg-background">
      <Stack.Screen options={{ title: shortOid(oid) }} />
      {value.commit.parentOids.length > 1 ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu title="Compare parent">
            {value.commit.parentOids.map((parentOid, index) => (
              <Stack.Toolbar.MenuAction
                key={parentOid}
                isOn={parent === index + 1}
                onPress={() => setParent(index + 1)}
              >{`Parent ${index + 1} · ${shortOid(parentOid)}`}</Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={value.files}
        keyExtractor={(file) => `${file.oldPath ?? ''}\0${file.newPath ?? ''}`}
        ListHeaderComponent={
          <View className="gap-3 border-b border-border p-4">
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
            <View className="flex-row flex-wrap gap-1">
              {value.commit.refs.map((ref) => (
                <Badge key={ref} label={refLabel(ref)} variant="secondary" />
              ))}
            </View>
            <Text
              variant="ui"
              weight="medium"
            >{`${value.files.length} file${value.files.length === 1 ? '' : 's'} changed`}</Text>
            {commit.result.waiting ? (
              <Loading label="Loading comparison…" />
            ) : null}
          </View>
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
            onPress={() =>
              router.push({
                pathname: '/history/commit/[oid]/diff',
                params: {
                  oid,
                  workspace,
                  parent: String(parent),
                  path: commitPath(item),
                },
              })
            }
          />
        )}
      />
    </View>
  );
}

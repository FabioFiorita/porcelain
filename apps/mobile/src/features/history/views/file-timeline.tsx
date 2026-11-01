import { useAtom, useAtomSet } from '@effect/atom-react';
import { historyPlace, focusCommitFile } from '@porcelain/client/history';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { AsyncResult } from 'effect/reactivity';
import { commitEntry, timelineChange } from '@porcelain/client/history/rules';
import { Box } from '../../../components/ui/box';
import { Empty } from '../../../components/ui/empty';
import { HistoryList } from '../../../components/ui/history-list';
import { Text } from '../../../components/ui/text';
import { WorkspaceGate } from '../../projects';
import { useFileTimeline, type HistorySelection } from '../queries/history';
import { commitAge } from '../rules/commit-age';
import { HistoryFooter } from './history-navigation';

export function FileTimelineContent({
  selection,
  path,
  onOpen,
}: {
  selection: HistorySelection;
  path: string;
  onOpen: (oid: string, path: string) => void;
}) {
  const timeline = useFileTimeline(selection, path);
  const focusFile = useAtomSet(focusCommitFile(selection));
  const [place, setPlace] = useAtom(
    historyPlace({ ...selection, kind: 'file', path }),
  );
  const value = timeline.value;
  const failed = AsyncResult.isFailure(timeline.result);
  return (
    <Box className="flex-1" surface="background">
      <HistoryList
        key={place.resetId}
        {...(place.selected === undefined ? {} : { selected: place.selected })}
        scrollOffset={place.scrollOffset}
        onScrollOffset={(scrollOffset) =>
          setPlace((current) => ({ ...current, scrollOffset }))
        }
        header={
          <Box padding={4} gap={2} divider="bottom">
            <Text variant="code" selectable>
              {path}
            </Text>
            <Text variant="caption" tone="muted">
              Commits that changed this file
            </Text>
            {value?.restarted ? (
              <Text variant="caption" tone="muted">
                History changed. Showing it from the top.
              </Text>
            ) : null}
          </Box>
        }
        entries={
          value?.commits.map((entry) => ({
            ...commitEntry(entry.commit),
            time: commitAge(entry.commit.author.timestamp),
            change: timelineChange(entry, path),
          })) ?? []
        }
        loading={timeline.result.waiting || (!value && !failed)}
        unavailable={failed}
        hasMore={Boolean(value?.nextAfter) && !failed}
        onLoadMore={timeline.readMore}
        onSelect={(oid) => {
          const entry = value?.commits.find(
            (candidate) => candidate.commit.oid === oid,
          );
          if (entry) {
            setPlace((current) => ({ ...current, selected: oid }));
            focusFile({ oid, parent: 1, path: entry.path });
            onOpen(oid, entry.path);
          }
        }}
        empty={
          <Empty
            title="No commits touch this file"
            description="Its timeline starts with the first commit that includes it."
          />
        }
        footer={
          <HistoryFooter
            history={timeline}
            startLabel="Start of this file’s history."
          />
        }
      />
    </Box>
  );
}

export function FileTimelineScreen() {
  const { path = '', workspace = '' } = useLocalSearchParams<{
    path?: string;
    workspace?: string;
  }>();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: 'Timeline' }} />
      <WorkspaceGate
        title="Timeline"
        expectedWorkspace={workspace}
        changed={
          <Empty
            title="Workspace changed"
            description="Return to Files and choose a timeline in the selected worktree."
          />
        }
      >
        {(current) => (
          <FileTimelineContent
            key={`${current.key}:${path}`}
            selection={current}
            path={path}
            onOpen={(oid, historicalPath) =>
              router.push({
                pathname: '/timeline-commit',
                params: { oid, path: historicalPath, workspace: current.key },
              })
            }
          />
        )}
      </WorkspaceGate>
    </>
  );
}

import { Stack, useIsFocused, useRouter } from 'expo-router';
import { Box } from '../../../components/ui/box';
import { headerIcon } from '../../../shared/icons/header-icon';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { ListDetail } from '../../../components/ui/list-detail';
import { Loading } from '../../../components/ui/loading';
import { AsyncResult } from 'effect/reactivity';
import { WorkspaceGate, type Workspace } from '../../projects/index';
import { useWalkthrough } from '../queries/walkthrough';
import { WalkthroughPage } from './walkthrough-page';
import { WalkthroughSteps } from './walkthrough-steps';

function ChangesButton({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const focused = useIsFocused();
  if (!focused) return null;
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        icon={headerIcon('comparison')}
        accessibilityLabel="Changes"
        onPress={() =>
          router.push({
            pathname: '/worktree-changes',
            params: { workspace: workspace.key },
          })
        }
      />
    </Stack.Toolbar>
  );
}

export function WalkthroughSection() {
  return (
    <WorkspaceGate
      title="Walkthrough"
      frame="pane"
      changed={
        <Empty
          title="Workspace changed"
          description="Another worktree is selected now. Open the walkthrough again from the worktree you want."
        />
      }
    >
      {(workspace) => (
        <>
          <ChangesButton workspace={workspace} />
          <WalkthroughReader key={workspace.key} workspace={workspace} />
        </>
      )}
    </WorkspaceGate>
  );
}

function WalkthroughReader({ workspace }: { workspace: Workspace }) {
  const { result, phase, refresh } = useWalkthrough(workspace);
  if (!phase)
    return AsyncResult.isFailure(result) ? (
      <Box padding={4}>
        <ErrorState
          message="The walkthrough could not be read."
          retry={{ label: 'Try again', onPress: refresh }}
        />
      </Box>
    ) : (
      <Loading label="Loading walkthrough…" />
    );
  const page = <WalkthroughPage workspace={workspace} phase={phase} />;
  if (phase.kind !== 'ready' || phase.content.stops.length === 0) return page;
  return (
    <ListDetail
      collapse="detail"
      list={() => (
        <WalkthroughSteps workspace={workspace} content={phase.content} />
      )}
      detail={page}
    />
  );
}

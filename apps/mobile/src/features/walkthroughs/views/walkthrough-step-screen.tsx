import { useRouter } from 'expo-router';
import { plainText, stopPaths } from '@porcelain/client/walkthroughs/rules';
import { Box } from '../../../components/ui/box';
import { Empty } from '../../../components/ui/empty';
import { RichText } from '../../../components/ui/rich-text';
import { Screen } from '../../../components/ui/screen';
import { WorkspaceGate, type Workspace } from '../../projects/index';
import { ChangesPage } from '../../workspace/index';
import { useBranchFiles, useReadyWalkthrough } from '../queries/walkthrough';

const BRANCH = { kind: 'branch' } as const;

export function WalkthroughStepScreen({
  workspace,
  step,
}: {
  workspace: string | undefined;
  step: string | undefined;
}) {
  return (
    <Screen layout="fixed">
      <WorkspaceGate
        title="Step"
        expectedWorkspace={workspace ?? ''}
        changed={
          <Empty
            title="Step unavailable"
            description="Another worktree is selected now. Open the step again from its walkthrough."
          />
        }
      >
        {(selected) => <StepReader workspace={selected} step={Number(step)} />}
      </WorkspaceGate>
    </Screen>
  );
}

function StepReader({
  workspace,
  step,
}: {
  workspace: Workspace;
  step: number;
}) {
  const router = useRouter();
  const ready = useReadyWalkthrough(workspace);
  const renames = useBranchFiles(workspace);
  const stop = ready?.content.stops[step - 1];
  if (!ready || !stop)
    return (
      <Empty
        title="This step isn't available"
        description="The walkthrough changed since this step was opened. Open the walkthrough for the current steps."
        action={{ label: 'Open walkthrough', onPress: () => router.back() }}
      />
    );
  const total = ready.content.stops.length;
  const go = (next: number) => router.setParams({ step: String(next) });
  return (
    <ChangesPage
      key={step}
      workspace={workspace}
      comparison={BRANCH}
      reading={{
        page: `walkthrough-step:${ready.run.id}:${step}`,
        title: `Step ${step} of ${total}`,
        only: stopPaths(stop, renames),
        actions: [
          {
            kind: 'button',
            id: 'previous-step',
            label: 'Previous step',
            icon: 'previous',
            disabled: step === 1,
            onPress: () => go(step - 1),
          },
          {
            kind: 'button',
            id: 'next-step',
            label: 'Next step',
            icon: 'next',
            disabled: step === total,
            onPress: () => go(step + 1),
          },
        ],
        header: (
          <Box divider="bottom" paddingX={4} paddingY={3} gap={1}>
            <RichText text={stop.title} variant="headline" />
            <RichText
              text={stop.explanation}
              variant="secondary"
              tone="muted"
            />
          </Box>
        ),
        empty: {
          title: 'No files on this branch',
          description: `The files of “${plainText(stop.title)}” are no longer changed on this branch.`,
        },
      }}
    />
  );
}

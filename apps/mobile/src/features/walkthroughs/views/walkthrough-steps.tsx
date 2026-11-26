import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  groupFilesByStep,
  plainText,
  stepCallState,
  type CallState,
  type WalkthroughContent,
  type WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import { Box } from '../../../components/ui/box';
import { Icon } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { StatusDot } from '../../../components/ui/status-dot';
import { Text } from '../../../components/ui/text';
import { documentHeading } from '../../../shared/rules/document-heading';
import type { Workspace } from '../../projects/index';
import { reviewParams } from '../../workspace/index';
import { useConversations } from '../queries/conversations';
import { useWalkthroughFiles } from '../queries/walkthrough';
import { useChangedFileOpening } from './changed-file-opening';

const BRANCH = { kind: 'branch' } as const;

function GroupLabel({ children }: { children: string }) {
  return (
    <Box paddingX={4} paddingTop={2}>
      <Text variant="caption" tone="muted" accessibilityRole="header">
        {children}
      </Text>
    </Box>
  );
}

const CALL_MARKS: Record<
  CallState,
  { label: string; tone: 'foreground' | 'warning' | 'muted' }
> = {
  open: { label: 'Your call', tone: 'foreground' },
  'needs-commit': {
    label: 'Your call, needs a new commit',
    tone: 'warning',
  },
  decided: { label: 'Your call, decided', tone: 'muted' },
};

export function WalkthroughSteps({
  workspace,
  run,
  content,
}: {
  workspace: Workspace;
  run: Pick<WalkthroughRun, 'id' | 'branch'>;
  content: WalkthroughContent;
}) {
  const router = useRouter();
  const { view } = useConversations({ workspace, run });
  const { branch, worktree } = useWalkthroughFiles(workspace);
  const opening = useChangedFileOpening(workspace);
  const files = [
    ...new Map(
      [...branch, ...worktree].map((file) => [file.path, file]),
    ).values(),
  ];
  const grouped = groupFilesByStep(content, files);
  const steps = grouped.steps.filter((step) => step.files.length > 0);
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-1 py-2"
      accessibilityLabel="Steps"
    >
      <Item
        size="compact"
        title="All changes"
        leading={<Icon name="branch" tone="muted" />}
        trailing={
          <Text variant="caption" tone="muted">
            {files.length}
          </Text>
        }
        onPress={() =>
          router.push({
            pathname: '/review-changes',
            params: {
              ...reviewParams(workspace.key, BRANCH),
              walkthrough: 'true',
            },
          })
        }
      />
      {steps.length > 0 ? <GroupLabel>By step</GroupLabel> : null}
      {steps.map(({ stop, step, files: owned }) => {
        const call = stepCallState(content, step, view?.decisions);
        const mark = call ? CALL_MARKS[call] : undefined;
        return (
          <Item
            key={step}
            size="compact"
            title={plainText(stop.title)}
            titleNumberOfLines={2}
            accessibilityLabel={`Step ${step}: ${plainText(stop.title)}${mark ? `, ${mark.label.toLowerCase()}` : ''}, ${owned.length === 1 ? '1 file' : `${owned.length} files`}`}
            leading={
              <Text variant="mono" tone="muted" className="w-4">
                {step}
              </Text>
            }
            trailing={
              <Box className="flex-row items-center" gap={2}>
                {mark ? (
                  <StatusDot label={mark.label} tone={mark.tone} />
                ) : null}
                <Text variant="caption" tone="muted">
                  {owned.length}
                </Text>
              </Box>
            }
            onPress={() =>
              router.push({
                pathname: '/walkthrough-step',
                params: { workspace: workspace.key, step: String(step) },
              })
            }
          />
        );
      })}
      {grouped.outside.length > 0 ? (
        <>
          <GroupLabel>Not in the walkthrough yet</GroupLabel>
          {grouped.outside.map((file) => {
            const { title, subtitle } = documentHeading(file.path);
            return (
              <Item
                key={file.path}
                size="compact"
                title={title}
                titleNumberOfLines={1}
                {...(subtitle ? { description: subtitle } : {})}
                descriptionNumberOfLines={1}
                {...opening.row(file.path)}
              />
            );
          })}
          {opening.failure ? <Box paddingX={4}>{opening.failure}</Box> : null}
        </>
      ) : null}
    </ScrollView>
  );
}

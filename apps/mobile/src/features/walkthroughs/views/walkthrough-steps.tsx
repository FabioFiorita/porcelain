import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  groupFilesByStep,
  plainText,
  type WalkthroughContent,
} from '@porcelain/client/walkthroughs/rules';
import { Box } from '../../../components/ui/box';
import { Icon } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { StatusDot } from '../../../components/ui/status-dot';
import { Text } from '../../../components/ui/text';
import { documentHeading } from '../../../shared/rules/document-heading';
import type { Workspace } from '../../projects/index';
import { reviewParams } from '../../workspace/index';
import { ErrorState } from '../../../components/ui/error-state';
import { fileComparison } from '../rules/file-comparison';
import { useBranchFileList, useWalkthroughFiles } from '../queries/walkthrough';

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

export function WalkthroughSteps({
  workspace,
  content,
}: {
  workspace: Workspace;
  content: WalkthroughContent;
}) {
  const router = useRouter();
  const { branch, worktree } = useWalkthroughFiles(workspace);
  const branchList = useBranchFileList(workspace);
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
      {steps.map(({ stop, step, files: owned }) => (
        <Item
          key={step}
          size="compact"
          title={plainText(stop.title)}
          titleNumberOfLines={2}
          accessibilityLabel={`Step ${step}: ${plainText(stop.title)}${stop.callouts.length > 0 ? ', your call' : ''}, ${owned.length === 1 ? '1 file' : `${owned.length} files`}`}
          leading={
            <Text variant="mono" tone="muted" className="w-4">
              {step}
            </Text>
          }
          trailing={
            <Box className="flex-row items-center" gap={2}>
              {stop.callouts.length > 0 ? (
                <StatusDot label="Your call" tone="foreground" />
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
      ))}
      {grouped.outside.length > 0 ? (
        <>
          <GroupLabel>Not in the walkthrough yet</GroupLabel>
          {grouped.outside.map((file) => {
            const { title, subtitle } = documentHeading(file.path);
            const comparison = fileComparison(
              {
                branch: branchList.files,
                branchFailed: branchList.failed,
                worktree,
              },
              file.path,
            );
            return (
              <Item
                key={file.path}
                size="compact"
                title={title}
                titleNumberOfLines={1}
                {...(subtitle ? { description: subtitle } : {})}
                descriptionNumberOfLines={1}
                pending={comparison === undefined && !branchList.failed}
                disabled={comparison === undefined}
                onPress={() => {
                  if (comparison)
                    router.push({
                      pathname: '/review-file',
                      params: {
                        ...reviewParams(workspace.key, comparison),
                        path: file.path,
                      },
                    });
                }}
              />
            );
          })}
          {branchList.files === undefined && branchList.failed ? (
            <Box paddingX={4}>
              <ErrorState
                message="The changed files could not be read."
                retry={{
                  label: 'Read the changes again',
                  onPress: branchList.retry,
                  pending: branchList.waiting,
                }}
              />
            </Box>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

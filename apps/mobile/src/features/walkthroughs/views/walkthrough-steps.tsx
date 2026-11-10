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
import { useBranchFiles } from '../queries/walkthrough';

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
  const files = useBranchFiles(workspace);
  const grouped = groupFilesByStep(content, files);
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
            params: reviewParams(workspace.key, BRANCH),
          })
        }
      />
      <GroupLabel>By step</GroupLabel>
      {grouped.steps.map(({ stop, step, files: owned }) => (
        <Item
          key={step}
          size="compact"
          title={plainText(stop.title)}
          titleNumberOfLines={2}
          accessibilityLabel={`Step ${step}: ${plainText(stop.title)}${stop.attention ? ', your call' : ''}, ${owned.length} files`}
          leading={
            <Text variant="caption" tone="muted" className="w-4 font-mono">
              {step}
            </Text>
          }
          trailing={
            <Box className="flex-row items-center" gap={2}>
              {stop.attention ? (
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
            return (
              <Item
                key={file.path}
                size="compact"
                title={title}
                titleNumberOfLines={1}
                {...(subtitle ? { description: subtitle } : {})}
                descriptionNumberOfLines={1}
                onPress={() =>
                  router.push({
                    pathname: '/review-file',
                    params: {
                      ...reviewParams(workspace.key, BRANCH),
                      path: file.path,
                    },
                  })
                }
              />
            );
          })}
        </>
      ) : null}
    </ScrollView>
  );
}

import { useRouter } from 'expo-router';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { diffLines, focusPatch } from '@porcelain/client/changes/rules';
import {
  recordedChecks,
  type RecordedCheck,
} from '@porcelain/client/projects/rules';
import {
  type StepBlock,
  type WalkthroughComparison,
  type WalkthroughExcerpt,
  type WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import { Box } from '../../../components/ui/box';
import { Card } from '../../../components/ui/card';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { RichText } from '../../../components/ui/rich-text';
import { Separator } from '../../../components/ui/separator';
import { Text } from '../../../components/ui/text';
import { documentHeading } from '../../../shared/rules/document-heading';
import { sourceLanguage } from '../../../shared/rules/highlight-code';
import { DiffView } from '../../documents/index';
import type { Workspace } from '../../projects/index';
import { reviewParams } from '../../workspace/index';
import { fileComparison } from '../rules/file-comparison';
import { useBranchFileList, useCapturedExcerpt } from '../queries/walkthrough';
import { WalkthroughProof } from './walkthrough-evidence';

type Files = Extract<StepBlock, { kind: 'files' }>;
type Checks = Extract<StepBlock, { kind: 'checks' }>;

function CapturedLines({
  workspace,
  runId,
  step,
  excerpt,
}: {
  workspace: Workspace;
  runId: string;
  step: number;
  excerpt: WalkthroughExcerpt;
}) {
  const { result, retry } = useCapturedExcerpt({
    workspace,
    runId,
    step,
    block: excerpt.position,
  });
  if (AsyncResult.isInitial(result)) return null;
  if (AsyncResult.isFailure(result))
    return (
      <ErrorState
        message="The captured diff could not be read."
        retry={{
          label: 'Read the lines again',
          onPress: retry,
          pending: result.waiting,
        }}
      />
    );
  const answer = Option.getOrUndefined(AsyncResult.value(result));
  const patch =
    answer?.walkthrough?.id === runId ? answer.capturedPatch : undefined;
  const focused = patch
    ? focusPatch(patch, [excerpt.span], 3, excerpt.side)
    : undefined;
  const parsed = focused ? diffLines(focused) : undefined;
  if (parsed?.kind !== 'text')
    return (
      <Text variant="caption" tone="muted">
        These lines are unavailable in the saved walkthrough.
      </Text>
    );
  return (
    <Card>
      <DiffView
        lines={parsed.lines.filter((line) => line.kind !== undefined)}
        language={sourceLanguage(excerpt.path)}
        fit
      />
    </Card>
  );
}

function Excerpt({
  workspace,
  runId,
  step,
  excerpt,
}: {
  workspace: Workspace;
  runId: string;
  step: number;
  excerpt: WalkthroughExcerpt;
}) {
  return (
    <Box gap={1}>
      <Text variant="mono" tone="muted">
        {excerpt.path} · {excerpt.lines}
      </Text>
      {excerpt.caption ? (
        <RichText text={excerpt.caption} variant="secondary" />
      ) : null}
      <CapturedLines
        workspace={workspace}
        runId={runId}
        step={step}
        excerpt={excerpt}
      />
    </Box>
  );
}

function FileList({
  workspace,
  block,
}: {
  workspace: Workspace;
  block: Files;
}) {
  const router = useRouter();
  const branch = useBranchFileList(workspace);
  const { worktree } = useWalkthroughFiles(workspace);
  return (
    <Box gap={2}>
      <Card>
        {block.files.map((file, index) => {
          const { title, subtitle } = documentHeading(file.path);
          const comparison = fileComparison(
            {
              branch: branch.files,
              branchFailed: branch.failed,
              worktree,
            },
            file.path,
          );
          return (
            <Box key={file.path}>
              {index > 0 ? <Separator /> : null}
              <Item
                size="compact"
                title={title}
                titleNumberOfLines={1}
                description={file.note}
                descriptionNumberOfLines={2}
                accessibilityLabel={`${subtitle ? `${subtitle}/` : ''}${title}: ${file.note}`}
                leading={<Icon name="file" tone="muted" size="small" />}
                pending={comparison === undefined && !branch.failed}
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
            </Box>
          );
        })}
      </Card>
      {branch.files === undefined && branch.failed ? (
        <ErrorState
          message="The changed files could not be read."
          retry={{
            label: 'Read the changes again',
            onPress: branch.retry,
            pending: branch.waiting,
          }}
        />
      ) : null}
    </Box>
  );
}

const RESULT_ICONS = {
  passed: { name: 'check', tone: 'add' },
  failed: { name: 'close', tone: 'del' },
  running: { name: 'refresh', tone: 'muted' },
  none: { name: 'neutral', tone: 'muted' },
} as const;

function CheckRow({ result }: { result: RecordedCheck }) {
  const icon = RESULT_ICONS[result.tone];
  return (
    <Box
      className="min-h-7 flex-row items-center"
      gap={2}
      accessible
      accessibilityLabel={`${result.name}: ${result.label}`}
    >
      <Icon name={icon.name} tone={icon.tone} size="small" />
      <Box className="min-w-0 flex-1">
        <Text variant="secondary" numberOfLines={1}>
          {result.name}
        </Text>
      </Box>
      {result.detail ? (
        <Text variant="caption" tone="muted">
          {result.detail}
        </Text>
      ) : null}
    </Box>
  );
}

function CheckList({ block }: { block: Checks }) {
  const checks = recordedChecks(block.checks);
  return (
    <Box gap={1}>
      <Text variant="mono" tone="muted" accessibilityRole="header">
        {checks.label}
      </Text>
      {checks.results.map((result, index) => (
        <CheckRow key={`${result.name}:${index}`} result={result} />
      ))}
      {checks.more ? (
        <Text variant="caption" tone="muted">
          More checks on the pull request
        </Text>
      ) : null}
    </Box>
  );
}

export function StepBlocks({
  workspace,
  run,
  step,
  blocks,
}: {
  workspace: Workspace;
  run: WalkthroughRun;
  step: number;
  blocks: readonly StepBlock[];
}) {
  return blocks.map((block, index) => {
    switch (block.kind) {
      case 'excerpt':
        return (
          <Excerpt
            key={index}
            workspace={workspace}
            runId={run.id}
            step={step}
            excerpt={block.excerpt}
          />
        );
      case 'images':
        return (
          <WalkthroughProof
            key={index}
            workspace={workspace}
            run={run}
            step={step}
            items={block.screenshots}
            first={block.first}
          />
        );
      case 'files':
        return <FileList key={index} workspace={workspace} block={block} />;
      case 'checks':
        return <CheckList key={index} block={block} />;
    }
  });
}

export function ComparisonTable({
  comparison,
}: {
  comparison: WalkthroughComparison;
}) {
  const [left, right] = comparison.columns;
  return (
    <Box>
      <Box className="flex-row" gap={3} paddingY={1}>
        <Box className="flex-1">
          <RichText
            text={left}
            variant="caption"
            tone="muted"
            weight="medium"
          />
        </Box>
        <Box className="flex-1">
          <RichText
            text={right}
            variant="caption"
            tone="muted"
            weight="medium"
          />
        </Box>
      </Box>
      {comparison.rows.map(([first, second], index) => (
        <Box key={index}>
          <Separator />
          <Box
            className="flex-row"
            gap={3}
            paddingY={2}
            accessible
            accessibilityLabel={`${left}: ${first}. ${right}: ${second}.`}
          >
            <Box className="flex-1">
              <RichText text={first} variant="secondary" />
            </Box>
            <Box className="flex-1">
              <RichText text={second} variant="secondary" />
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

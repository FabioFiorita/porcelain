import {
  currentWalkthroughChecks,
  movedPullHead,
  pullRequestRollup,
  recordedCheckNow,
  recordedChecks,
  type RecordedCheck,
} from '@porcelain/client/projects/rules';
import {
  type StepBlock,
  type WalkthroughComparison,
  type WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import { Box } from '../../../components/ui/box';
import { Card } from '../../../components/ui/card';
import { Icon } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { RichText } from '../../../components/ui/rich-text';
import { Separator } from '../../../components/ui/separator';
import { Text } from '../../../components/ui/text';
import { documentHeading } from '../../../shared/rules/document-heading';
import type { Workspace } from '../../projects/index';
import { useChangedFileOpening } from './changed-file-opening';
import type { WalkthroughPull } from '@porcelain/client/walkthroughs';
import { WalkthroughDiagram } from './walkthrough-diagram';
import { WalkthroughProof } from './walkthrough-evidence';
import { CapturedExcerpt } from './walkthrough-excerpt';

type Files = Extract<StepBlock, { kind: 'files' }>;
type Checks = Extract<StepBlock, { kind: 'checks' }>;

function FileList({
  workspace,
  block,
}: {
  workspace: Workspace;
  block: Files;
}) {
  const opening = useChangedFileOpening(workspace);
  return (
    <Box gap={2}>
      <Card>
        {block.files.map((file, index) => {
          const { title, subtitle } = documentHeading(file.path);
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
                {...opening.row(file.path)}
              />
            </Box>
          );
        })}
      </Card>
      {opening.failure}
    </Box>
  );
}

export const RESULT_ICONS = {
  passed: { name: 'check', tone: 'add' },
  failed: { name: 'close', tone: 'del' },
  running: { name: 'refresh', tone: 'muted' },
  none: { name: 'neutral', tone: 'muted' },
} as const;

function CheckRow({
  result,
  live,
}: {
  result: RecordedCheck;
  live: ReturnType<typeof currentWalkthroughChecks>;
}) {
  const now = recordedCheckNow(result, live);
  const icon = RESULT_ICONS[now.tone];
  return (
    <Box
      className="min-h-8 flex-row items-center"
      paddingX={4}
      gap={2}
      accessible
      accessibilityLabel={`${result.name}: ${now.detail}`}
    >
      <Icon name={icon.name} tone={icon.tone} size="small" />
      <Box className="min-w-0 flex-1">
        <Text variant="secondary" numberOfLines={1}>
          {result.name}
        </Text>
      </Box>
      <Text variant="caption" tone="muted">
        {now.detail}
      </Text>
    </Box>
  );
}

function CheckList({ block, pull }: { block: Checks; pull: WalkthroughPull }) {
  const checks = recordedChecks(block.checks);
  const icon = RESULT_ICONS[pullRequestRollup(block.checks.state).tone];
  const live = currentWalkthroughChecks(block.checks, pull?.status);
  const now = live ? RESULT_ICONS[live.tone] : undefined;
  const moved = movedPullHead(pull?.detail?.headSha, block.checks.headOid);
  return (
    <Card>
      <Box
        className="min-h-9 flex-row flex-wrap items-center"
        paddingX={4}
        paddingY={2}
        gap={2}
        accessibilityRole="header"
      >
        <Icon name={icon.name} tone={icon.tone} size="small" />
        <Text variant="secondary" weight="medium">
          {live ? checks.whenWritten : checks.label}
        </Text>
        {live && now ? (
          <Box className="flex-row items-center" gap={1}>
            <Icon name={now.name} tone={now.tone} size="small" />
            <Text variant="secondary" weight="medium">
              {live.label}
            </Text>
          </Box>
        ) : null}
        {moved && pull ? (
          <Text variant="caption" tone="warn">
            #{pull.number} is now at {moved}
          </Text>
        ) : null}
      </Box>
      <Separator />
      <Box paddingY={1}>
        {checks.results.map((result, index) => (
          <CheckRow
            key={`${result.name}:${index}`}
            result={result}
            live={live}
          />
        ))}
      </Box>
      {checks.more ? (
        <>
          <Separator />
          <Box paddingX={4} paddingY={2}>
            <Text variant="caption" tone="muted">
              More checks on the pull request
            </Text>
          </Box>
        </>
      ) : null}
    </Card>
  );
}

export function StepBlocks({
  workspace,
  run,
  step,
  title,
  blocks,
  pull,
}: {
  workspace: Workspace;
  run: WalkthroughRun;
  step: number;
  title: string;
  blocks: readonly StepBlock[];
  pull: WalkthroughPull;
}) {
  return blocks.map((block, index) => {
    switch (block.kind) {
      case 'excerpt':
        return (
          <CapturedExcerpt
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
        return <CheckList key={index} block={block} pull={pull} />;
      case 'diagram':
        return (
          <WalkthroughDiagram
            key={index}
            workspace={workspace}
            run={run}
            step={step}
            title={title}
            diagram={block.diagram}
          />
        );
    }
  });
}

function TableRow({
  cells,
  muted,
  label,
}: {
  cells: readonly string[];
  muted: boolean;
  label?: string | undefined;
}) {
  return (
    <Box
      className="flex-row"
      accessible={label !== undefined}
      {...(label === undefined ? {} : { accessibilityLabel: label })}
    >
      {cells.map((cell, index) => (
        <Box key={index} className="flex-1 flex-row">
          {index > 0 ? <Separator orientation="vertical" /> : null}
          <Box className="min-w-0 flex-1" paddingX={2} paddingY={2}>
            <RichText
              text={cell}
              variant={muted ? 'secondary' : 'caption'}
              weight={muted ? 'normal' : 'medium'}
              tone={muted ? 'muted' : 'default'}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export function ComparisonTable({
  comparison,
}: {
  comparison: WalkthroughComparison;
}) {
  return (
    <Card>
      <TableRow cells={comparison.columns} muted={false} />
      {comparison.rows.map((row, rowIndex) => (
        <Box key={rowIndex}>
          <Separator />
          <TableRow
            cells={row}
            muted
            label={row
              .map(
                (cell, index) => `${comparison.columns[index] ?? ''}: ${cell}.`,
              )
              .join(' ')}
          />
        </Box>
      ))}
    </Card>
  );
}

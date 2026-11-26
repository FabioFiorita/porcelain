import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { diffLines, focusPatch } from '@porcelain/client/changes/rules';
import type { WalkthroughExcerpt } from '@porcelain/client/walkthroughs/rules';
import { Box } from '../../../components/ui/box';
import { Card } from '../../../components/ui/card';
import { ErrorState } from '../../../components/ui/error-state';
import { RichText } from '../../../components/ui/rich-text';
import { Text } from '../../../components/ui/text';
import { sourceLanguage } from '../../../shared/rules/highlight-code';
import { DiffView } from '../../documents/index';
import type { Workspace } from '../../projects/index';
import { useCapturedExcerpt } from '../queries/walkthrough';

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
    node: excerpt.node,
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

export function CapturedExcerpt({
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

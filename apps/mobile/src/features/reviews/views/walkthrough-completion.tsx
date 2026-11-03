import { useId, useState } from 'react';
import { useAtom, useAtomValue } from '@effect/atom-react';
import {
  completeDecision,
  decisionCompletionBinding,
} from '@porcelain/client/reviews';
import {
  filesReviewed,
  completionPlan,
  stopTitle,
  type ReviewNotice,
  type WalkthroughKey,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import type { Workspace } from '../../projects';
import type { useWalkthroughProgress } from '../queries/walkthrough';
import { ReviewReadState } from './read-state';
import { reviewContinuation } from '../store';

type Progress = ReturnType<typeof useWalkthroughProgress>;
type StopCompletionProps = {
  workspace: Workspace;
  stop: Exclude<WalkthroughStop, { kind: 'briefing' }>;
  progress: Progress;
  next: WalkthroughStop | undefined;
  go: (key: WalkthroughKey) => void;
  unavailable: boolean;
};

export function WalkthroughProgress({
  stops,
  progress,
}: {
  stops: readonly WalkthroughStop[];
  progress: Progress;
}) {
  const decisions = stops.filter((stop) => stop.kind === 'decision');
  const files = filesReviewed(
    stops.flatMap((stop) => stop.paths),
    progress.items,
  );
  return (
    <Box gap={2}>
      <Text variant="secondary" accessibilityRole="text">
        {progress.settled
          ? `${decisions.filter(progress.done).length} of ${decisions.length} decisions reviewed · ${files.reviewed} of ${files.total} files reviewed`
          : 'Review progress is unavailable.'}
      </Text>
      {progress.marks._tag !== 'Success' ? (
        <ReviewReadState result={progress.marks} refresh={progress.refresh} />
      ) : null}
    </Box>
  );
}

export function useStopCompletion({
  workspace,
  stop,
  progress,
  next,
  go,
  unavailable,
}: StopCompletionProps) {
  const [notice, setNotice] = useState<ReviewNotice>();
  const continueIfActive = useAtomValue(reviewContinuation(useId()));
  const completion = decisionCompletionBinding(
    useAtom(
      completeDecision({
        connection: workspace.connection,
        reviewId: progress.revision.reviewId,
      }),
      { mode: 'promiseExit' },
    ),
    setNotice,
  );
  const finished = progress.done(stop);
  const files = progress.items
    .filter((item) => stop.paths.includes(item.path))
    .map((item) => ({ ...item, fingerprint: item.fingerprint ?? undefined }));
  const plan = completionPlan(files);
  const layer = stop.kind === 'decision' ? stop.layer : undefined;
  const target = layer
    ? `decision ${stopTitle(stop)}`
    : `files in ${stopTitle(stop)}`;
  const disabled =
    !progress.settled || unavailable || completion.pending || plan.blocked;
  const complete = (onDone?: () => void) => {
    if (disabled) return;
    setNotice(undefined);
    completion.complete({
      revision: progress.revision.revision,
      files,
      ...(layer
        ? {
            decision: {
              layerId: layer.id,
              fingerprint: layer.fingerprint,
              reviewed: progress.states.get(layer.id)?.reviewed === true,
            },
          }
        : {}),
      ...(onDone ? { onDone: () => continueIfActive(onDone) } : {}),
    });
  };
  const reopen = () => {
    if (disabled || !layer) return;
    setNotice(undefined);
    completion.reopen({ layerId: layer.id, fingerprint: layer.fingerprint });
  };
  return {
    finished,
    plan,
    layer,
    disabled,
    pending: completion.pending,
    notice,
    complete,
    reopen,
    advance: () => go(next?.key ?? 'briefing'),
    markLabel: plan.action
      ? `${plan.action} for ${stopTitle(stop)}`
      : `Mark ${target} as reviewed`,
  };
}

export function CompletionNotice({
  notice,
}: {
  notice: ReviewNotice | undefined;
}) {
  return notice ? (
    <Text
      variant="secondary"
      tone={notice.type === 'error' ? 'destructive' : 'default'}
      accessibilityRole={notice.type === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
    >
      {notice.title}. {notice.description}
    </Text>
  ) : null;
}

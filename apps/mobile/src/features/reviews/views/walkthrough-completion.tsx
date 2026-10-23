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
import { Button } from '../../../components/ui/button';
import { Text } from '../../../components/ui/text';
import type { Workspace } from '../../projects';
import type { ReviewSnapshot } from '../rules/comparison';
import type { useWalkthroughProgress } from '../queries/walkthrough';
import { ReviewedAction } from './review-actions';
import { ReviewReadState } from './read-state';
import { reviewContinuation } from '../store';

type Progress = ReturnType<typeof useWalkthroughProgress>;

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
      <Text variant="ui" accessibilityRole="text">
        {progress.settled
          ? `${decisions.filter(progress.done).length} of ${decisions.length} decisions reviewed · ${files.reviewed} of ${files.total} files reviewed`
          : 'Review progress is unavailable.'}
      </Text>
      {progress.files._tag !== 'Success' ? (
        <ReviewReadState
          result={progress.files}
          refresh={progress.refreshFiles}
        />
      ) : null}
      {progress.decisions._tag !== 'Success' ? (
        <ReviewReadState
          result={progress.decisions}
          refresh={progress.refreshDecisions}
        />
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
}: {
  workspace: Workspace;
  stop: Exclude<WalkthroughStop, { kind: 'briefing' }>;
  progress: Progress;
  next: WalkthroughStop | undefined;
  go: (key: WalkthroughKey) => void;
  unavailable: boolean;
}) {
  const [notice, setNotice] = useState<ReviewNotice>();
  const continueIfActive = useAtomValue(reviewContinuation(useId()));
  const completion = decisionCompletionBinding(
    useAtom(
      completeDecision({
        connection: workspace.connection,
        scope: workspace.scope,
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
  const disabled =
    !progress.settled || unavailable || completion.pending || plan.blocked;
  const complete = (onDone?: () => void) => {
    if (disabled) return;
    setNotice(undefined);
    completion.complete({
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
      : `Mark decision ${stopTitle(stop)} as reviewed`,
  };
}

export function CompletionNotice({
  notice,
}: {
  notice: ReviewNotice | undefined;
}) {
  return notice ? (
    <Text
      variant="ui"
      tone={notice.type === 'error' ? 'destructive' : 'default'}
      accessibilityRole={notice.type === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
    >
      {notice.title}. {notice.description}
    </Text>
  ) : null;
}

export function WalkthroughCompletion({
  workspace,
  snapshot,
  stop,
  progress,
  next,
  go,
  onFile,
  unavailable,
}: {
  workspace: Workspace;
  snapshot: ReviewSnapshot | undefined;
  stop: Exclude<WalkthroughStop, { kind: 'briefing' }>;
  progress: Progress;
  next: WalkthroughStop | undefined;
  go: (key: WalkthroughKey) => void;
  onFile: (path: string) => void;
  unavailable: boolean;
}) {
  const {
    finished,
    plan,
    layer,
    disabled,
    notice,
    complete,
    reopen,
    advance,
    markLabel,
  } = useStopCompletion({ workspace, stop, progress, next, go, unavailable });
  const tally = filesReviewed(stop.paths, progress.items);
  const continueLabel = plan.action
    ? `${plan.action} for ${stopTitle(stop)} and stay here`
    : `Mark remaining files for ${stopTitle(stop)} and continue`;
  return (
    <Box gap={3}>
      <Text variant="ui" weight="medium">
        {finished ? 'Reviewed' : 'Review this stop'}
      </Text>
      {plan.explanation ? (
        <Text variant="ui" tone="muted">
          {plan.explanation}
        </Text>
      ) : null}
      <Text variant="caption" tone="muted">
        {tally.reviewed} of {tally.total} files reviewed here
      </Text>
      {stop.paths.map((path) => {
        const file = progress.items.find((item) => item.path === path);
        return (
          <Box key={path} gap={2}>
            <Button
              label={path}
              accessibilityLabel={`Open changed-file diff for ${path}`}
              variant="link"
              onPress={() => onFile(path)}
            />
            {snapshot && file && progress.settled && !unavailable ? (
              <ReviewedAction
                workspace={workspace}
                snapshot={snapshot}
                file={file}
              />
            ) : null}
          </Box>
        );
      })}
      {stop.kind === 'decision'
        ? stop.elsewhere.map((file) => (
            <Button
              key={file.path}
              label={`${file.path} · shown in another stop`}
              accessibilityLabel={`Open owning stop for ${file.path}`}
              variant="link"
              onPress={() => go(file.stop)}
            />
          ))
        : null}
      {layer && progress.states.get(layer.id)?.stale ? (
        <Text variant="caption" tone="muted">
          Code changed since this decision was explained.
        </Text>
      ) : null}
      {layer ? (
        <Button
          label={
            finished
              ? 'Unmark decision reviewed'
              : (plan.action ?? 'Mark decision reviewed')
          }
          accessibilityLabel={
            finished
              ? `Unmark decision ${stopTitle(stop)} as unreviewed`
              : markLabel
          }
          variant="outline"
          disabled={disabled}
          onPress={() => (finished ? reopen() : complete())}
        />
      ) : null}
      <Button
        label={
          finished
            ? 'Continue'
            : (plan.action ?? 'Mark remaining files and continue')
        }
        accessibilityLabel={
          finished ? `Continue from ${stopTitle(stop)}` : continueLabel
        }
        disabled={disabled}
        onPress={() => (finished ? advance() : complete(advance))}
      />
      <CompletionNotice notice={notice} />
    </Box>
  );
}

import { ReviewBriefing } from './review-briefing';
import { BriefingContinue } from './briefing-continue';
import { briefingContinuation } from '../rules/briefing';
import { useState, type ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import {
  readPublishedReview,
  readReviewSummary,
} from '@porcelain/client/reviews';
import {
  changeAnchor,
  currentStop,
  neighbourStop,
  notExplainedLabel,
  stopTitle,
  walkthroughStops,
  type ReviewResponse,
  type ReviewRevision,
  type WalkthroughKey,
  type WalkthroughStop,
  type ReviewStep,
} from '@porcelain/client/reviews/rules';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Item } from '../../../components/ui/item';
import { Button } from '../../../components/ui/button';
import { Loading } from '../../../components/ui/loading';
import { Empty } from '../../../components/ui/empty';
import { HtmlPreview } from '../../../components/ui/html-preview';
import { ErrorState } from '../../../components/ui/error-state';
import { usePreviewLink } from '../../../shared/adapters/preview-link';
import { ReviewReadState } from './read-state';
import { ReviewPointer } from './review-pointer';
import { useReviewPlace } from '../store';
import { useWalkthroughProgress } from '../queries/walkthrough';
import { useLinkedReview } from '../queries/linked-review';
import type { ReviewSnapshot } from '../rules/comparison';
import {
  WalkthroughCompletion,
  WalkthroughProgress,
  useStopCompletion,
} from './walkthrough-completion';
import { DecisionPage } from './decision-page';
import { DecisionBar } from './decision-bar';
import { Badge } from '../../../components/ui/badge';
import { reviewParams } from '../rules/navigation';
import type { Workspace } from '../../projects';

export function PublishedReview({
  workspace,
  onFile,
  snapshot,
  docked = false,
}: {
  workspace: Workspace;
  onFile: (path: string) => void;
  snapshot: Extract<ReviewSnapshot, { kind: 'worktree' }> | undefined;
  docked?: boolean;
}) {
  const query = readPublishedReview({
    connection: workspace.connection,
    scope: workspace.scope,
  });
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  if (!AsyncResult.isSuccess(result))
    return <ReviewReadState result={result} refresh={refresh} />;
  if (!result.value)
    return (
      <Empty
        title="No agent review"
        description="Choose a changed file to review its diff. Published agent explanations will appear here."
      />
    );
  return (
    <Publication
      key={`${workspace.key}:${result.value.publishedAt}:${result.value.revision}`}
      workspace={workspace}
      review={result.value}
      snapshot={snapshot}
      publicationSettled={!result.waiting}
      onFile={onFile}
      onRefresh={refresh}
      docked={docked}
    />
  );
}

type PublicationProps = {
  workspace: Workspace;
  review: ReviewResponse;
  snapshot: Extract<ReviewSnapshot, { kind: 'worktree' }> | undefined;
  onFile: (path: string) => void;
  onRefresh: () => void;
  publicationSettled: boolean;
  docked: boolean;
};

function Publication(props: PublicationProps) {
  return props.review.reviewId ? (
    <PublicationRevision {...props} reviewId={props.review.reviewId} />
  ) : (
    <PublishedContent {...props} revision={undefined} />
  );
}

function PublicationRevision(props: PublicationProps & { reviewId: string }) {
  const { result, refresh } = useLinkedReview({
    connection: props.workspace.connection,
    reviewId: props.reviewId,
    revision: props.review.revision,
  });
  if (!AsyncResult.isSuccess(result))
    return <ReviewReadState result={result} refresh={refresh} />;
  if (!result.value.revision)
    return (
      <ErrorState
        message="This review revision could not be found."
        retry={{ label: 'Read again', onPress: refresh }}
      />
    );
  return <PublishedContent {...props} revision={result.value.revision} />;
}

function PublishedContent({
  workspace,
  review,
  snapshot,
  onFile,
  onRefresh,
  publicationSettled,
  revision,
  docked,
}: PublicationProps & { revision: ReviewRevision | undefined }) {
  const router = useRouter();
  const [place, setPlace] = useReviewPlace(
    JSON.stringify([workspace.key, review.publishedAt, review.revision]),
  );
  const [previousSummary, setPreviousSummary] =
    useState<ReviewResponse['summary']>();
  const changedPaths =
    snapshot?.kind === 'worktree'
      ? snapshot.answer.changes.map((file) => file.path)
      : undefined;
  const progress = useWalkthroughProgress(
    workspace,
    review,
    snapshot,
    publicationSettled,
  );
  const stops = walkthroughStops(review, changedPaths ?? [], {
    specsApart: true,
  });
  const stop = currentStop(stops, place.stop);
  const pointer =
    stop.kind === 'decision'
      ? stop.layer.steps.find((step) => step.id === place.step)
      : undefined;
  const go = (key: WalkthroughKey) => setPlace({ stop: key, summary: false });
  const previous = neighbourStop(stops, stop.key, -1);
  const next = neighbourStop(stops, stop.key, 1);
  return (
    <Box gap={3}>
      <Stack.Screen options={{ title: screenTitle(stop, stops) }} />
      {stop.kind === 'briefing' ? (
        <Text
          variant="heading"
          numberOfLines={3}
          accessibilityLabel={
            review.verdict?.asked.text ??
            workspace.worktree.branch ??
            'Agent review'
          }
        >
          {review.verdict?.asked.text ?? 'Agent review'}
        </Text>
      ) : null}
      <Text variant="caption" tone="muted">
        Revision {review.revision}
      </Text>
      <WalkthroughProgress stops={stops} progress={progress} />
      {docked && stop.kind !== 'briefing' ? (
        <DecisionStepper
          stops={stops}
          current={stop}
          done={progress.done}
          go={go}
        />
      ) : null}
      {review.diagnostics === 'unavailable' ? (
        <Text variant="ui">
          The worktree is unavailable. This is the saved review; code locations
          and coverage could not be checked.
        </Text>
      ) : null}
      <Box className="flex-row flex-wrap" gap={2}>
        <Button
          label="Overview"
          variant="outline"
          accessibilityLabel="Open review overview"
          onPress={() => go('briefing')}
        />
        <Button
          label="Agent summary"
          variant="outline"
          accessibilityLabel="Read agent summary"
          onPress={() => {
            setPreviousSummary(review.summary);
            onRefresh();
            setPlace({ ...place, summary: true });
          }}
        />
        <Button label="Refresh review" variant="ghost" onPress={onRefresh} />
      </Box>
      {place.summary ? (
        <>
          <Button
            label="Return to walkthrough"
            variant="outline"
            onPress={() => setPlace({ ...place, summary: false })}
          />
          <SummaryPage
            workspace={workspace}
            review={review}
            onRefresh={onRefresh}
            refreshing={previousSummary === review.summary}
          />
        </>
      ) : (
        <>
          {stop.kind === 'unexplained' || stop.kind === 'specs' ? (
            <Text variant="heading">
              {stopTitle(stop)}
              {progress.done(stop) ? ' · Reviewed' : ''}
            </Text>
          ) : null}
          <ReviewPage
            workspace={workspace}
            review={review}
            revision={revision}
            stop={stop}
            stops={stops}
            pointer={pointer}
            changedPaths={changedPaths}
            onFile={onFile}
            go={go}
            done={progress.done}
            decision={(entry) => (
              <DecisionPage
                key={entry.key}
                workspace={workspace}
                changedPaths={changedPaths ?? []}
                onFile={onFile}
                review={review}
                revision={revision}
                stop={entry}
                progress={progress}
                unavailable={review.diagnostics === 'unavailable'}
                go={go}
                readStep={(step) =>
                  setPlace({ stop: stop.key, summary: false, step })
                }
                onComment={(body) =>
                  openComments(router, workspace, { compose: true, body })
                }
                onThread={(thread) =>
                  openComments(router, workspace, { thread: thread.id })
                }
              />
            )}
          />
          {stop.kind !== 'briefing' && !pointer && !docked ? (
            <WalkthroughCompletion
              key={stop.key}
              workspace={workspace}
              snapshot={snapshot}
              stop={stop}
              progress={progress}
              next={next}
              go={go}
              onFile={onFile}
              unavailable={review.diagnostics === 'unavailable'}
            />
          ) : null}
          {stop.kind !== 'briefing' && !docked ? (
            <Box className="flex-row flex-wrap" gap={2}>
              <Button
                label="Previous"
                accessibilityLabel={
                  previous
                    ? `Previous stop: ${stopTitle(previous)}`
                    : 'Previous stop'
                }
                variant="outline"
                disabled={!previous}
                onPress={() => previous && go(previous.key)}
              />
              <Button
                label="Next"
                accessibilityLabel={
                  next ? `Next stop: ${stopTitle(next)}` : 'Next stop'
                }
                variant="outline"
                disabled={!next}
                onPress={() => next && go(next.key)}
              />
            </Box>
          ) : null}
        </>
      )}
    </Box>
  );
}

function ReviewPage({
  workspace,
  review,
  revision,
  stop,
  stops,
  pointer,
  changedPaths,
  onFile,
  go,
  done,
  decision,
}: {
  workspace: Workspace;
  review: ReviewResponse;
  revision: ReviewRevision | undefined;
  stop: WalkthroughStop;
  decision: (stop: Extract<WalkthroughStop, { kind: 'decision' }>) => ReactNode;
  stops: readonly WalkthroughStop[];
  pointer: ReviewStep | undefined;
  changedPaths: readonly string[] | undefined;
  onFile: (path: string) => void;
  go: (key: WalkthroughKey) => void;
  done: (stop: WalkthroughStop) => boolean;
}) {
  if (pointer)
    return (
      <>
        <Button
          label={`Back to decision ${stop.kind === 'decision' ? stop.number : ''}`}
          accessibilityLabel={`Return to ${stopTitle(stop)}`}
          variant="outline"
          onPress={() => go(stop.key)}
        />
        <Text variant="ui" weight="medium">
          {pointer.title}
        </Text>
        <Text variant="ui" selectable>
          {pointer.text}
        </Text>
        <ReviewPointer key={pointer.id} workspace={workspace} step={pointer} />
        {pointer.kind === 'changed' &&
        changedPaths?.includes(pointer.pointer.path) ? (
          <Button
            label="Open changed-file diff"
            variant="outline"
            onPress={() => onFile(pointer.pointer.path)}
          />
        ) : null}
      </>
    );
  if (stop.kind === 'briefing')
    return (
      <>
        <ReviewBriefing
          review={review}
          revision={revision}
          connection={workspace.connection}
          go={go}
        />
        {review.layers.length === 0 ? (
          <Empty
            title="No walkthrough decisions"
            description="The agent supplied no decision explanations. The summary and available changes remain accessible."
          />
        ) : null}
        <Text variant="subheading" tone="muted">
          The walkthrough
        </Text>
        {stops.slice(1).map((entry) => {
          let description =
            notExplainedLabel(review.notExplained) ??
            'Changes no decision explains';
          if (entry.kind === 'decision')
            description = `${done(entry) ? 'Reviewed · ' : ''}${entry.layer.summary}`;
          if (entry.kind === 'specs')
            description = `${entry.paths.length} spec files set apart`;
          return (
            <Item
              key={entry.key}
              title={stopTitle(entry)}
              description={description}
              accessibilityLabel={`Open ${stopTitle(entry)}`}
              onPress={() => go(entry.key)}
            />
          );
        })}
      </>
    );
  if (stop.kind === 'decision') return decision(stop);
  return (
    <>
      {stop.kind === 'unexplained' ? (
        <Text variant="ui">
          {notExplainedLabel(review.notExplained) ??
            'These changed files have no agent explanation.'}
        </Text>
      ) : (
        <Text variant="ui">Spec files set apart from the decisions.</Text>
      )}
      {(stop.kind === 'unexplained' ? review.notExplained : []).map((gap) => (
        <Text key={gap.path} variant="caption">
          {gap.path} ·{' '}
          {gap.binary
            ? 'Binary file'
            : gap.ranges
                .map((range) => `${range.startLine}–${range.endLine}`)
                .join(', ')}
        </Text>
      ))}
      {stop.paths.map((path) => (
        <Item
          key={path}
          title={path}
          accessibilityLabel={
            stop.kind === 'specs'
              ? `Review spec ${path}`
              : `Review unexplained ${path}`
          }
          onPress={() => onFile(path)}
        />
      ))}
    </>
  );
}

function SummaryPage({
  refreshing,
  ...props
}: {
  refreshing: boolean;
  workspace: Workspace;
  review: ReviewResponse;
  onRefresh: () => void;
}) {
  if (refreshing) return <Loading label="Refreshing agent summary…" />;
  return <AgentSummary {...props} />;
}

function AgentSummary({
  workspace,
  review,
  onRefresh,
}: {
  workspace: Workspace;
  review: ReviewResponse;
  onRefresh: () => void;
}) {
  const query = readReviewSummary({
    connection: workspace.connection,
    scope: workspace.scope,
    summary: review.summary,
  });
  const result = useAtomValue(query);
  const link = usePreviewLink();
  if (!AsyncResult.isSuccess(result))
    return <ReviewReadState result={result} refresh={onRefresh} />;
  return (
    <Box gap={2}>
      {link.error ? <ErrorState message={link.error} /> : null}
      <Box className="h-96">
        <HtmlPreview html={result.value} onLink={link.open} />
      </Box>
    </Box>
  );
}

export function PublishedReviewContinue({
  workspace,
  snapshot,
  onContinue,
}: {
  workspace: Workspace;
  snapshot: Extract<ReviewSnapshot, { kind: 'worktree' }> | undefined;
  onContinue: () => void;
}) {
  const result = useAtomValue(
    readPublishedReview({
      connection: workspace.connection,
      scope: workspace.scope,
    }),
  );
  if (!AsyncResult.isSuccess(result) || !result.value) return null;
  return (
    <PublishedContinue
      key={`${workspace.key}:${result.value.publishedAt}:${result.value.revision}`}
      workspace={workspace}
      review={result.value}
      snapshot={snapshot}
      publicationSettled={!result.waiting}
      onContinue={onContinue}
    />
  );
}

function PublishedContinue({
  workspace,
  review,
  snapshot,
  publicationSettled,
  onContinue,
}: {
  workspace: Workspace;
  review: ReviewResponse;
  snapshot: Extract<ReviewSnapshot, { kind: 'worktree' }> | undefined;
  publicationSettled: boolean;
  onContinue: () => void;
}) {
  const [place, setPlace] = useReviewPlace(
    JSON.stringify([workspace.key, review.publishedAt, review.revision]),
  );
  const progress = useWalkthroughProgress(
    workspace,
    review,
    snapshot,
    publicationSettled,
  );
  const stops = walkthroughStops(
    review,
    snapshot?.answer.changes.map((file) => file.path) ?? [],
    { specsApart: true },
  );
  const stop = currentStop(stops, place.stop);
  const go = (key: WalkthroughKey) => {
    setPlace({ stop: key, summary: false });
    onContinue();
  };
  if (place.summary) return null;
  if (stop.kind !== 'briefing')
    return (
      <StopBar
        key={stop.key}
        workspace={workspace}
        stops={stops}
        stop={stop}
        progress={progress}
        unavailable={review.diagnostics === 'unavailable'}
        go={go}
      />
    );
  const next = briefingContinuation(stops, progress.done);
  if (!next) return null;
  return <BriefingContinue label={next.label} onPress={() => go(next.key)} />;
}

function StopBar({
  workspace,
  stops,
  stop,
  progress,
  unavailable,
  go,
}: {
  workspace: Workspace;
  stops: readonly WalkthroughStop[];
  stop: Exclude<WalkthroughStop, { kind: 'briefing' }>;
  progress: ReturnType<typeof useWalkthroughProgress>;
  unavailable: boolean;
  go: (key: WalkthroughKey) => void;
}) {
  const router = useRouter();
  const next = neighbourStop(stops, stop.key, 1);
  const completion = useStopCompletion({
    workspace,
    stop,
    progress,
    next,
    go,
    unavailable,
  });
  return (
    <DecisionBar
      stop={stop}
      previous={neighbourStop(stops, stop.key, -1)}
      next={next}
      go={go}
      completion={completion}
      onComment={() =>
        openComments(router, workspace, {
          compose: true,
          body: stop.kind === 'decision' ? `On decision ${stop.number}: ` : '',
        })
      }
    />
  );
}

export function usePublishedStop(
  workspace: Workspace,
  changedPaths: readonly string[],
) {
  const result = useAtomValue(
    readPublishedReview({
      connection: workspace.connection,
      scope: workspace.scope,
    }),
  );
  const review = AsyncResult.isSuccess(result) ? result.value : undefined;
  const [place] = useReviewPlace(
    review
      ? JSON.stringify([workspace.key, review.publishedAt, review.revision])
      : '',
  );
  if (!review || place.summary) return undefined;
  return currentStop(
    walkthroughStops(review, changedPaths, { specsApart: true }),
    place.stop,
  ).kind;
}

function screenTitle(
  stop: WalkthroughStop,
  stops: readonly WalkthroughStop[],
): string {
  if (stop.kind === 'briefing') return 'Briefing';
  if (stop.kind !== 'decision') return stopTitle(stop);
  return `Decision ${stop.number} of ${stops.filter((entry) => entry.kind === 'decision').length}`;
}

function DecisionStepper({
  stops,
  current,
  done,
  go,
}: {
  stops: readonly WalkthroughStop[];
  current: WalkthroughStop;
  done: (stop: WalkthroughStop) => boolean;
  go: (key: WalkthroughKey) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Box className="flex-row items-center" gap={2}>
        {stops.map((entry) =>
          entry.kind === 'decision' ? (
            <Badge
              key={entry.key}
              label={done(entry) ? `✓ ${entry.number}` : String(entry.number)}
              variant={stepVariant(entry.key === current.key, done(entry))}
              accessibilityLabel={`Open ${stopTitle(entry)}${done(entry) ? ', reviewed' : ''}`}
              accessibilityState={{ selected: entry.key === current.key }}
              onPress={() => go(entry.key)}
            />
          ) : null,
        )}
      </Box>
    </ScrollView>
  );
}

function stepVariant(current: boolean, reviewed: boolean) {
  if (current) return 'default';
  return reviewed ? 'secondary' : 'outline';
}

function openComments(
  router: ReturnType<typeof useRouter>,
  workspace: Workspace,
  input: { compose: true; body: string } | { thread: string },
) {
  router.push({
    pathname: '/review-comments',
    params: {
      ...reviewParams(workspace.key, { kind: 'worktree' }),
      ...('thread' in input
        ? { thread: input.thread }
        : {
            anchor: JSON.stringify(changeAnchor(undefined)),
            compose: 'true',
            body: input.body,
          }),
    },
  });
}

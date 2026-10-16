import { useState } from 'react';
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import {
  readPublishedReview,
  readReviewSummary,
} from '@porcelain/client/reviews';
import {
  briefingTitle,
  currentStop,
  decisionRoute,
  neighbourStop,
  notExplainedLabel,
  proofLabel,
  proofStatus,
  reviewStepLines,
  stopTitle,
  systemChanges,
  walkthroughStops,
  type ReviewResponse,
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
import type { Workspace } from '../../projects';

export function PublishedReview({
  workspace,
  onFile,
  changedPaths,
}: {
  workspace: Workspace;
  onFile: (path: string) => void;
  changedPaths: readonly string[] | undefined;
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
    <PublishedContent
      key={`${workspace.key}:${result.value.publishedAt}:${result.value.revision}`}
      workspace={workspace}
      review={result.value}
      changedPaths={changedPaths}
      onFile={onFile}
      onRefresh={refresh}
    />
  );
}

function PublishedContent({
  workspace,
  review,
  changedPaths,
  onFile,
  onRefresh,
}: {
  workspace: Workspace;
  review: ReviewResponse;
  changedPaths: readonly string[] | undefined;
  onFile: (path: string) => void;
  onRefresh: () => void;
}) {
  const [place, setPlace] = useReviewPlace(
    JSON.stringify([workspace.key, review.publishedAt, review.revision]),
  );
  const [previousSummary, setPreviousSummary] =
    useState<ReviewResponse['summary']>();
  const stops = walkthroughStops(review, changedPaths ?? [], {
    specsApart: false,
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
      <Text variant="heading">
        {review.active ? 'Agent review' : 'Saved review'}
      </Text>
      <Text variant="caption" tone="muted">
        Revision {review.revision}
      </Text>
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
          <Text variant="heading">{stopTitle(stop)}</Text>
          <ReviewPage
            workspace={workspace}
            review={review}
            stop={stop}
            stops={stops}
            pointer={pointer}
            changedPaths={changedPaths}
            onFile={onFile}
            go={go}
            readStep={(step) =>
              setPlace({ stop: stop.key, summary: false, step })
            }
          />
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
        </>
      )}
    </Box>
  );
}

function ReviewPage({
  workspace,
  review,
  stop,
  stops,
  pointer,
  changedPaths,
  onFile,
  go,
  readStep,
}: {
  workspace: Workspace;
  review: ReviewResponse;
  stop: WalkthroughStop;
  stops: readonly WalkthroughStop[];
  pointer: ReviewStep | undefined;
  changedPaths: readonly string[] | undefined;
  onFile: (path: string) => void;
  go: (key: WalkthroughKey) => void;
  readStep: (step: string) => void;
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
        <Text variant="ui">{briefingTitle(review.layers.length)}</Text>
        <SystemBriefing review={review} />
        {review.layers.length === 0 ? (
          <Empty
            title="No walkthrough decisions"
            description="The agent supplied no decision explanations. The summary and available changes remain accessible."
          />
        ) : null}
        {stops.slice(1).map((entry) => (
          <Item
            key={entry.key}
            title={stopTitle(entry)}
            description={
              entry.kind === 'decision'
                ? entry.layer.summary
                : 'Changes no decision explains'
            }
            accessibilityLabel={`Open ${stopTitle(entry)}`}
            onPress={() => go(entry.key)}
          />
        ))}
        <Text variant="ui">
          Proof · {proofLabel(proofStatus(review.proof))}
        </Text>
        {review.proof.checks.map((check, index) => (
          <Box key={`${index}:${check.name}`} gap={1}>
            <Text variant="ui" weight="medium">
              {check.name} · {check.result}
            </Text>
            {check.output ? (
              <Text variant="caption" selectable>
                {check.output}
              </Text>
            ) : null}
          </Box>
        ))}
      </>
    );
  if (stop.kind === 'decision')
    return (
      <>
        <Text variant="ui" selectable>
          {stop.layer.summary}
        </Text>
        {decisionRoute(stop.layer).length > 0 ? (
          <Text variant="caption" tone="muted">
            {decisionRoute(stop.layer).join(' → ')}
          </Text>
        ) : null}
        {stop.layer.steps.map((step, index) => {
          const range = reviewStepLines(step);
          const broken = step.location.state === 'broken';
          return (
            <Box key={step.id} gap={1}>
              <Text variant="ui" weight="medium">
                {index + 1}. {step.title}
              </Text>
              <Text variant="ui" selectable>
                {step.text}
              </Text>
              <Text variant="caption" tone="muted">
                {step.kind === 'context' ? 'Context' : 'Changed code'} ·{' '}
                {step.pointer.path} · lines {range.startLine}–{range.endLine}
                {step.pointer.symbol ? ` · ${step.pointer.symbol}` : ''}
              </Text>
              <Text variant="caption" tone="muted">
                {pointerStatus(step)}
              </Text>
              <Button
                label={`Read code · ${index + 1}`}
                accessibilityLabel={`Read ${step.pointer.path} lines ${range.startLine} to ${range.endLine} for ${step.title}`}
                variant="outline"
                disabled={broken || review.diagnostics === 'unavailable'}
                onPress={() => readStep(step.id)}
              />
            </Box>
          );
        })}
      </>
    );
  return (
    <>
      <Text variant="ui">
        {notExplainedLabel(review.notExplained) ??
          'These changed files have no agent explanation.'}
      </Text>
      {review.notExplained.map((gap) => (
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
          accessibilityLabel={`Review unexplained ${path}`}
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

function SystemBriefing({ review }: { review: ReviewResponse }) {
  const parts = systemChanges(review);
  return (
    <Box gap={2}>
      {parts.questions.map((part) => (
        <Box key={part.id} gap={1}>
          <Text variant="ui" weight="medium">
            {part.label}
          </Text>
          <Text variant="ui" selectable>
            {part.problem}
          </Text>
        </Box>
      ))}
      {(['added', 'changed', 'removed'] as const).map((kind) =>
        parts[kind].map((part) => (
          <Box key={part.id} gap={1}>
            <Text variant="ui" weight="medium">
              {{ added: 'New', changed: 'Changed', removed: 'Removed' }[kind]} ·{' '}
              {part.label}
            </Text>
            {part.detail ? (
              <Text variant="ui" selectable>
                {part.detail}
              </Text>
            ) : null}
          </Box>
        )),
      )}
    </Box>
  );
}

function pointerStatus(step: ReviewStep): string {
  switch (step.location.state) {
    case 'broken':
      return 'This code location is no longer available.';
    case 'changed':
      return 'Code changed since publication; the original range may have moved.';
    case 'committed':
      return 'This code is now committed.';
    case 'current':
      return 'Current code location';
  }
}

import { Stack } from 'expo-router';
import { useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import {
  agentFeedbackControls,
  readReviewSummary,
} from '@porcelain/client/reviews';
import type { WalkthroughKey } from '@porcelain/client/reviews/rules';
import { Box } from '../../../components/ui/box';
import { Card } from '../../../components/ui/card';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { HtmlPreview } from '../../../components/ui/html-preview';
import { Icon } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { Loading } from '../../../components/ui/loading';
import { Screen } from '../../../components/ui/screen';
import { Text } from '../../../components/ui/text';
import { usePreviewLink } from '../../../shared/adapters/preview-link';
import { headerIcon } from '../../../shared/icons/header-icon';
import { WorkspaceGate } from '../../projects';
import { briefingContinuation } from '../rules/briefing';
import { AgentFeedback, SendFeedbackButton } from './agent-feedback';
import { PullRequestState } from './pull-request-state';
import {
  PublishedWalkthrough,
  type PublishedWalkthroughState,
} from './published-walkthrough';
import { BriefingContinue } from './briefing-continue';
import { ReviewBriefing } from './review-briefing';
import { ReviewReadState } from './read-state';
import { WalkthroughProgress } from './walkthrough-completion';
import { useWalkthroughRoutes } from './walkthrough-routes';
import { WalkthroughStopList } from './walkthrough-stop-list';

export function PublishedOverview({
  walkthrough,
}: {
  walkthrough: PublishedWalkthroughState;
}) {
  const { workspace, review, revision, stops, progress } = walkthrough;
  const routes = useWalkthroughRoutes(workspace);
  const go = (key: WalkthroughKey) => {
    if (key !== 'briefing') routes.openStop(key);
  };
  return (
    <Box gap={4}>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={headerIcon('refresh')}
          accessibilityLabel="Refresh review"
          onPress={walkthrough.refresh}
        />
      </Stack.Toolbar>
      <Box gap={1}>
        <Text
          variant="title"
          accessibilityRole="header"
          accessibilityLabel={
            review.verdict?.asked.text ??
            workspace.worktree.branch ??
            'Agent review'
          }
          numberOfLines={3}
        >
          {review.verdict?.asked.text ?? 'Agent review'}
        </Text>
        <Text variant="caption" tone="muted">
          {[workspace.worktree.branch, `Revision ${review.revision}`]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </Box>
      <WalkthroughProgress stops={stops} progress={progress} />
      <AgentFeedback
        connection={workspace.connection}
        reviewId={revision.reviewId}
        reviewRevision={review.revision}
        writable
        sendInline={false}
      />
      <PullRequestState
        connection={workspace.connection}
        reviewId={revision.reviewId}
      />
      {walkthrough.unavailable ? (
        <Text variant="secondary">
          The worktree is unavailable. This is the saved review; code locations
          and coverage could not be checked.
        </Text>
      ) : null}
      <ReviewBriefing
        review={review}
        revision={revision}
        connection={workspace.connection}
        go={go}
      />
      <Box gap={2}>
        <Text variant="headline" tone="muted" accessibilityRole="header">
          The walkthrough
        </Text>
        {review.layers.length === 0 ? (
          <Empty
            title="No walkthrough decisions"
            description="The agent supplied no decision explanations. The summary and changed files remain available."
          />
        ) : null}
        <WalkthroughStopList
          review={review}
          stops={stops}
          done={progress.done}
          onStop={routes.openStop}
        />
        <Card>
          <Item
            title="Agent summary"
            leading={<Icon name="info" tone="muted" />}
            trailing={<Icon name="chevron" tone="muted" />}
            accessibilityLabel="Read agent summary"
            testID="review-summary"
            onPress={() => {
              walkthrough.refresh();
              routes.openSummary();
            }}
          />
        </Card>
      </Box>
    </Box>
  );
}

export function PublishedOverviewBar({
  walkthrough,
}: {
  walkthrough: PublishedWalkthroughState;
}) {
  const routes = useWalkthroughRoutes(walkthrough.workspace);
  const feedback = {
    connection: walkthrough.workspace.connection,
    reviewId: walkthrough.revision.reviewId,
    reviewRevision: walkthrough.review.revision,
    writable: true,
  };
  const sending = useAtomValue(agentFeedbackControls(feedback));
  const next = briefingContinuation(
    walkthrough.stops,
    walkthrough.progress.done,
  );
  if (!next && !(sending.kind === 'ready' && sending.showActions)) return null;
  return (
    <BriefingContinue
      next={next}
      onContinue={() => {
        if (next && next.key !== 'briefing') routes.openStop(next.key);
      }}
    >
      <SendFeedbackButton {...feedback} />
    </BriefingContinue>
  );
}

export function ReviewSummaryScreen({
  workspace,
}: {
  workspace?: string | undefined;
}) {
  return (
    <WorkspaceGate title="Agent summary" expectedWorkspace={workspace}>
      {(selected) => (
        <Screen layout="fixed">
          <PublishedWalkthrough workspace={selected}>
            {(walkthrough) => <SummaryPage walkthrough={walkthrough} />}
          </PublishedWalkthrough>
        </Screen>
      )}
    </WorkspaceGate>
  );
}

function SummaryPage({
  walkthrough,
}: {
  walkthrough: PublishedWalkthroughState;
}) {
  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={headerIcon('refresh')}
          accessibilityLabel="Refresh agent summary"
          onPress={walkthrough.refresh}
        />
      </Stack.Toolbar>
      <AgentSummary walkthrough={walkthrough} />
    </>
  );
}

function AgentSummary({
  walkthrough,
}: {
  walkthrough: PublishedWalkthroughState;
}) {
  const { workspace } = walkthrough;
  const query = readReviewSummary({
    connection: workspace.connection,
    scope: workspace.scope,
    summary: walkthrough.review.summary,
  });
  const result = useAtomValue(query);
  const link = usePreviewLink();
  if (!AsyncResult.isSuccess(result))
    return walkthrough.refreshing ? (
      <Loading label="Refreshing agent summary…" />
    ) : (
      <ReviewReadState result={result} refresh={walkthrough.refresh} />
    );
  return (
    <Box className="flex-1">
      {link.error ? <ErrorState message={link.error} /> : null}
      <HtmlPreview html={result.value} onLink={link.open} />
    </Box>
  );
}

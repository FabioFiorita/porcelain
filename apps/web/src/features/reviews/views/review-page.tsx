import { createPortal } from 'react-dom';
import { ListChecksIcon, FileTextIcon, PanelRightIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { formatForDisplay, useHotkey } from '@tanstack/react-hotkeys';
import { Kbd } from '@/components/ui/kbd';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useElement } from '@/shared/hooks/use-element';
import type { Surface } from '@/shared/workspace/search';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import {
  neighbourStop,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';
import { useInventory } from '@/features/projects/index';
import {
  useAtom,
  useAtomMount,
  useAtomRefresh,
  useAtomValue,
} from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { Suspense, useState, type ReactNode } from 'react';
import {
  readReview,
  readReviewMarks,
  readReviewComments,
  observeReviewSeen,
  reviewCommands,
  readReviewPullRequest,
} from '@porcelain/client/reviews';
import type { DurableReviewRead } from '@porcelain/client/reviews/rules';
import {
  currentStop,
  decisionKey,
  revisionDecisionStates,
  stopDone,
  reviewArchivable,
  reviewClosed,
  reviewListStatus,
  reviewPullRequestNotice,
  stopName,
  stopTitle,
  summaryLinkExpiring,
  walkthroughStops,
  revisionReviewItems,
  type ReviewRevision,
  type ReviewStep,
  type ReviewScope,
  type WalkthroughKey,
} from '@porcelain/client/reviews/rules';
import { CheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePreferences, useTheme } from '@/features/preferences/index';
import { useBranchChanges } from '@/features/changes/index';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { reviewListTitle } from '@porcelain/client/reviews/rules';
import { useReviewSummary } from '../queries/summary';
import { useReviewPanelOpen, useWalkthroughPlace } from '../store';
import { GitButton } from '@/features/git-actions/index';
import { DocumentTabs } from './document-tabs';
import { ProgressMeter } from './progress-meter';
import { BriefingMargin } from './briefing-margin';
import { WalkthroughSpine } from './walkthrough-spine';
import { WalkthroughBriefing } from './walkthrough-briefing';
import { DecisionPage } from './walkthrough-stop';
import { ClosingPage } from './closing-page';
import { MarginRow } from './margin-row';
import { SummaryFrame } from './summary-frame';
import { WalkthroughDock } from './walkthrough-dock';
import { useComments } from '../queries/comments';
import { RevisionCode, RevisionFile } from './revision-code';
import {
  StateFrame,
  StateFailure,
  StateNotice,
  StateSkeleton,
} from '@/shared/views/state-notice';
import { ReviewBoundary } from './review-boundary';
import { RevisionPanel } from './revision-panel';
import { SidePanel, surfaceNames } from './review-sidebar';
import { SideRail } from './side-rail';
import { cn } from '@/shared/lib/utils';
import { outlinePill, primaryPill } from './review-controls';
import { useDesktopReview } from '../adapters/desktop-review';

type ReviewPageProps = {
  toolbarTarget?: HTMLElement | null | undefined;
  reviewId: string;
  navigation?: ReactNode;
  revision?: number | undefined;
  decision?: string | undefined;
  context: ConnectionContext;
  onRevision?: ((revision: number | undefined) => void) | undefined;
  onStop?: ((layerId: string | undefined) => void) | undefined;
  active?: boolean | undefined;
  onBack: () => void;
  onDeleted?: (() => void) | undefined;
  liveScope?: ReviewScope | undefined;
  initialStep?: string | undefined;
  proofCurrent?: boolean | undefined;
};

export function ReviewPage({
  reviewId,
  toolbarTarget,
  navigation,
  revision,
  decision,
  context,
  onRevision,
  onStop,
  onBack,
  onDeleted,
  liveScope,
  initialStep,
  proofCurrent = true,
  active = true,
}: ReviewPageProps) {
  const query = readReview({
    connection: context.connection,
    reviewId,
    ...(revision === undefined ? {} : { revision }),
  });
  const result = useAtomValue(query);
  const retry = useAtomRefresh(query);
  const data = Option.getOrUndefined(AsyncResult.value(result));
  const state = reviewReadState(result, navigation, retry, onBack);
  if (state) return state;
  if (!data?.review || !data.revision)
    return (
      <ReviewMissing
        navigation={navigation}
        reviewId={reviewId}
        revision={revision}
        context={context}
        onRevision={onRevision}
        onBack={onBack}
      />
    );
  return (
    <ReviewRevisionPage
      key={`${reviewId}:${data.revision.revision}`}
      navigation={navigation}
      toolbarTarget={toolbarTarget}
      data={data}
      revision={data.revision}
      context={context}
      decision={decision}
      onRevision={onRevision}
      onStop={onStop}
      onBack={onBack}
      onDeleted={onDeleted}
      liveScope={liveScope}
      initialStep={initialStep}
      proofCurrent={proofCurrent}
      active={active}
      reread={{ run: retry, failed: AsyncResult.isFailure(result) }}
    />
  );
}

export function ReviewMissing({
  navigation,
  reviewId,
  revision,
  context,
  onRevision,
  onBack,
}: Pick<
  ReviewPageProps,
  'navigation' | 'reviewId' | 'context' | 'onRevision' | 'onBack'
> & {
  revision?: string | number | undefined;
}) {
  const query = readReview({ connection: context.connection, reviewId });
  const result = useAtomValue(query);
  const retry = useAtomRefresh(query);
  const latest = Option.getOrUndefined(AsyncResult.value(result))?.review;
  const state = reviewReadState(result, navigation, retry, onBack);
  if (state) return state;
  return (
    <StateFrame navigation={navigation} title="Review">
      <StateNotice
        title={latest ? 'Revision not found' : 'Review not found'}
        description={
          latest
            ? `This review has revisions r1 to r${latest.latestRevision}. This link asks for r${revision}.`
            : 'This link does not identify an available review.'
        }
      >
        {latest && onRevision && (
          <Button onClick={() => onRevision(undefined)}>
            Open r{latest.latestRevision}, the latest
          </Button>
        )}
        <Button variant="outline" onClick={onBack}>
          Back to workspace
        </Button>
      </StateNotice>
    </StateFrame>
  );
}

function reviewReadState(
  result: AsyncResult.AsyncResult<unknown, unknown>,
  navigation: ReactNode,
  retry: () => void,
  onBack: () => void,
) {
  if (AsyncResult.isInitial(result))
    return <ReviewLoading navigation={navigation} />;
  if (AsyncResult.isFailure(result) && Option.isNone(AsyncResult.value(result)))
    return (
      <ReviewFailure navigation={navigation} retry={retry} onBack={onBack} />
    );
  return undefined;
}

function ReviewLoading({ navigation }: Pick<ReviewPageProps, 'navigation'>) {
  return (
    <StateFrame navigation={navigation} title="Review">
      <StateSkeleton label="Loading review" />
    </StateFrame>
  );
}

function ReviewFailure({
  navigation,
  retry,
  onBack,
}: Pick<ReviewPageProps, 'navigation' | 'onBack'> & { retry: () => void }) {
  return (
    <StateFrame navigation={navigation} title="Review">
      <StateFailure
        description="Review could not be loaded. Check the link and connection."
        onRetry={retry}
        onBack={onBack}
      />
    </StateFrame>
  );
}

function ReviewRevisionPage({
  toolbarTarget,
  navigation,
  data,
  revision,
  context,
  decision,
  onRevision,
  onStop,
  onBack,
  onDeleted,
  liveScope,
  initialStep,
  proofCurrent = true,
  active = true,
  reread,
}: Omit<ReviewPageProps, 'reviewId' | 'revision'> & {
  data: DurableReviewRead;
  revision: ReviewRevision;
  reread: { run: () => void; failed: boolean };
}) {
  const inventory = useInventory(context.connection);
  const project = inventory.projects.find(
    (entry) => entry.id === revision.projectId,
  );
  const worktree = project?.worktrees.find(
    (entry) => entry.available && entry.id === revision.content.worktreeId,
  );
  const currentScope =
    liveScope ??
    (worktree
      ? { projectId: revision.projectId, worktreeId: worktree.id }
      : undefined);
  const latestHead =
    data.revisions.find(
      (entry) => entry.revision === data.review?.latestRevision,
    )?.headOid ?? revision.headOid;
  const review = revision.content;
  const scope: ReviewScope = {
    projectId: revision.projectId,
    worktreeId: review.worktreeId,
    review: { reviewId: revision.reviewId, revision: revision.revision },
  };
  const {
    result: summary,
    page: summaryPage,
    url: summaryUrl,
    available: showSummary,
  } = useReviewSummary(scope, context, review.summary);
  const [expiredLink, setExpiredLink] = useState<string>();
  const renewSummaryLink = () => {
    setExpiredLink(review.summary.expires);
    reread.run();
  };
  const seenQuery = observeReviewSeen({
    connection: context.connection,
    reviewId: revision.reviewId,
    revision: revision.revision,
  });
  const seen = useAtomValue(seenQuery);
  const retrySeen = useAtomRefresh(seenQuery);
  useAtomMount(
    readReviewComments({
      connection: context.connection,
      reviewId: revision.reviewId,
    }),
  );
  const marksRead = readReviewMarks({
    connection: context.connection,
    reviewId: revision.reviewId,
  });
  const markResult = useAtomValue(marksRead);
  const retryMarks = useAtomRefresh(marksRead);
  const marks = Option.getOrUndefined(AsyncResult.value(markResult));
  const { preferences } = usePreferences();
  const { dark } = useTheme();
  const place = useWalkthroughPlace(
    `${revision.reviewId}:${revision.revision}`,
  );
  const [chosen, setChosen] = useState<string>();
  const [view, setView] = useState<'walkthrough' | 'summary'>('walkthrough');
  const [file, setFile] = useState<
    | {
        path: string;
        step?: ReviewStep;
        change?: true;
      }
    | undefined
  >(() => {
    const step = review.layers
      .flatMap((layer) => layer.steps)
      .find((step) => step.id === initialStep);
    return step ? { path: step.pointer.path, step } : undefined;
  });
  const standalone = toolbarTarget === undefined;
  const desktop = useDesktopReview();
  const { open: panelOpen, setOpen: setPanelOpen } = useReviewPanelOpen(
    revision.reviewId,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const railToggle = useElement<HTMLButtonElement>();
  const scroller = useElement<HTMLElement>();
  const [routed, setRouted] = useState(decision);
  if (routed !== decision) {
    setRouted(decision);
    setChosen(undefined);
    setView('walkthrough');
    setFile(undefined);
  }
  const stops = walkthroughStops(
    review,
    revision.files.map((entry) => entry.path),
    { specsApart: preferences.collapseSpecs },
  );
  const missingDecision =
    decision !== undefined &&
    !review.layers.some((layer) => layer.id === decision);
  let destination = place.place;
  if (decision) destination = decisionKey(decision);
  if (missingDecision) destination = 'briefing';
  const stop = currentStop(stops, chosen ?? destination);
  const decisions = revisionDecisionStates(revision, marks);
  const items = revisionReviewItems(revision, marks);
  const reviewedFiles = items.filter(
    (item) => item.reviewStatus === 'reviewed',
  ).length;
  const reviewedDecisions = stops.filter(
    (item) => item.kind === 'decision' && stopDone(item, items, decisions),
  ).length;
  const done = (item: typeof stop) => stopDone(item, items, decisions);
  const decisionCount = review.layers.length;
  const neighbour = (direction: 1 | -1) => {
    const next = neighbourStop(stops, stop.key, direction);
    return next ? () => go(next.key) : undefined;
  };
  const go = (key: WalkthroughKey) => {
    scroller.element?.scrollTo({ top: 0 });
    setChosen(key);
    place.setPlace(key);
    setView('walkthrough');
    setFile(undefined);
    onStop?.(review.layers.find((entry) => decisionKey(entry.id) === key)?.id);
  };
  const interaction = {
    active,
    worktreeId: revision.reviewId,
    entry: `review:${revision.revision}`,
  };
  const props = {
    review,
    scope,
    context,
    interaction,
    onOpen: (document: { kind: string; path?: string }) => {
      if (document.path) setFile({ path: document.path });
    },
  };
  const presentation = (
    <Tabs
      className="shrink-0"
      value={view}
      onValueChange={(value: unknown) => {
        if (value === 'walkthrough' || value === 'summary') {
          if (
            value === 'summary' &&
            summaryLinkExpiring(review.summary, Date.now())
          )
            renewSummaryLink();
          setView(value);
          setFile(undefined);
        }
      }}
    >
      <TabsList
        aria-label="Review presentation"
        aria-busy={AsyncResult.isInitial(summary) || summary.waiting}
        className="h-7"
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <TabsTrigger value="walkthrough" aria-label="Walkthrough" />
            }
          >
            <ListChecksIcon className="size-3.5 @min-3xl/pane:hidden" />
            <span className="hidden whitespace-nowrap @min-3xl/pane:inline">
              Walkthrough
            </span>
          </TooltipTrigger>
          <TooltipContent>Walkthrough</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={<TabsTrigger value="summary" aria-label="Agent summary" />}
          >
            <FileTextIcon className="size-3.5 @min-3xl/pane:hidden" />
            <span className="hidden whitespace-nowrap @min-3xl/pane:inline">
              Agent summary
            </span>
          </TooltipTrigger>
          <TooltipContent>Agent summary</TooltipContent>
        </Tooltip>
      </TabsList>
    </Tabs>
  );
  const bar = (
    <>
      {showSummary && presentation}
      <span
        aria-label="Review progress"
        className="hidden items-center gap-2 text-xs text-muted-foreground tabular-nums @min-4xl/pane:inline-flex"
      >
        {reviewedFiles} of {items.length} files
        <ProgressMeter
          label="Files reviewed"
          value={reviewedFiles}
          max={items.length}
        />
        <span>
          {reviewedDecisions} of {review.layers.length} decisions
        </span>
      </span>
    </>
  );
  const titleInput = {
    connection: context.connection,
    reviewId: revision.reviewId,
  };
  const latestReview = Option.getOrUndefined(
    AsyncResult.value(useAtomValue(readReview(titleInput))),
  );
  const pullQuery = readReviewPullRequest(titleInput);
  const pullResult = useAtomValue(pullQuery);
  const retryPull = useAtomRefresh(pullQuery);
  const pullValue = AsyncResult.isFailure(pullResult)
    ? { kind: 'failed' as const }
    : (Option.getOrUndefined(AsyncResult.value(pullResult)) ?? {
        kind: 'loading' as const,
      });
  const pull = data.review?.pullRequest ? pullValue : undefined;
  const pullNotice = data.review?.pullRequest
    ? reviewPullRequestNotice(pull)
    : undefined;
  const title = reviewListTitle(
    data.review ?? revision,
    latestReview?.revision ?? revision,
    pull?.kind === 'available' ? pull.pullRequest.title : undefined,
  );
  const record = data.review;
  const { threads } = useComments(scope, context);
  const showPanel = () => {
    if (desktop) setPanelOpen(true);
    else setSheetOpen(true);
  };
  const togglePanel = () => {
    if (!desktop) {
      setSheetOpen((open) => !open);
      return;
    }
    if (panelOpen) railToggle.element?.focus();
    setPanelOpen((open) => !open);
  };
  const reveal = (next: () => void) => {
    next();
    setSheetOpen(false);
  };
  const names = surfaceNames(revision.content);
  const panel = (layout: 'docked' | 'sheet') => (
    <SidePanel
      layout={layout}
      surfaces={PANEL}
      names={names}
      published
      surface="changes"
      onSurface={showPanel}
    >
      {() => (
        <ReviewBoundary connection={context.connection} scope={scope}>
          <RevisionPanel
            revision={revision}
            scope={scope}
            context={context}
            marks={marks}
            activeStop={stop.key}
            onStep={(step) =>
              reveal(() => {
                setView('walkthrough');
                setFile({ path: step.pointer.path, step });
              })
            }
            file={file?.path}
            onFile={(path) =>
              reveal(() => {
                setView('walkthrough');
                setFile({ path });
              })
            }
            onChange={(path) =>
              reveal(() => {
                setView('walkthrough');
                setFile({ path, change: true });
              })
            }
            onStop={(key) => reveal(() => go(key))}
            onProof={() => reveal(() => go('briefing'))}
          />
        </ReviewBoundary>
      )}
    </SidePanel>
  );
  const page = (
    <section
      ref={(element) => scroller.attach(element)}
      aria-label="Review walkthrough"
      className="@container/review flex min-h-0 min-w-0 flex-1 flex-col overflow-auto rounded-paper border bg-card wrap-anywhere"
      style={{ containerName: 'pane review' }}
    >
      {toolbarTarget === undefined && (
        <DocumentTabs
          tabs={['handoff']}
          pinned={[]}
          active="handoff"
          reviewTitle="Review"
          reviewCount={
            <span
              aria-hidden="true"
              className="text-2xs text-muted-foreground tabular-nums"
            >
              {reviewedDecisions}/{review.layers.length}
            </span>
          }
          side={null}
          focused={active}
          leading={navigation}
          trailing={
            <>
              {bar}
              {currentScope && (
                <>
                  <span
                    aria-hidden="true"
                    className="mx-1 h-5 w-px bg-border"
                  />
                  <GitButton scope={currentScope} context={context} />
                </>
              )}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <SheetTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="xl:hidden"
                          aria-label={names.changes}
                          aria-keyshortcuts={SHORTCUTS.toggleSidebar}
                        />
                      }
                    >
                      <PanelRightIcon />
                    </SheetTrigger>
                  }
                />
                <TooltipContent>
                  {names.changes}{' '}
                  <Kbd>{formatForDisplay(SHORTCUTS.toggleSidebar)}</Kbd>
                </TooltipContent>
              </Tooltip>
            </>
          }
          onActivate={() => {}}
          onClose={() => {}}
          onCloseOthers={() => {}}
          onCloseUnpinned={() => {}}
          onTogglePin={() => {}}
        />
      )}
      {toolbarTarget && createPortal(bar, toolbarTarget)}
      {active && view === 'walkthrough' && (
        <WalkthroughKeys stops={stops} current={stop.key} onGo={go} />
      )}
      {pullNotice && (
        <div className="px-4 py-2">
          <StateNotice role="status" title={pullNotice}>
            {pull?.kind !== 'loading' && (
              <Button
                variant="outline"
                size="sm"
                disabled={pullResult.waiting}
                onClick={retryPull}
              >
                Read pull request again
              </Button>
            )}
          </StateNotice>
        </div>
      )}
      {currentScope && (
        <BranchTipNotice
          scope={currentScope}
          context={context}
          headOid={latestHead}
        />
      )}
      {AsyncResult.isFailure(seen) && (
        <div className="px-4 py-2">
          <Alert variant="destructive">
            <AlertDescription>
              This revision could not be recorded as seen.
            </AlertDescription>
            <AlertAction>
              <Button
                variant="outline"
                size="sm"
                disabled={seen.waiting}
                onClick={retrySeen}
              >
                Try again
              </Button>
            </AlertAction>
          </Alert>
        </div>
      )}
      {missingDecision && (
        <div className="px-4 pt-3">
          <StateNotice
            role="status"
            title="That decision is not in this revision."
            description="The briefing is shown below. Choose another decision or revision."
          />
        </div>
      )}
      <Suspense
        fallback={
          <p role="status" className="p-4">
            Loading review content…
          </p>
        }
      >
        {(view === 'walkthrough' || (view === 'summary' && showSummary)) && (
          <div className="flex min-w-0 flex-1 items-start">
            <WalkthroughSpine
              stops={stops}
              current={view === 'summary' ? undefined : stop.key}
              done={done}
              onGo={go}
            />
            <div className="flex min-w-0 flex-1 flex-col">
              {AsyncResult.isFailure(markResult) && (
                <p role="alert" className="p-3 text-sm">
                  Reviewed marks could not be read.{' '}
                  <Button variant="outline" size="xs" onClick={retryMarks}>
                    Try again
                  </Button>
                </p>
              )}
              {view === 'summary' &&
                expiredLink === review.summary.expires &&
                reread.failed && (
                  <StateFailure
                    description="A fresh link to the agent's page could not be read. Check the connection and try again."
                    onRetry={reread.run}
                  />
                )}
              {view === 'summary' &&
                !(expiredLink === review.summary.expires && reread.failed) && (
                  <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-8 @2xl/review:px-6">
                    <SummaryFrame
                      revision={revision}
                      page={summaryPage}
                      url={
                        expiredLink === review.summary.expires
                          ? undefined
                          : summaryUrl
                      }
                      dark={dark}
                      stops={stops}
                      done={done}
                      onGo={go}
                    />
                  </div>
                )}
              {view === 'walkthrough' && file && (
                <>
                  <Button
                    variant="ghost"
                    className="self-start"
                    onClick={() => setFile(undefined)}
                  >
                    Back to decision
                  </Button>
                  {file.change ? (
                    <RevisionCode
                      revision={revision}
                      paths={[file.path]}
                      scope={scope}
                      context={context}
                      active={active}
                      marks={marks ?? { files: [], decisions: [] }}
                    />
                  ) : (
                    <RevisionFile
                      revision={revision}
                      scope={scope}
                      context={context}
                      path={file.path}
                      step={file.step}
                      active={active}
                    />
                  )}
                </>
              )}
              {view === 'walkthrough' && !file && stop.kind === 'briefing' && (
                <WalkthroughBriefing
                  {...props}
                  revision={revision}
                  latestRevision={
                    data.review?.latestRevision ?? revision.revision
                  }
                  title={title}
                  proofCurrent={proofCurrent && revision.headOid === latestHead}
                  margin={
                    <BriefingMargin
                      data={data}
                      revision={revision}
                      context={context}
                      onRevision={onRevision}
                      onDeleted={onDeleted ?? onBack}
                      onBack={standalone ? onBack : undefined}
                    />
                  }
                  stops={stops}
                  items={items}
                  decisions={decisions}
                  done={done}
                  onGo={go}
                />
              )}
              {view === 'walkthrough' && !file && stop.kind !== 'briefing' && (
                <section
                  role="region"
                  aria-label={
                    stop.kind === 'decision'
                      ? stopTitle(stop)
                      : 'After the decisions'
                  }
                  className="flex min-w-0 flex-col"
                >
                  <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-8 @2xl/review:px-6">
                    {stop.kind === 'decision' ? (
                      <>
                        <DecisionPage
                          key={stop.key}
                          proofCurrent={
                            proofCurrent && revision.headOid === latestHead
                          }
                          stop={stop}
                          total={decisionCount}
                          review={review}
                          revision={revision}
                          scope={scope}
                          context={context}
                          decision={decisions.get(stop.layer.id)}
                          finished={done(stop)}
                          items={items}
                          onGo={go}
                          onStep={(step) =>
                            setFile({ path: step.pointer.path, step })
                          }
                        />
                        <MarginRow>
                          <RevisionCode
                            key={stop.key}
                            revision={revision}
                            paths={stop.paths}
                            scope={scope}
                            context={context}
                            active={active}
                            marks={marks ?? { files: [], decisions: [] }}
                            steps={stop.layer.steps}
                            decision
                          />
                        </MarginRow>
                      </>
                    ) : (
                      <ClosingPage
                        stops={stops}
                        current={stop}
                        revision={revision}
                        record={record}
                        items={items}
                        threads={threads}
                        pullRequest={
                          pull?.kind === 'available'
                            ? pull.pullRequest
                            : undefined
                        }
                        archivable={
                          record ? reviewArchivable(record, pull) : false
                        }
                        status={
                          record && reviewClosed(record, pull)
                            ? {
                                ...reviewListStatus({
                                  revision,
                                  marks,
                                  status: worktree?.status,
                                  pull,
                                }),
                                group: 'Closed',
                              }
                            : reviewListStatus({
                                revision,
                                marks,
                                status: worktree?.status,
                                pull,
                              })
                        }
                        scope={scope}
                        context={context}
                        onGo={go}
                        code={(section) => (
                          <RevisionCode
                            revision={revision}
                            paths={section.paths}
                            scope={scope}
                            context={context}
                            active={active && section.key === stop.key}
                            marks={marks ?? { files: [], decisions: [] }}
                            card
                            gaps={false}
                            commentLabel={
                              section.kind === 'unexplained'
                                ? 'Ask why'
                                : undefined
                            }
                          />
                        )}
                      />
                    )}
                  </div>
                  <MarginRowDock>
                    <WalkthroughDock
                      label={
                        stop.kind === 'decision'
                          ? `Decision ${stop.number} of ${decisionCount}`
                          : stopName(stop)
                      }
                      shortLabel={
                        stop.kind === 'decision'
                          ? `${stop.number} of ${decisionCount}`
                          : stopName(stop)
                      }
                      compactLabel={
                        stop.kind === 'decision'
                          ? `${stop.number}/${decisionCount}`
                          : `${stops.findIndex((item) => item.key === stop.key) + 1}/${stops.length}`
                      }
                      stops={stops}
                      current={stop.key}
                      onGo={go}
                      onPrevious={neighbour(-1)}
                      onNext={neighbour(1)}
                    >
                      {stop.kind === 'decision' ? (
                        <DecisionMark
                          revision={revision}
                          layerId={stop.layer.id}
                          fingerprint={stop.layer.fingerprint}
                          reviewed={done(stop)}
                          files={revision.files.filter((file) =>
                            stop.paths.includes(file.path),
                          )}
                          settled={AsyncResult.isSuccess(markResult)}
                          context={context}
                        />
                      ) : (
                        <FilesMark
                          revision={revision}
                          files={revision.files.filter(
                            (file) =>
                              (file.newOid ?? file.oldOid) !== undefined &&
                              stop.paths.includes(file.path) &&
                              items.find((item) => item.path === file.path)
                                ?.reviewStatus !== 'reviewed',
                          )}
                          settled={AsyncResult.isSuccess(markResult)}
                          context={context}
                        />
                      )}
                    </WalkthroughDock>
                  </MarginRowDock>
                </section>
              )}
            </div>
          </div>
        )}
      </Suspense>
    </section>
  );
  if (!standalone) return page;
  return (
    <Sheet open={sheetOpen && !desktop} onOpenChange={setSheetOpen}>
      <PanelKeys onShow={showPanel} onToggle={togglePanel} />
      <div className="flex min-h-0 min-w-0 flex-1">
        {page}
        {desktop && panelOpen && (
          <div className="ml-2 w-80 shrink-0">{panel('docked')}</div>
        )}
        {desktop && (
          <SideRail
            surfaces={PANEL}
            names={names}
            published
            surface="changes"
            open={panelOpen}
            onSelect={showPanel}
            onHide={() => setPanelOpen(false)}
            onToggle={togglePanel}
            toggleRef={(element) => railToggle.attach(element)}
          />
        )}
      </div>
      <SheetContent className="w-[min(90vw,22rem)]!" showCloseButton={false}>
        <SheetHeader className="sr-only">
          <SheetTitle>{names.changes}</SheetTitle>
          <SheetDescription>
            Readiness, changed files and comments of this review.
          </SheetDescription>
        </SheetHeader>
        {!desktop && panel('sheet')}
      </SheetContent>
    </Sheet>
  );
}

const PANEL: readonly Surface[] = ['changes'];

function PanelKeys({
  onShow,
  onToggle,
}: {
  onShow: () => void;
  onToggle: () => void;
}) {
  useHotkey(SHORTCUTS.surfaceReview, onShow, { ignoreInputs: true });
  useHotkey(SHORTCUTS.toggleSidebar, onToggle, { ignoreInputs: true });
  return null;
}

function MarginRowDock({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none sticky bottom-0 z-20 mx-auto w-full max-w-5xl px-2 pb-4 @md/review:px-4 @2xl/review:px-6">
      <MarginRow>{children}</MarginRow>
    </div>
  );
}

function blobFiles(files: ReviewRevision['files']) {
  return files.flatMap((file) => {
    const headBlobOid = file.newOid ?? file.oldOid;
    return headBlobOid ? [{ path: file.path, headBlobOid }] : [];
  });
}

function DecisionMark({
  revision,
  layerId,
  fingerprint,
  reviewed,
  settled,
  context,
  files,
}: {
  revision: ReviewRevision;
  layerId: string;
  fingerprint: string;
  reviewed: boolean;
  settled: boolean;
  context: ConnectionContext;
  files: ReviewRevision['files'];
}) {
  const commands = reviewCommands({
    connection: context.connection,
    reviewId: revision.reviewId,
  });
  const [result, mark] = useAtom(commands.completeDecision);
  const [removed, unmark] = useAtom(commands.unmark);
  return (
    <>
      <button
        type="button"
        className={cn(reviewed ? outlinePill : primaryPill, dockButtonClass)}
        aria-pressed={reviewed}
        disabled={!settled || result.waiting || removed.waiting}
        onClick={() =>
          reviewed
            ? unmark({ kind: 'decision', layerId, fingerprint })
            : mark({
                revision: revision.revision,
                layerId,
                fingerprint,
                files: blobFiles(files),
              })
        }
      >
        <CheckIcon />
        {reviewed ? 'Decision reviewed' : 'Mark decision reviewed'}
      </button>
      {(AsyncResult.isFailure(result) || AsyncResult.isFailure(removed)) && (
        <p role="alert" className="px-2 text-xs text-destructive">
          Not saved. Try again.
        </p>
      )}
    </>
  );
}

const dockButtonClass =
  'h-8 gap-1.75 pr-3.5 pl-3 text-ui leading-4 [&_svg]:size-3.5';

function FilesMark({
  revision,
  files,
  settled,
  context,
}: {
  revision: ReviewRevision;
  files: ReviewRevision['files'];
  settled: boolean;
  context: ConnectionContext;
}) {
  const commands = reviewCommands({
    connection: context.connection,
    reviewId: revision.reviewId,
  });
  const [result, mark] = useAtom(commands.markFiles);
  return (
    <>
      <button
        type="button"
        className={cn(primaryPill, dockButtonClass)}
        disabled={!settled || files.length === 0 || result.waiting}
        onClick={() =>
          mark({ revision: revision.revision, files: blobFiles(files) })
        }
      >
        <CheckIcon />
        {files.length === 0
          ? 'Every file reviewed'
          : `Mark ${files.length} ${files.length === 1 ? 'file' : 'files'} reviewed`}
      </button>
      {AsyncResult.isFailure(result) && (
        <p role="alert" className="px-2 text-xs text-destructive">
          Some files were not marked. Try again.
        </p>
      )}
    </>
  );
}

function BranchTipNotice({
  scope,
  context,
  headOid,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  headOid: string;
}) {
  const read = useBranchChanges(scope, context.connection, undefined);
  const data = Option.getOrUndefined(AsyncResult.value(read.result));
  return data && data.head.oid !== headOid ? (
    <div className="px-4 pt-3">
      <StateNotice
        role="status"
        title="The branch tip differs from this review."
        description="Publish a revision to include it."
      />
    </div>
  ) : null;
}

function WalkthroughKeys({
  stops,
  current,
  onGo,
}: {
  stops: readonly WalkthroughStop[];
  current: WalkthroughKey;
  onGo: (key: WalkthroughKey) => void;
}) {
  const step = (direction: 1 | -1) => {
    const next = neighbourStop(stops, current, direction);
    if (next) onGo(next.key);
  };
  useHotkey(SHORTCUTS.nextStop, () => step(1), { ignoreInputs: true });
  useHotkey(SHORTCUTS.previousStop, () => step(-1), { ignoreInputs: true });
  return null;
}

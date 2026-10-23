import { createPortal } from 'react-dom';
import { ListChecksIcon, FileTextIcon, PanelRightIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { refLabel } from '@porcelain/client/history/rules';
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
  stopTitle,
  walkthroughStops,
  revisionReviewItems,
  type ReviewRevision,
  type ReviewStep,
  type ReviewScope,
  type WalkthroughKey,
} from '@porcelain/client/reviews/rules';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePreferences, useTheme } from '@/features/preferences/index';
import { useBranchChanges } from '@/features/changes/index';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { reviewListTitle } from '@porcelain/client/reviews/rules';
import { bindSummaryLayerRequests } from '../adapters/summary-messages';
import { useReviewSummary } from '../queries/summary';
import { useReviewPanelOpen, useWalkthroughPlace } from '../store';
import { GitButton } from '@/features/git-actions/index';
import { DocumentTabs } from './document-tabs';
import { BriefingMargin } from './briefing-margin';
import { WalkthroughSpine } from './walkthrough-spine';
import { ReviewProof } from './review-proof';
import { WalkthroughBriefing } from './walkthrough-briefing';
import { StopBrief } from './walkthrough-stop';
import { RevisionCode, RevisionFile } from './revision-code';
import { ReviewEmpty } from './review-empty';
import { ReviewBoundary } from './review-boundary';
import { RevisionPanel } from './revision-panel';
import { SidePanel, surfaceNames } from './review-sidebar';
import { SideRail } from './side-rail';
import { useDesktopReview } from '../adapters/desktop-review';

type ReviewPageProps = {
  toolbarTarget?: HTMLElement | null | undefined;
  reviewId: string;
  navigation?: ReactNode;
  revision?: number | undefined;
  decision?: string | undefined;
  context: ConnectionContext;
  onRevision?: ((revision: number | undefined) => void) | undefined;
  onDecision?: ((revision: number, layerId: string) => void) | undefined;
  active?: boolean | undefined;
  onBack: () => void;
  onDeleted?: (() => void) | undefined;
  liveScope?: ReviewScope | undefined;
  initialView?: 'proof' | undefined;
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
  onDecision,
  onBack,
  onDeleted,
  liveScope,
  initialView,
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
  if (AsyncResult.isInitial(result))
    return (
      <p role="status" className="p-4">
        Loading review…
      </p>
    );
  if (AsyncResult.isFailure(result))
    return (
      <div className="p-4">
        <p role="alert">
          Review could not be loaded. Check the link and connection.
        </p>
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Back to workspace
        </Button>
      </div>
    );
  if (!data?.review || !data.revision)
    return (
      <div className="p-4">
        <ReviewEmpty
          title={data?.review ? 'Revision not found' : 'Review not found'}
          description="This link does not identify an available review revision."
        />
        <Button variant="outline" onClick={onBack}>
          Back to workspace
        </Button>
      </div>
    );
  return (
    <ReviewRevisionPage
      key={`${reviewId}:${data.revision.revision}:${decision ?? ''}`}
      navigation={navigation}
      toolbarTarget={toolbarTarget}
      data={data}
      revision={data.revision}
      context={context}
      decision={decision}
      latest={revision === undefined}
      onRevision={onRevision}
      onDecision={onDecision}
      onBack={onBack}
      onDeleted={onDeleted}
      liveScope={liveScope}
      initialView={initialView}
      proofCurrent={proofCurrent}
      active={active}
    />
  );
}

function ReviewRevisionPage({
  toolbarTarget,
  navigation,
  data,
  revision,
  context,
  decision,
  latest,
  onRevision,
  onDecision,
  onBack,
  onDeleted,
  liveScope,
  initialView,
  proofCurrent = true,
  active = true,
}: Omit<ReviewPageProps, 'reviewId' | 'revision'> & {
  data: DurableReviewRead;
  revision: ReviewRevision;
  latest: boolean;
}) {
  const inventory = useInventory(context.connection);
  const project = inventory.projects.find(
    (entry) => entry.id === revision.projectId,
  );
  const worktree = project?.worktrees.find(
    (entry) =>
      entry.available &&
      refLabel(entry.branch ?? '') === refLabel(revision.branch),
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
    url: summaryUrl,
    available: showSummary,
  } = useReviewSummary(scope, context, review.summary);
  useAtomMount(
    observeReviewSeen({
      connection: context.connection,
      reviewId: revision.reviewId,
      revision: revision.revision,
    }),
  );
  const seen = useAtomValue(
    observeReviewSeen({
      connection: context.connection,
      reviewId: revision.reviewId,
      revision: revision.revision,
    }),
  );
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
  const [view, setView] = useState<'walkthrough' | 'summary' | 'proof'>(
    initialView ?? 'walkthrough',
  );
  const [file, setFile] = useState<{ path: string; step?: ReviewStep }>();
  const standalone = toolbarTarget === undefined;
  const desktop = useDesktopReview();
  const { open: panelOpen, setOpen: setPanelOpen } = useReviewPanelOpen(
    revision.reviewId,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const railToggle = useElement<HTMLButtonElement>();
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
  const go = (key: WalkthroughKey) => {
    setChosen(key);
    place.setPlace(key);
    setView('walkthrough');
    setFile(undefined);
    const layer = review.layers.find((entry) => decisionKey(entry.id) === key);
    if (layer) onDecision?.(revision.revision, layer.id);
    else if (onDecision) onRevision?.(revision.revision);
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
      if (document.kind === 'proof') setView('proof');
      else if (document.path) setFile({ path: document.path });
    },
  };
  const presentation = (
    <Tabs
      className="shrink-0"
      value={view}
      onValueChange={(value: unknown) => {
        if (value === 'walkthrough' || value === 'summary') {
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
        <span
          role="progressbar"
          aria-label="Files reviewed"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={reviewedFiles}
          className="h-1 w-16 overflow-hidden rounded-full bg-muted"
        >
          <span
            className="block h-full bg-primary"
            style={{
              width: `${items.length === 0 ? 0 : (reviewedFiles / items.length) * 100}%`,
            }}
          />
        </span>
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
  const pull = Option.getOrUndefined(
    AsyncResult.value(useAtomValue(readReviewPullRequest(titleInput))),
  );
  const title = reviewListTitle(
    data.review ?? revision,
    latestReview?.revision ?? revision,
    pull?.kind === 'available' ? pull.pullRequest.title : undefined,
  );
  const record = data.review;
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
            file={file?.path}
            onFile={(path) =>
              reveal(() => {
                setView('walkthrough');
                setFile({ path });
              })
            }
            onStop={(key) => reveal(() => go(key))}
            onProof={() =>
              reveal(() => {
                setView('proof');
                setFile(undefined);
              })
            }
          />
        </ReviewBoundary>
      )}
    </SidePanel>
  );
  const page = (
    <section
      aria-label="Review walkthrough"
      className="@container/review flex min-h-0 min-w-0 flex-1 flex-col overflow-auto rounded-xl border bg-card"
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
                <TooltipTrigger render={<span className="inline-flex" />}>
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
                </TooltipTrigger>
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
      <header className="flex shrink-0 flex-col gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            Back
          </Button>
          <span className="flex-1" />
          <Badge variant="outline">{record?.state ?? 'open'}</Badge>
        </div>
        <h1
          aria-label="Review"
          className="min-w-0 text-sm font-semibold break-words"
        >
          {record?.pullRequest && (
            <>
              <a
                href={record.pullRequest}
                target="_blank"
                rel="noopener noreferrer"
              >
                PR #{record.pullRequest.split('/').filter(Boolean).at(-1)}
              </a>
              {' · '}
            </>
          )}
        </h1>
      </header>
      {currentScope && (
        <BranchTipNotice
          scope={currentScope}
          context={context}
          headOid={latestHead}
        />
      )}
      {AsyncResult.isFailure(seen) && (
        <p role="status" className="px-4 py-2 text-sm">
          This revision could not be recorded as seen.
        </p>
      )}
      {missingDecision && (
        <p role="status" className="border-b px-4 py-3 text-sm">
          That decision is not in this revision. The briefing is shown below.
          Choose another decision or revision.
        </p>
      )}
      <Tabs
        value={view}
        onValueChange={(value: unknown) => {
          if (
            value === 'walkthrough' ||
            value === 'summary' ||
            value === 'proof'
          ) {
            setView(value);
            setFile(undefined);
          }
        }}
      >
        <TabsList
          className="flex h-auto flex-wrap"
          aria-label="Review details"
          aria-busy={AsyncResult.isInitial(summary) || summary.waiting}
        >
          {!showSummary && (
            <TabsTrigger value="walkthrough">Walkthrough</TabsTrigger>
          )}
          <TabsTrigger value="proof">Proof</TabsTrigger>
        </TabsList>
      </Tabs>
      <Suspense
        fallback={
          <p role="status" className="p-4">
            Loading review content…
          </p>
        }
      >
        {view === 'walkthrough' && (
          <>
            <div className="flex min-w-0 flex-1 items-start">
              <WalkthroughSpine
                stops={stops}
                current={stop.key}
                done={done}
                onGo={go}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                {stop.kind !== 'briefing' && (
                  <nav
                    aria-label="Walkthrough navigation"
                    className="flex flex-wrap gap-2 border-b p-3 @2xl/review:hidden"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => go('briefing')}
                    >
                      Open the briefing
                    </Button>
                    {stops
                      .filter((item) => item.kind !== 'briefing')
                      .map((item) => (
                        <Button
                          key={item.key}
                          variant={
                            item.key === stop.key ? 'secondary' : 'ghost'
                          }
                          size="xs"
                          className="h-auto max-w-full whitespace-normal"
                          onClick={() => go(item.key)}
                        >
                          {stopTitle(item)}
                        </Button>
                      ))}
                  </nav>
                )}
                {AsyncResult.isFailure(markResult) && (
                  <p role="alert" className="p-3 text-sm">
                    Reviewed marks could not be read.{' '}
                    <Button variant="outline" size="xs" onClick={retryMarks}>
                      Try again
                    </Button>
                  </p>
                )}
                {file ? (
                  <>
                    <Button
                      variant="ghost"
                      className="self-start"
                      onClick={() => setFile(undefined)}
                    >
                      Back to decision
                    </Button>
                    <RevisionFile
                      revision={revision}
                      scope={scope}
                      context={context}
                      path={file.path}
                      step={file.step}
                      active={active}
                    />
                  </>
                ) : null}
                {!file && stop.kind === 'briefing' && (
                  <WalkthroughBriefing
                    {...props}
                    revision={revision}
                    title={title}
                    proofCurrent={
                      proofCurrent && revision.headOid === latestHead
                    }
                    margin={
                      <BriefingMargin
                        data={data}
                        revision={revision}
                        latest={latest}
                        context={context}
                        onRevision={onRevision}
                        onDeleted={onDeleted ?? onBack}
                      />
                    }
                    stops={stops}
                    items={items}
                    decisions={decisions}
                    done={done}
                    onGo={go}
                  />
                )}
                {!file && stop.kind !== 'briefing' && (
                  <section
                    role="region"
                    aria-label={stopTitle(stop)}
                    className="flex flex-col"
                  >
                    <StopBrief
                      stop={stop}
                      stops={stops}
                      review={review}
                      decision={
                        stop.kind === 'decision'
                          ? decisions.get(stop.layer.id)
                          : undefined
                      }
                      finished={done(stop)}
                      onGo={go}
                      onStep={(step) =>
                        setFile({ path: step.pointer.path, step })
                      }
                    />
                    {stop.kind === 'decision' && (
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
                    )}
                    <RevisionCode
                      key={stop.key}
                      revision={revision}
                      paths={stop.paths}
                      scope={scope}
                      context={context}
                      active={active}
                      marks={marks ?? { files: [], decisions: [] }}
                      steps={stop.kind === 'decision' ? stop.layer.steps : []}
                    />
                  </section>
                )}
              </div>
            </div>
          </>
        )}
        {view === 'proof' && (
          <div className="p-4">
            <ReviewProof
              revision={revision}
              scope={scope}
              context={context}
              current={proofCurrent && revision.headOid === latestHead}
              title="Proof"
            />
          </div>
        )}
        {view === 'summary' && showSummary && (
          <iframe
            ref={(frame) =>
              frame
                ? bindSummaryLayerRequests(frame, (number) => {
                    const layer = review.layers[number - 1];
                    if (layer) go(decisionKey(layer.id));
                  })
                : undefined
            }
            title="Review summary"
            src={`${summaryUrl}#theme=${dark ? 'dark' : 'light'}`}
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
            referrerPolicy="no-referrer"
            className="min-h-96 w-full flex-1 border-0"
          />
        )}
      </Suspense>
    </section>
  );
  if (!standalone) return page;
  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
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
        {panel('sheet')}
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
    <div className="px-4 pb-4">
      <Button
        variant="outline"
        size="sm"
        aria-pressed={reviewed}
        disabled={!settled || result.waiting || removed.waiting}
        onClick={() =>
          reviewed
            ? unmark({ kind: 'decision', layerId, fingerprint })
            : mark({
                revision: revision.revision,
                layerId,
                fingerprint,
                files: files.flatMap((file) => {
                  const headBlobOid = file.newOid ?? file.oldOid;
                  return headBlobOid ? [{ path: file.path, headBlobOid }] : [];
                }),
              })
        }
      >
        {reviewed ? 'Decision reviewed' : 'Mark decision reviewed'}
      </Button>
      {(AsyncResult.isFailure(result) || AsyncResult.isFailure(removed)) && (
        <p role="alert" className="text-sm text-destructive">
          The decision mark could not be updated. Try again.
        </p>
      )}
    </div>
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
    <p
      role="status"
      className="border-b px-4 py-2 text-sm text-muted-foreground"
    >
      The branch tip differs from this review. Publish a revision to include it.
    </p>
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

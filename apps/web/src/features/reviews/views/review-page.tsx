import { refLabel } from '@porcelain/client/history/rules';
import { useHotkey } from '@tanstack/react-hotkeys';
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
import { desktopAppAddress } from '@/shared/adapters/desktop';
import {
  publishedLabel,
  reviewSummaryUrl,
} from '@porcelain/client/reviews/rules';
import { bindSummaryLayerRequests } from '../adapters/summary-messages';
import { useWalkthroughPlace } from '../store';
import { ReviewVerdict } from './review-verdict';
import { WalkthroughBriefing } from './walkthrough-briefing';
import { StopBrief } from './walkthrough-stop';
import { RevisionCode, RevisionFile } from './revision-code';
import { ReviewActions } from './review-actions';
import { ReviewComments } from './review-comments';
import { ReviewEmpty } from './review-empty';
import { ProofList } from './proof-list';

type ReviewPageProps = {
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
  const [view, setView] = useState<
    'walkthrough' | 'summary' | 'comments' | 'proof'
  >(initialView ?? 'walkthrough');
  const [file, setFile] = useState<{ path: string; step?: ReviewStep }>();
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
  const record = data.review;
  return (
    <section
      aria-label="Review walkthrough"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto rounded-xl border bg-card"
    >
      {active && view === 'walkthrough' && (
        <WalkthroughKeys stops={stops} current={stop.key} onGo={go} />
      )}
      <header className="flex shrink-0 flex-col gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          {navigation}
          <Button variant="ghost" size="sm" onClick={onBack}>
            Back
          </Button>
          <span className="flex-1" />
          <Badge variant="outline">{record?.state ?? 'open'}</Badge>
          <ReviewActions
            reviewId={revision.reviewId}
            state={record?.state ?? 'open'}
            context={context}
            onDeleted={onDeleted ?? onBack}
          />
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
          {revision.branch} → {refLabel(revision.base)} ·{' '}
          <span className="font-mono whitespace-nowrap">
            {revision.headOid.slice(0, 7)}
          </span>
        </h1>
        <nav
          aria-label="Review revisions"
          className="flex w-full flex-wrap gap-1"
        >
          {data.revisions.map((entry) => (
            <Button
              key={entry.revision}
              size="xs"
              variant={
                !latest && entry.revision === revision.revision
                  ? 'secondary'
                  : 'ghost'
              }
              aria-pressed={!latest && entry.revision === revision.revision}
              onClick={() => onRevision?.(entry.revision)}
              disabled={!onRevision}
            >
              r{entry.revision}
            </Button>
          ))}
          <Button
            size="xs"
            variant={latest ? 'secondary' : 'ghost'}
            aria-pressed={latest}
            onClick={() => onRevision?.(undefined)}
            disabled={!onRevision}
          >
            latest
          </Button>
        </nav>
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
      <ReviewVerdict
        revision={revision}
        scope={scope}
        context={context}
        onStart={(id) => go(decisionKey(id))}
      />
      <Tabs
        value={view}
        onValueChange={(value: unknown) => {
          if (
            value === 'walkthrough' ||
            value === 'summary' ||
            value === 'comments' ||
            value === 'proof'
          ) {
            setView(value);
            setFile(undefined);
          }
        }}
      >
        <TabsList
          className="flex h-auto flex-wrap"
          aria-label="Review presentation"
        >
          <TabsTrigger value="walkthrough">Walkthrough</TabsTrigger>
          {review.summary.byteLength > 0 && (
            <TabsTrigger value="summary">Agent summary</TabsTrigger>
          )}
          <TabsTrigger value="proof">Proof</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
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
            <nav
              aria-label="Walkthrough progress"
              className="flex flex-wrap gap-1 border-b p-3"
            >
              <span className="text-xs text-muted-foreground">
                ·{' '}
                {
                  stops.filter((item) => item.kind === 'decision' && done(item))
                    .length
                }{' '}
                of {review.layers.length} decisions
              </span>
              <Button
                size="xs"
                variant="ghost"
                aria-label="Open the briefing"
                onClick={() => go('briefing')}
              >
                Briefing
              </Button>
              {stops
                .filter((item) => item.kind !== 'briefing')
                .map((item) => (
                  <Button
                    key={item.key}
                    size="xs"
                    variant={item.key === stop.key ? 'secondary' : 'ghost'}
                    className="h-auto max-w-full text-left whitespace-normal"
                    aria-pressed={item.key === stop.key}
                    onClick={() => go(item.key)}
                  >
                    {stopTitle(item)}
                    {done(item) ? ' ✓' : ''}
                  </Button>
                ))}
            </nav>
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
                  onStep={(step) => setFile({ path: step.pointer.path, step })}
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
          </>
        )}
        {view === 'proof' && (
          <section aria-label="Proof" className="p-4">
            <h2 className="mb-2 text-sm font-semibold">Proof</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Published {publishedLabel(revision.publishedAt)} · at{' '}
              {revision.headOid.slice(0, 7)}
            </p>
            {!proofCurrent && (
              <p role="status" className="mb-3 text-sm">
                These checks ran before the latest changes
              </p>
            )}
            {review.proof.checks.some((check) => check.result === 'fail') && (
              <div role="alert" className="mb-3 text-sm text-destructive">
                <p>
                  {
                    review.proof.checks.filter(
                      (check) => check.result === 'fail',
                    ).length
                  }{' '}
                  check failed
                </p>
                <p>The agent reported this work as not passing yet.</p>
              </div>
            )}
            <ProofList
              scope={scope}
              context={context}
              proof={review.proof}
              layers={review.layers}
            />
          </section>
        )}
        {view === 'comments' && (
          <ReviewComments
            scope={scope}
            context={context}
            revision={revision}
            onReveal={(path) => {
              setFile({ path });
              setView('walkthrough');
            }}
          />
        )}
        {view === 'summary' && review.summary.byteLength > 0 && (
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
            src={`${reviewSummaryUrl(review.summary, context.connection.address, desktopAppAddress())}#theme=${dark ? 'dark' : 'light'}`}
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
            referrerPolicy="no-referrer"
            className="min-h-96 w-full flex-1 border-0"
          />
        )}
      </Suspense>
    </section>
  );
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

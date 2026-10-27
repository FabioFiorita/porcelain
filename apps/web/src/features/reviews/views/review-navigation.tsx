import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileDiffIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { ReviewStatusIcon, ROW } from './change-row';
import { TruncatedText } from '@/shared/views/truncated-text';
import { useAtom, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  readReview,
  readReviewMarks,
  reviewCommands,
} from '@porcelain/client/reviews';
import {
  filesReviewed,
  revisionDecisionStates,
  revisionReviewItems,
  reviewSidebarActions,
  stopDone,
  stopName,
  walkthroughStops,
  type ReviewResponse,
  type ReviewRevision,
  type ReviewMarks,
  type ReviewStep,
  type WalkthroughKey,
} from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { useSpecsApart } from '@/features/preferences/index';
import { useWalkthroughPlace, useReviewRevisionSelection } from '../store';
import { type OpenDocument, ALL_CHANGES } from '../rules/documents';
import { SidebarDocumentRow } from './sidebar-section';
import { SidebarActionMenu } from './sidebar-action-menu';

export function ReviewNavigation({
  review,
  context,
  onOpen,
  activeEntry,
}: {
  review: ReviewResponse;
  context: ConnectionContext;
  onOpen: OpenDocument;
  activeEntry: string | undefined;
}) {
  if (!review.reviewId) return null;
  return (
    <PublishedNavigation
      reviewId={review.reviewId}
      revision={review.revision}
      context={context}
      onOpen={onOpen}
      activeEntry={activeEntry}
    />
  );
}
function PublishedNavigation({
  reviewId,
  revision,
  context,
  onOpen,
  activeEntry,
}: {
  reviewId: string;
  revision: number;
  context: ConnectionContext;
  onOpen: OpenDocument;
  activeEntry: string | undefined;
}) {
  const { connection } = context;
  const result = useAtomValue(readReview({ connection, reviewId }));
  const markResult = useAtomValue(readReviewMarks({ connection, reviewId }));
  const data = Option.getOrUndefined(AsyncResult.value(result));
  const marks = Option.getOrUndefined(AsyncResult.value(markResult));
  const place = useWalkthroughPlace(`${reviewId}:${revision}`);
  const selection = useReviewRevisionSelection(reviewId);
  if (!data?.revision)
    return (
      <SidebarDocumentRow
        label="Open review"
        active={activeEntry === 'handoff'}
        onOpen={() => onOpen({ kind: 'handoff' })}
      >
        Open review
      </SidebarDocumentRow>
    );
  const snapshot = data.revision;
  const open = (key: string) => {
    selection.choose(undefined);
    place.setPlace(key);
    onOpen({ kind: 'handoff' });
  };
  return (
    <RevisionNavigation
      revision={snapshot}
      marks={marks}
      context={context}
      activeStop={activeEntry === 'handoff' ? place.place : undefined}
      onStop={open}
      onStep={(step) => {
        const owner = snapshot.content.layers.find((layer) =>
          layer.steps.some((entry) => entry.id === step.id),
        );
        if (owner) place.setPlace(`decision:${owner.id}`);
        selection.choose(snapshot.revision, step.id);
        onOpen({ kind: 'handoff' });
      }}
      allChanges={{
        active: activeEntry === 'all-changes',
        onOpen: () => onOpen(ALL_CHANGES),
      }}
    />
  );
}

export function RevisionNavigation({
  revision,
  marks,
  context,
  activeStop,
  onStop,
  onStep,
  allChanges,
}: {
  revision: ReviewRevision;
  marks: ReviewMarks | undefined;
  context: ConnectionContext;
  activeStop: string | undefined;
  onStop: (key: WalkthroughKey) => void;
  onStep: (step: ReviewStep) => void;
  allChanges?: { active: boolean; onOpen: () => void };
}) {
  const commands = reviewCommands({
    connection: context.connection,
    reviewId: revision.reviewId,
  });
  const [completed, complete] = useAtom(commands.completeDecision);
  const [unmarked, unmark] = useAtom(commands.unmark);
  const specsApart = useSpecsApart(context.connection);
  const stops = walkthroughStops(
    revision.content,
    revision.files.map((file) => file.path),
    { specsApart },
  );
  const items = revisionReviewItems(revision, marks);
  const decisions = revisionDecisionStates(revision, marks);
  return (
    <nav aria-label="Walkthrough" className="flex min-w-0 flex-col text-ui">
      {stops.map((stop) => {
        const reviewed = stopDone(stop, items, decisions);
        const active = activeStop === stop.key;
        const progress = filesReviewed(stop.paths, items);
        const files = items.filter((file) => stop.paths.includes(file.path));
        return (
          <div key={stop.key} className="min-w-0">
            <SidebarActionMenu
              label={
                stop.kind === 'decision'
                  ? `More actions for decision ${stop.number}`
                  : `More actions for ${stopName(stop)}`
              }
              {...(stop.kind === 'decision'
                ? { description: stop.layer.title }
                : {})}
              actions={reviewSidebarActions(
                stop.kind === 'decision'
                  ? {
                      kind: 'decision',
                      reviewed,
                      stale: false,
                      settled: marks !== undefined,
                      pending: completed.waiting || unmarked.waiting,
                      files,
                    }
                  : { kind: 'section' },
              )}
              onAction={(id) => {
                if (id === 'open') onStop(stop.key);
                if (id === 'review' && stop.kind === 'decision') {
                  if (reviewed)
                    unmark({
                      kind: 'decision',
                      layerId: stop.layer.id,
                      fingerprint: stop.layer.fingerprint,
                    });
                  else
                    complete({
                      revision: revision.revision,
                      layerId: stop.layer.id,
                      fingerprint: stop.layer.fingerprint,
                      files: files.flatMap((file) =>
                        file.fingerprint
                          ? [{ path: file.path, headBlobOid: file.fingerprint }]
                          : [],
                      ),
                    });
                }
              }}
            >
              {(menu) => (
                <div className="flex min-w-0 items-center">
                  <button
                    type="button"
                    className={cn(
                      ROW,
                      'h-7 flex-1 gap-2 px-1 text-ui focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-muted aria-pressed:font-semibold',
                    )}
                    aria-label={
                      stop.kind === 'decision'
                        ? `${reviewed ? '✓' : stop.number} ${stopName(stop)} ${progress.reviewed}/${progress.total}`
                        : undefined
                    }
                    aria-pressed={active}
                    aria-expanded={
                      stop.kind === 'decision' ? active : undefined
                    }
                    onClick={() => onStop(stop.key)}
                  >
                    {stop.kind === 'decision' && (
                      <span
                        className={cn(
                          'flex size-4.5 shrink-0 items-center justify-center rounded-full border text-2xs tabular-nums',
                          active && 'border-brand text-brand',
                          reviewed &&
                            'border-brand bg-brand text-brand-foreground',
                        )}
                      >
                        {reviewed ? (
                          <CheckIcon className="size-3" />
                        ) : (
                          stop.number
                        )}
                      </span>
                    )}
                    <TruncatedText
                      className="min-w-0 flex-1 text-left"
                      text={stopName(stop)}
                    />
                    {stop.kind !== 'decision' &&
                      stop.kind !== 'briefing' &&
                      progress.total > 0 && (
                        <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
                          {progress.reviewed}/{progress.total}
                        </span>
                      )}
                    {stop.kind === 'decision' &&
                      (active ? (
                        <ChevronDownIcon className="size-3 shrink-0" />
                      ) : (
                        <ChevronRightIcon className="size-3 shrink-0" />
                      ))}
                  </button>
                  {menu}
                </div>
              )}
            </SidebarActionMenu>
            {stop.kind === 'decision' && active && (
              <ol
                aria-label={`Stops of decision ${stop.number}`}
                className="my-1 min-w-0 pl-6"
              >
                {stop.layer.steps.map((step, index) => (
                  <li key={step.id} className="min-w-0">
                    <TruncatedText
                      text={`${step.title} · ${step.pointer.path}`}
                      renderTrigger={(_, clip) => (
                        <button
                          type="button"
                          className={cn(ROW, 'h-7 text-ui')}
                          onClick={() => onStep(step)}
                        >
                          {step.kind === 'changed' ? (
                            <ReviewStatusIcon
                              status={
                                items.find(
                                  (item) => item.path === step.pointer.path,
                                )?.reviewStatus
                              }
                            />
                          ) : (
                            <span className="size-3.5 shrink-0" />
                          )}
                          <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
                            {index + 1}
                          </span>
                          {clip(step.title, 'flex-1 text-left')}
                        </button>
                      )}
                    />
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
      {(AsyncResult.isFailure(completed) ||
        AsyncResult.isFailure(unmarked)) && (
        <p role="alert" className="p-2 text-caption text-destructive">
          The review mark could not be updated.
        </p>
      )}
      {allChanges && (
        <SidebarDocumentRow
          label="All changes"
          active={allChanges.active}
          onOpen={allChanges.onOpen}
        >
          <FileDiffIcon aria-hidden className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 text-left">All changes</span>
          <span
            aria-hidden
            className="shrink-0 text-caption text-muted-foreground tabular-nums"
          >
            {revision.files.length}{' '}
            {revision.files.length === 1 ? 'file' : 'files'}
          </span>
        </SidebarDocumentRow>
      )}
    </nav>
  );
}

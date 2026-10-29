import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileQuestionIcon,
  FilesIcon,
  FlaskConicalIcon,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
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
  decisionCodeMoved,
  filesReviewed,
  revisionDecisionStates,
  revisionReviewItems,
  reviewSidebarActions,
  stepMarker,
  stopDone,
  stopName,
  walkthroughStops,
  type StepMarker,
  type ReviewResponse,
  type ReviewRevision,
  type ReviewMarks,
  type ReviewStep,
  type WalkthroughKey,
} from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { useSpecsApart } from '@/features/preferences/index';
import {
  useWalkthroughPlace,
  useReviewRevisionSelection,
  useReviewFileOrigins,
} from '../store';
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
  const origins = useReviewFileOrigins(reviewId, revision);
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
        origins.choose(step.pointer.path, step.id);
        onOpen({
          kind: 'review-file',
          reviewId: snapshot.reviewId,
          revision: snapshot.revision,
          path: step.pointer.path,
        });
      }}
      allChanges={{
        active: activeEntry === 'all-changes',
        onOpen: () => onOpen(ALL_CHANGES),
      }}
    />
  );
}

const STOP_ROW =
  'flex h-7 w-full min-w-0 items-center gap-2 rounded-md pr-1.5 pl-1 text-left text-ui leading-4.5 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring';

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
  const [marked, mark] = useAtom(commands.mark);
  const specsApart = useSpecsApart(context.connection);
  const stops = walkthroughStops(
    revision.content,
    revision.files.map((file) => file.path),
    { specsApart },
  );
  const items = revisionReviewItems(revision, marks);
  const decisions = revisionDecisionStates(revision, marks);
  const pending = completed.waiting || unmarked.waiting || marked.waiting;
  const decisionStops = stops.filter((stop) => stop.kind === 'decision');
  const closing = stops.filter(
    (stop) => stop.kind === 'unexplained' || stop.kind === 'specs',
  );
  const toggleFile = (path: string) => {
    const item = items.find((file) => file.path === path);
    if (!item?.fingerprint) return;
    if (item.reviewStatus === 'reviewed')
      unmark({ kind: 'file', path, headBlobOid: item.fingerprint });
    else
      mark({
        kind: 'file',
        revision: revision.revision,
        path,
        headBlobOid: item.fingerprint,
      });
  };
  return (
    <nav aria-label="Walkthrough" className="flex min-w-0 flex-col text-ui">
      <div className="flex min-w-0 flex-col gap-px">
        {decisionStops.map((stop) => {
          const reviewed = stopDone(stop, items, decisions);
          const active = activeStop === stop.key;
          const progress = filesReviewed(stop.paths, items);
          const files = items.filter((file) => stop.paths.includes(file.path));
          const moved = decisionCodeMoved(stop.layer);
          return (
            <div key={stop.key} className="min-w-0">
              <SidebarActionMenu
                label={`More actions for decision ${stop.number}`}
                description={stop.layer.title}
                actions={reviewSidebarActions({
                  kind: 'decision',
                  reviewed,
                  stale: false,
                  settled: marks !== undefined,
                  pending,
                  files,
                })}
                onAction={(id) => {
                  if (id === 'open') onStop(stop.key);
                  if (id === 'review') {
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
                            ? [
                                {
                                  path: file.path,
                                  headBlobOid: file.fingerprint,
                                },
                              ]
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
                        STOP_ROW,
                        'flex-1',
                        reviewed && !active && 'text-muted-foreground',
                        active && 'bg-muted inset-ring inset-ring-border',
                      )}
                      aria-label={`${reviewed ? '✓' : stop.number} ${stopName(stop)}${moved ? ' code moved' : ''} ${progress.reviewed}/${progress.total}`}
                      aria-pressed={active}
                      aria-expanded={active}
                      onClick={() => onStop(stop.key)}
                    >
                      <DecisionMark
                        number={stop.number}
                        reviewed={reviewed}
                        active={active}
                      />
                      <span className="flex min-w-0 flex-1 items-baseline gap-2">
                        <TruncatedText
                          className={cn(
                            'min-w-0 text-left',
                            active && 'font-semibold',
                          )}
                          text={stopName(stop)}
                        />
                        {moved && <StepTag text="code moved" tone="warn" />}
                      </span>
                      {active ? (
                        <ChevronDownIcon
                          aria-hidden
                          className="size-3 shrink-0 text-muted-foreground"
                        />
                      ) : (
                        <ChevronRightIcon
                          aria-hidden
                          className="size-3 shrink-0 text-muted-foreground"
                        />
                      )}
                    </button>
                    {menu}
                  </div>
                )}
              </SidebarActionMenu>
              {active && (
                <ol
                  aria-label={`Stops of decision ${stop.number}`}
                  className="mt-0.5 mb-1 min-w-0"
                >
                  {stop.layer.steps.map((step, index) => {
                    const item = items.find(
                      (file) => file.path === step.pointer.path,
                    );
                    const marker = stepMarker(step);
                    return (
                      <li
                        key={step.id}
                        className="flex h-7 min-w-0 items-center gap-2 pl-7.5"
                      >
                        {item?.fingerprint ? (
                          <FileCheck
                            path={step.pointer.path}
                            checked={item.reviewStatus === 'reviewed'}
                            disabled={pending || marks === undefined}
                            onToggle={() => toggleFile(step.pointer.path)}
                          />
                        ) : (
                          <span aria-hidden className="size-3.5 shrink-0" />
                        )}
                        <TruncatedText
                          text={`${step.title} · ${step.pointer.path}`}
                          renderTrigger={(_, clip) => (
                            <button
                              type="button"
                              className={cn(STOP_ROW, 'flex-1')}
                              onClick={() => onStep(step)}
                            >
                              <span className="w-2.5 shrink-0 text-right text-xs leading-4.5 font-medium text-muted-foreground tabular-nums">
                                {index + 1}
                              </span>
                              {clip(step.title, 'min-w-0')}
                              {marker && (
                                <StepTag
                                  text={marker.text}
                                  tone={marker.tone}
                                />
                              )}
                            </button>
                          )}
                        />
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          );
        })}
      </div>
      {(AsyncResult.isFailure(completed) ||
        AsyncResult.isFailure(unmarked) ||
        AsyncResult.isFailure(marked)) && (
        <p role="alert" className="p-2 text-caption text-destructive">
          The review mark could not be updated.
        </p>
      )}
      {(closing.length > 0 || allChanges) && (
        <div className="mt-1.5 flex min-w-0 flex-col gap-px border-t pt-1.5">
          {closing
            .filter((stop) => stop.kind === 'unexplained')
            .map((stop) => (
              <ClosingRow
                key={stop.key}
                label={stopName(stop)}
                icon={FileQuestionIcon}
                count={filesCount(stop.paths, items)}
                active={activeStop === stop.key}
                onOpen={() => onStop(stop.key)}
              />
            ))}
          {allChanges && (
            <ClosingRow
              label="All changes"
              icon={FilesIcon}
              count={`${revision.files.length} ${revision.files.length === 1 ? 'file' : 'files'}`}
              active={allChanges.active}
              onOpen={allChanges.onOpen}
            />
          )}
          {closing
            .filter((stop) => stop.kind === 'specs')
            .map((stop) => (
              <ClosingRow
                key={stop.key}
                label="Open all specs"
                icon={FlaskConicalIcon}
                count={filesCount(stop.paths, items)}
                active={activeStop === stop.key}
                onOpen={() => onStop(stop.key)}
              />
            ))}
        </div>
      )}
    </nav>
  );
}

function filesCount(
  paths: readonly string[],
  items: ReturnType<typeof revisionReviewItems>,
) {
  const progress = filesReviewed(paths, items);
  return progress.total > 0
    ? `${progress.reviewed}/${progress.total}`
    : undefined;
}

function DecisionMark({
  number,
  reviewed,
  active,
}: {
  number: number;
  reviewed: boolean;
  active: boolean;
}) {
  if (reviewed)
    return (
      <span
        aria-hidden
        className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground"
      >
        <CheckIcon strokeWidth={3} className="size-2.5" />
      </span>
    );
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-4.5 shrink-0 items-center justify-center rounded-full text-3xs leading-none tabular-nums',
        active
          ? 'border border-brand bg-background font-semibold text-brand'
          : 'border border-border-strong font-medium text-muted-foreground',
      )}
    >
      {number}
    </span>
  );
}

function StepTag({ text, tone }: StepMarker) {
  return (
    <span
      className={cn(
        'shrink-0 text-xs leading-4',
        tone === 'warn' ? 'font-medium text-warn' : 'text-muted-foreground',
      )}
    >
      {text}
    </span>
  );
}

function FileCheck({
  path,
  checked,
  disabled,
  onToggle,
}: {
  path: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`${path} reviewed`}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'flex size-3.5 shrink-0 items-center justify-center rounded-check border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50',
        checked
          ? 'border-brand bg-brand text-brand-foreground'
          : 'border-border-strong bg-background',
      )}
    >
      {checked && <CheckIcon aria-hidden className="size-2.5" />}
    </button>
  );
}

function ClosingRow({
  label,
  icon: Icon,
  count,
  active,
  onOpen,
}: {
  label: string;
  icon: LucideIcon;
  count: string | undefined;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <SidebarDocumentRow
      label={label}
      active={active}
      onOpen={onOpen}
      className={cn(
        'flex h-7 w-full min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-left text-ui leading-4.5 font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring',
        active && 'bg-muted inset-ring inset-ring-border',
      )}
    >
      <Icon
        strokeWidth={1.75}
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground"
      />
      <TruncatedText className="min-w-0 flex-1" text={label} />
      {count && (
        <span
          aria-hidden
          className="shrink-0 text-xs leading-4 font-normal text-muted-foreground tabular-nums"
        >
          {count}
        </span>
      )}
      <ChevronRightIcon
        aria-hidden
        className="size-3 shrink-0 text-muted-foreground"
      />
    </SidebarDocumentRow>
  );
}

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
  revisionDecisionStates,
  filesReviewed,
  revisionReviewItems,
  reviewSidebarActions,
  stopDone,
  stopName,
  walkthroughStops,
  type ReviewResponse,
} from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { usePreferences } from '@/features/preferences/index';
import { useWalkthroughPlace, useReviewRevisionSelection } from '../store';
import { type OpenDocument, ALL_CHANGES } from '../rules/documents';
import { SidebarDocumentRow } from './sidebar-section';
import { SidebarActionMenu } from './sidebar-action-menu';
import { Button } from '@/components/ui/button';

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
  const commands = reviewCommands({ connection, reviewId });
  const [completed, complete] = useAtom(commands.completeDecision);
  const [unmarked, unmark] = useAtom(commands.unmark);
  const place = useWalkthroughPlace(`${reviewId}:${revision}`);
  const selection = useReviewRevisionSelection(reviewId);
  const { preferences } = usePreferences();
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
  const stops = walkthroughStops(
    snapshot.content,
    snapshot.files.map((file) => file.path),
    { specsApart: preferences.collapseSpecs },
  );
  const items = revisionReviewItems(snapshot, marks);
  const decisions = revisionDecisionStates(snapshot, marks);
  const open = (key: string) => {
    selection.choose(undefined);
    place.setPlace(key);
    onOpen({ kind: 'handoff' });
  };
  return (
    <nav aria-label="Walkthrough" className="flex flex-col">
      {stops.map((stop) => {
        const reviewed = stopDone(stop, items, decisions);
        const progress = filesReviewed(stop.paths, items);
        const files = items.filter((file) => stop.paths.includes(file.path));
        return (
          <SidebarActionMenu
            key={stop.key}
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
                    settled: AsyncResult.isSuccess(markResult),
                    pending: completed.waiting || unmarked.waiting,
                    files,
                  }
                : { kind: 'section' },
            )}
            onAction={(id) => {
              if (id === 'open') open(stop.key);
              if (id === 'review' && stop.kind === 'decision') {
                if (reviewed)
                  unmark({
                    kind: 'decision',
                    layerId: stop.layer.id,
                    fingerprint: stop.layer.fingerprint,
                  });
                else
                  complete({
                    revision: snapshot.revision,
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-w-0 flex-1 justify-start"
                  aria-pressed={
                    activeEntry === 'handoff' && place.place === stop.key
                  }
                  onClick={() => open(stop.key)}
                >
                  {stop.kind === 'decision' && (
                    <span>{reviewed ? '✓' : stop.number}</span>
                  )}
                  <TruncatedText text={stopName(stop)} />
                  {stop.kind !== 'briefing' && (
                    <span className="text-xs text-muted-foreground">
                      {progress.reviewed}/{progress.total}
                    </span>
                  )}
                </Button>
                {menu}
              </div>
            )}
          </SidebarActionMenu>
        );
      })}
      {(AsyncResult.isFailure(completed) ||
        AsyncResult.isFailure(unmarked)) && (
        <p role="alert" className="p-2 text-xs text-destructive">
          The review mark could not be updated.
        </p>
      )}
      <SidebarDocumentRow
        label="All changes"
        active={activeEntry === 'all-changes'}
        onOpen={() => onOpen(ALL_CHANGES)}
      >
        All changes
      </SidebarDocumentRow>
    </nav>
  );
}

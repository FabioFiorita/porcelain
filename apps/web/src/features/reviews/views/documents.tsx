import { AsyncResult } from 'effect/reactivity';
import { FileIcon, GitGraphIcon, HistoryIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CommitGraph, FileTimeline } from '@/features/history/index';
import { DiscardButton } from '@/features/git-actions/index';
import { useChanges } from '@/features/changes/index';
import { usePublishedReview } from '../queries/published-review';
import { usePrefetchReviewed, useReviewChangeItems } from '../queries/reviewed';
import type { RevealComment } from '@porcelain/client/reviews/rules';
import {
  type DocumentInteraction,
  type DocumentRef,
  entryKey,
  type OpenDocument,
} from '../rules/documents';
import { decisionNotes, gapNotes, mergeNotes } from '../rules/code-notes';
import {
  isSpecPath,
  stopTitle,
  walkthroughStops,
} from '@porcelain/client/reviews/rules';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import { BranchDocument, BranchFileDocument } from './branch-document';
import { CommitDocument } from './commit-document';
import { DocumentToolbar } from './document-toolbar';
import { FileDocument } from './file-document';
import { ProofDocument } from './proof-document';
import { ReviewCodeDocument } from './review-code-document';
import { MarkAllReviewed } from './reviewed-control';
import { ReviewEmpty } from './review-empty';
import { ReviewWalkthrough } from './review-walkthrough';
import { usePreferences } from '@/features/preferences/index';
import { type ConnectionContext } from '@/shared/workspace/connection';

type DocumentProps = {
  scope: ReviewScope;
  context: ConnectionContext;
  interaction: DocumentInteraction;
  onOpen: OpenDocument;
};

export function DocumentView({
  scope,
  context,
  document,
  onOpen,
  active = false,
  reveal,
  base,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  document: DocumentRef;
  onOpen: OpenDocument;
  active?: boolean;
  reveal?: RevealComment | undefined;
  base?: string | undefined;
}) {
  const props = {
    scope,
    context,
    onOpen,
    interaction: {
      active,
      worktreeId: scope.worktreeId,
      entry: entryKey(document),
      reveal,
    },
  };
  switch (document.kind) {
    case 'handoff':
      return <HandoffDocument {...props} />;
    case 'all-changes':
      return <PlainChangesDocument {...props} />;
    case 'specs':
      return <PlainChangesDocument {...props} specsOnly />;
    case 'proof':
      return <ProofDocument scope={scope} context={context} />;
    case 'change':
      return <ChangeDocument {...props} path={document.path} />;
    case 'file':
      return <FileDocument {...props} path={document.path} />;
    case 'commit':
      return <CommitDocument {...props} oid={document.oid} />;
    case 'branch':
      return <BranchDocument {...props} base={base} />;
    case 'branch-file':
      return <BranchFileDocument {...props} base={base} path={document.path} />;
    case 'timeline':
      return <TimelineDocument {...props} path={document.path} />;
    case 'graph':
      return <GraphDocument {...props} />;
  }
}

function GraphDocument({ scope, context, onOpen }: DocumentProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DocumentToolbar
        title={
          <span className="flex min-w-0 items-center gap-1.5">
            <GitGraphIcon className="size-4 shrink-0" />
            <span className="truncate">Commit graph</span>
          </span>
        }
        subtitle="Commits on this branch with their merges and refs"
      />
      <div className="min-h-0 flex-1 overflow-auto">
        <CommitGraph
          scope={scope}
          connection={context.connection}
          onSelect={(oid) => onOpen({ kind: 'commit', oid })}
        />
      </div>
    </div>
  );
}

function TimelineDocument({
  scope,
  context,
  path,
  onOpen,
}: DocumentProps & { path: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DocumentToolbar
        titleLabel={`Timeline of ${path}`}
        title={
          <span className="flex min-w-0 items-center gap-1.5">
            <HistoryIcon className="size-4 shrink-0" />
            <span className="truncate">{path}</span>
          </span>
        }
        subtitle="Commits that changed this file"
      />
      <div className="min-h-0 flex-1 overflow-auto">
        <FileTimeline
          scope={scope}
          connection={context.connection}
          path={path}
          onSelect={(commit) =>
            onOpen(
              { kind: 'commit', oid: commit.oid },
              {
                kind: 'file',
                filePath: commit.path,
                revision: commit.oid,
                comparison: { kind: 'commit', parent: 1 },
              },
            )
          }
        />
      </div>
    </div>
  );
}

function HandoffDocument(props: DocumentProps) {
  const published = usePublishedReview(props.scope, props.context);
  const review = published.review;
  if (AsyncResult.isInitial(published.result))
    return (
      <p role="status" className="p-4 text-sm">
        Loading review…
      </p>
    );
  if (AsyncResult.isFailure(published.result))
    return <PublicationFailure retry={published.refresh} />;
  if (review?.active)
    return (
      <ReviewWalkthrough
        {...props}
        review={review}
        onRefresh={published.refresh}
        address={props.context.connection.address}
      />
    );
  return <PlainChangesDocument {...props} />;
}

function PlainChangesDocument({
  scope,
  context,
  interaction,
  specsOnly = false,
}: DocumentProps & { specsOnly?: boolean }) {
  const { connection } = context;
  usePrefetchReviewed(scope, context);
  const { preferences } = usePreferences();
  const list = useChanges(scope, connection);
  const allChanges = useReviewChangeItems(scope, context, list);
  const published = usePublishedReview(scope, context);
  const review =
    !specsOnly && published.review?.active ? published.review : undefined;
  const changes = specsOnly
    ? allChanges.filter((item) => isSpecPath(item.path))
    : allChanges;
  const story = review
    ? walkthroughStops(
        review,
        list.changes.map((change) => change.path),
        { specsApart: preferences.collapseSpecs },
      ).flatMap((stop) =>
        stop.paths.map((path) => ({
          path,
          note: stopTitle(stop),
        })),
      )
    : [];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReviewCodeDocument
        scope={scope}
        context={context}
        interaction={interaction}
        {...(specsOnly ? { paths: changes.map((item) => item.path) } : {})}
        {...(review
          ? {
              files: story,
              agentNotes: mergeNotes(
                ...review.layers.map((layer, index) =>
                  decisionNotes(layer, index + 1),
                ),
                gapNotes(review.notExplained),
              ),
            }
          : {})}
        toolbar={(collapseControl) => (
          <DocumentToolbar
            title={(() => {
              if (specsOnly) {
                return 'Specs';
              }
              if (interaction.entry === 'all-changes') {
                return 'All changes';
              }
              return 'Changes';
            })()}
            subtitle={`${changes.length} files`}
          >
            {collapseControl}
            <MarkAllReviewed
              scope={scope}
              context={context}
              entries={changes}
            />
          </DocumentToolbar>
        )}
      />
    </div>
  );
}

function ChangeDocument({
  scope,
  context,
  interaction,
  onOpen,
  path,
}: DocumentProps & { path: string }) {
  const { connection } = context;
  usePrefetchReviewed(scope, context);
  const list = useChanges(scope, connection);
  const change = useReviewChangeItems(scope, context, list, [path]).find(
    (entry) => entry.path === path,
  );
  if (!change)
    return (
      <ReviewEmpty
        title="Change no longer present"
        description="Choose a change that is still present in the current review."
      />
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DiscardButton
        scope={scope}
        context={context}
        path={path}
        variant="quiet"
      >
        {(trigger) => (
          <ReviewCodeDocument
            {...(interaction.reveal?.compose
              ? { commentRequest: interaction.reveal.nonce }
              : {})}
            headerActions={
              <>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onOpen({ kind: 'file', path })}
                >
                  <FileIcon />
                  <span className="max-narrow:sr-only">Open file</span>
                </Button>
                {trigger}
              </>
            }
            scope={scope}
            context={context}
            interaction={interaction}
            paths={[path]}
          />
        )}
      </DiscardButton>
    </div>
  );
}

function PublicationFailure({ retry }: { retry: () => void }) {
  return (
    <div className="flex flex-col items-center p-4">
      <ReviewEmpty
        title="Review could not be loaded"
        description="The saved publication could not be read."
      />
      <Button variant="outline" onClick={retry}>
        Retry review
      </Button>
    </div>
  );
}

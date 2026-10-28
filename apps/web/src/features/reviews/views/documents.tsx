import { TruncatedText } from '@/shared/views/truncated-text';
import { FileIcon, HistoryIcon } from 'lucide-react';
import { BarAction } from '@/shared/workspace/bar-action';
import { Button } from '@/components/ui/button';
import { CommitGraph, FileTimeline } from '@/features/history/index';
import { DiscardButton } from '@/features/git-actions/index';
import { useChanges } from '@/features/changes/index';
import { useInventory } from '@/features/projects/index';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
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
import { ReviewCodeDocument } from './review-code-document';
import { MarkAllReviewed } from './reviewed-control';
import { formatForDisplay } from '@tanstack/react-hotkeys';
import { Kbd } from '@/components/ui/kbd';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { StateNotice } from '@/shared/views/state-notice';
import { BranchReviewPage } from './branch-review-page';
import { useSpecsApart } from '@/features/preferences/index';
import { type ConnectionContext } from '@/shared/workspace/connection';

type DocumentProps = {
  scope: ReviewScope;
  context: ConnectionContext;
  interaction: DocumentInteraction;
  onOpen: OpenDocument;
  sideLabel: string;
  onBrowse: (surface: 'files' | 'history', trigger: HTMLButtonElement) => void;
};

export function DocumentView({
  scope,
  context,
  document,
  onOpen,
  onBrowse,
  sideLabel,
  active = false,
  reveal,
  base,
  toolbarTarget,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  document: DocumentRef;
  toolbarTarget?: HTMLElement | null | undefined;
  onOpen: OpenDocument;
  sideLabel: string;
  onBrowse: DocumentProps['onBrowse'];
  active?: boolean;
  reveal?: RevealComment | undefined;
  base?: string | undefined;
}) {
  const props = {
    scope,
    context,
    onOpen,
    onBrowse,
    sideLabel,
    interaction: {
      toolbarTarget,
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

function GraphDocument({ scope, context, onOpen, sideLabel }: DocumentProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <CommitGraph
          scope={scope}
          connection={context.connection}
          sideLabel={sideLabel}
          onSelect={(oid, toSide) =>
            onOpen({ kind: 'commit', oid }, undefined, {
              toSide: toSide === true,
            })
          }
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
  sideLabel,
}: DocumentProps & { path: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DocumentToolbar
        titleLabel={`Timeline of ${path}`}
        title={
          <span className="flex min-w-0 items-center gap-1.5">
            <HistoryIcon className="size-4 shrink-0" />
            <TruncatedText text={path} />
          </span>
        }
        subtitle="Commits that changed this file"
      />
      <div className="min-h-0 flex-1 overflow-auto">
        <FileTimeline
          scope={scope}
          connection={context.connection}
          path={path}
          sideLabel={sideLabel}
          onSelect={(commit, toSide) =>
            onOpen(
              { kind: 'commit', oid: commit.oid },
              {
                kind: 'file',
                filePath: commit.path,
                revision: commit.oid,
                comparison: { kind: 'commit', parent: 1 },
              },
              { toSide: toSide === true },
            )
          }
        />
      </div>
    </div>
  );
}

function HandoffDocument(props: DocumentProps) {
  const published = usePublishedReview(props.scope, props.context);
  if (published.review?.reviewId)
    return (
      <BranchReviewPage
        {...props}
        toolbarTarget={props.interaction.toolbarTarget}
        active={props.interaction.active}
      />
    );
  return (
    <PlainChangesDocument
      {...props}
      intro={
        Option.isSome(AsyncResult.value(published.result)) && !published.review
      }
    />
  );
}

function NoReviewIntro({
  scope,
  context,
  branch,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  branch: string | undefined;
}) {
  const project = useInventory(context.connection).projects.find(
    (entry) => entry.id === scope.projectId,
  );
  const place = [branch, project?.name].filter(Boolean).join(' · ');
  return (
    <header className="flex min-w-0 flex-col px-4 pt-8 pb-6">
      {place && (
        <div className="text-ui leading-5.5 font-medium text-muted-foreground">
          <TruncatedText text={place} className="block min-w-0" />
        </div>
      )}
      <h2 className="text-4xl not-first:mt-3.5 font-semibold tracking-[-0.04em]">
        No review yet
      </h2>
      <p className="mt-4 max-w-180 text-lg leading-7 tracking-[-0.005em] text-foreground-2">
        The agent has not published a review for this worktree. Ask it to
        publish one (it calls{' '}
        <code className="font-mono text-base leading-7 text-foreground">
          publish_review
        </code>{' '}
        through Porcelain&rsquo;s MCP server), or read the changes below.
      </p>
    </header>
  );
}

function changesTitle(specsOnly: boolean, entry: string) {
  if (specsOnly) return 'Specs';
  if (entry === 'all-changes') return 'All changes';
  return 'Changes';
}

function PlainChangesDocument({
  scope,
  context,
  interaction,
  onBrowse,
  specsOnly = false,
  intro = false,
}: DocumentProps & { specsOnly?: boolean; intro?: boolean }) {
  const { connection } = context;
  usePrefetchReviewed(scope, context);
  const specsApart = useSpecsApart(context.connection);
  const list = useChanges(scope, connection);
  const allChanges = useReviewChangeItems(scope, context, list);
  const published = usePublishedReview(scope, context);
  const review =
    !specsOnly && published.review?.active ? published.review : undefined;
  const changes = specsOnly
    ? allChanges.filter((item) => isSpecPath(item.path))
    : allChanges;
  if (!specsOnly && changes.length === 0)
    return (
      <StateNotice
        title="No changes to review"
        description={
          <>
            <span className="font-mono text-foreground">
              {list.branch?.name ?? 'This worktree'}
            </span>{' '}
            matches its last commit. Browse files or history from the right.
          </>
        }
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={(event) => onBrowse('files', event.currentTarget)}
        >
          Files <Kbd>{formatForDisplay(SHORTCUTS.surfaceFiles)}</Kbd>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(event) => onBrowse('history', event.currentTarget)}
        >
          History <Kbd>{formatForDisplay(SHORTCUTS.surfaceHistory)}</Kbd>
        </Button>
      </StateNotice>
    );
  const story = review
    ? walkthroughStops(
        review,
        list.changes.map((change) => change.path),
        { specsApart: specsApart },
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
        {...(intro
          ? {
              header: () => (
                <NoReviewIntro
                  scope={scope}
                  context={context}
                  branch={list.branch?.name}
                />
              ),
            }
          : {})}
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
            target={interaction.toolbarTarget}
            barActions={null}
            title={changesTitle(specsOnly, interaction.entry)}
            subtitle={`${changes.length} file${changes.length === 1 ? '' : 's'}`}
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
      <StateNotice
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
              <BarAction
                label="Timeline"
                icon={HistoryIcon}
                onClick={() => onOpen({ kind: 'timeline', path })}
              />
            }
            headerLeading={
              <>
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label="Open file"
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

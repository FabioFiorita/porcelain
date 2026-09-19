import { formatDistanceToNowStrict } from 'date-fns';
import { Check, FileDiff, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  Diagram,
  ReviewResponse,
  SummaryMessage,
} from '../../contracts/review';
import { entryKey, REVIEW } from '../../domain/documents';
import {
  fileProgress,
  layerProgress,
  listChanges,
  type ReviewScope,
} from '../../domain/review';
import { useComments } from '../../query/comments';
import { useMarks } from '../../query/marks';
import { useChanges, useReview } from '../../query/review';
import {
  CodeDocument,
  CollapseAllButton,
  type RevealRequest,
} from './code-document';
import { DiscardButton } from './discard';
import { ProgressPill } from './document-parts';
import { DocumentToolbar } from './document-toolbar';
import { HtmlFrame } from './html-frame';
import { useMarkActions } from './review-actions';
import { type Graph, type GraphBox, ReviewDiagram } from './review-diagram';
import type { OpenDocument } from './review-workspace';
import { type ChangeRequest, useChangeEntries } from './use-change-entries';
import { useCollapsedFiles } from './use-collapsed-files';

export type DocumentProps = {
  scope: ReviewScope;
  onOpen: OpenDocument;
  reveal: RevealRequest | null;
  /** Whether this document is in the focused pane. */
  active: boolean;
};

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * The `review` tab. With a review it is the agent's summary page, or the diagram
 * Porcelain draws from it; without one it is plain Changes, and nothing mentions
 * a review.
 */
export function OverviewDocument(props: DocumentProps) {
  const review = useReview(props.scope);
  return review == null ? (
    <ChangesOverview {...props} />
  ) : (
    <ReviewOverview {...props} review={review} />
  );
}

/** Every changed file with its diff (a card for binary files), a tick per file and Mark all reviewed. */
function ChangesOverview({ scope, active, reveal, onOpen }: DocumentProps) {
  const marks = useMarks(scope);
  const threads = useComments(scope);
  const actions = useMarkActions(scope, marks);
  const collapse = useCollapsedFiles({
    worktreeId: scope.worktreeId,
    documentKey: entryKey(REVIEW),
  });
  const { changes } = useChanges(scope);
  const listed = useMemo(() => listChanges(changes), [changes]);
  const requests = useMemo<ChangeRequest[]>(
    () => listed.map((file) => ({ path: file.path })),
    [listed],
  );
  const { entries, binaries } = useChangeEntries(scope, requests);
  // Conflicted files have no diff and nothing to tick until their markers are gone.
  const conflicted = listed
    .filter((file) => file.change.scope === 'unmerged')
    .map((file) => file.path);
  const paths = listed
    .filter((file) => file.change.scope !== 'unmerged')
    .map((file) => file.path);
  const progress = fileProgress(paths, marks);
  const allDone = progress.total > 0 && progress.done === progress.total;
  const tickable = [...binaries, ...entries];

  if (changes.length === 0) {
    return (
      <div className="grid flex-1 place-items-center p-8">
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <FileDiff className="size-6 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>No changes</EmptyTitle>
            <EmptyDescription>
              This worktree matches its last commit. Browse its files or history
              on the right.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DocumentToolbar
        title="Changes"
        subtitle={`${plural(listed.length, 'file')}${conflicted.length > 0 ? ` · ${conflicted.length} conflicted` : ''}`}
      >
        <ProgressPill {...progress} label="files reviewed" />
        <CollapseAllButton
          collapse={collapse}
          entries={entries}
          marks={marks}
          collapseReviewed
        />
        <Button
          size="sm"
          variant="outline"
          disabled={tickable.length === 0 || actions.isPending}
          onClick={() => actions.setFiles(tickable, !allDone)}
        >
          <Check className="size-3.5" />
          {allDone ? 'Unmark all' : 'Mark all reviewed'}
        </Button>
      </DocumentToolbar>
      {conflicted.length > 0 && (
        <ConflictedFiles paths={conflicted} onOpen={onOpen} />
      )}
      <CodeDocument
        hotkeysEnabled={active}
        scope={scope}
        entries={entries}
        binaries={binaries}
        threads={threads}
        commentable
        marks={marks}
        collapseReviewed
        collapse={collapse}
        onToggleReviewed={actions.toggleFile}
        renderFileActions={(path) => (
          <DiscardButton scope={scope} path={path} variant="icon" />
        )}
        reveal={reveal}
      />
    </div>
  );
}

/** Git stopped on these files; fixing them happens in the file, not in a diff. */
function ConflictedFiles({
  paths,
  onOpen,
}: {
  paths: readonly string[];
  onOpen: DocumentProps['onOpen'];
}) {
  return (
    <div className="flex shrink-0 flex-col gap-1 border-b bg-amber-500/10 px-3.5 py-2 text-[12.5px] text-amber-800 dark:text-amber-200">
      <p className="flex items-center gap-2">
        <TriangleAlert className="size-3.5 shrink-0" />
        Git stopped on{' '}
        {paths.length === 1 ? 'a conflict' : `${paths.length} conflicts`}:
        remove the markers, then commit. The Git button says how to back out.
      </p>
      {paths.map((path) => (
        <div key={path} className="flex items-center gap-2 pl-5.5">
          <span className="min-w-0 flex-1 truncate font-mono text-[12px]">
            {path}
          </span>
          <Button
            size="xs"
            variant="outline"
            onClick={() => onOpen({ kind: 'file', path })}
          >
            Open file
          </Button>
        </div>
      ))}
    </div>
  );
}

function ReviewOverview({
  scope,
  onOpen,
  review,
}: DocumentProps & { review: ReviewResponse }) {
  const marks = useMarks(scope);
  const [view, setView] = useState<'summary' | 'graph'>('summary');
  const [moment, setMoment] = useState<'after' | 'before'>('after');
  const progress = layerProgress(review.layers, marks);
  const diagram = review.diagram;
  const showing = view === 'graph' && diagram != null ? 'graph' : 'summary';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DocumentToolbar
        title="Review"
        subtitle={`${plural(review.layers.length, 'layer')} · published ${formatDistanceToNowStrict(new Date(review.publishedAt), { addSuffix: true })}`}
      >
        <ProgressPill {...progress} label="layers reviewed" />
        {showing === 'graph' && diagram?.before != null && (
          <Tabs
            value={moment}
            onValueChange={(value) => setMoment(value as typeof moment)}
          >
            <TabsList className="h-7">
              <TabsTrigger value="after" className="px-2 text-xs">
                After
              </TabsTrigger>
              <TabsTrigger value="before" className="px-2 text-xs">
                Before
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {diagram != null && (
          <Tabs
            value={showing}
            onValueChange={(value) => setView(value as typeof view)}
          >
            <TabsList className="h-7">
              <TabsTrigger value="summary" className="px-2 text-xs">
                Summary
              </TabsTrigger>
              <TabsTrigger value="graph" className="px-2 text-xs">
                Graph
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </DocumentToolbar>
      {showing === 'graph' && diagram != null ? (
        <OverviewGraph
          review={review}
          diagram={
            moment === 'before' && diagram.before != null
              ? diagram.before
              : diagram.after
          }
          moment={
            moment === 'before' && diagram.before != null ? 'before' : 'after'
          }
          onOpen={onOpen}
        />
      ) : (
        <SummaryFrame review={review} onOpen={onOpen} />
      )}
    </div>
  );
}

/**
 * The agent's HTML page filling the pane, from its own signed link, in the
 * sandbox (no same-origin). A `#layer-N` link inside it posts
 * `{ source: 'porcelain-summary', openLayer: N }`; only messages from this frame
 * are read, and N must name a layer.
 */
function SummaryFrame({
  review,
  onOpen,
}: {
  review: ReviewResponse;
  onOpen: OpenDocument;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const { layers } = review;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (frame.current == null || event.source !== frame.current.contentWindow)
        return;
      const data = event.data as Partial<SummaryMessage> | null;
      if (
        data?.source !== 'porcelain-summary' ||
        typeof data.openLayer !== 'number'
      )
        return;
      const layer = layers[data.openLayer - 1];
      if (layer != null) onOpen({ kind: 'layer', layerId: layer.id });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [layers, onOpen]);

  return (
    <HtmlFrame
      frameRef={frame}
      src={review.summary.url}
      title="The agent’s summary"
      className="min-h-0 flex-1"
    />
  );
}

function OverviewGraph({
  review,
  diagram,
  moment,
  onOpen,
}: {
  review: ReviewResponse;
  diagram: Diagram;
  moment: 'after' | 'before';
  onOpen: OpenDocument;
}) {
  const layerIds = useMemo(
    () => new Set(review.layers.map((layer) => layer.id)),
    [review.layers],
  );
  const graph = useMemo<Graph>(
    () => ({
      lanes: diagram.lanes,
      arrows: diagram.arrows,
      boxes: diagram.boxes.map(
        (box): GraphBox => ({
          ...box,
          clickable: box.layerId != null && layerIds.has(box.layerId),
        }),
      ),
    }),
    [diagram, layerIds],
  );
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <p className="pointer-events-none absolute top-3 left-4 z-10 max-w-[calc(100%-2rem)] rounded-md bg-card/90 px-2 py-1 text-[11.5px] text-muted-foreground">
        {moment === 'after'
          ? 'How it works now. Badges say what is new or changed; click a box to open the layer that builds it.'
          : 'How it worked before. Red notes are what was wrong.'}
      </p>
      <ReviewDiagram
        key={moment}
        graph={graph}
        onBoxClick={(box) =>
          box.layerId != null && onOpen({ kind: 'layer', layerId: box.layerId })
        }
      />
    </div>
  );
}

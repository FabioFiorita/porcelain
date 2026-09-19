import {
  Check,
  FileDiff,
  FileQuestion,
  ListTree,
  MessageSquare,
  Newspaper,
  RotateCw,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { ReviewLayer, ReviewResponse } from '../../contracts/review';
import {
  type CommentThread,
  currentLines,
  onRevision,
  threadPath,
} from '../../domain/comments';
import {
  type DocumentRef,
  entryKey,
  REVIEW,
  UNEXPLAINED,
} from '../../domain/documents';
import {
  basename,
  fileProgress,
  fileState,
  type ListedChange,
  layerCommitted,
  layerProgress,
  layerState,
  listChanges,
  type Marks,
  notExplainedLabel,
  type ReviewScope,
  type ReviewState,
} from '../../domain/review';
import { useComments } from '../../query/comments';
import { useMarks } from '../../query/marks';
import { useChanges, useReview } from '../../query/review';
import { CommentsList } from './comments-list';
import { FileTypeIcon } from './file-type-icon';
import { useMarkActions } from './review-actions';
import type { OpenDocument } from './review-workspace';

type Props = {
  scope: ReviewScope;
  activeEntry: string | undefined;
  onOpen: OpenDocument;
};

const ROW =
  'flex w-full min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[12.5px] transition-colors hover:bg-accent';

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

/** The first surface: the agent's review (or the plain list of changes), and every comment thread. */
export function ReviewIndex({ scope, activeEntry, onOpen }: Props) {
  const [view, setView] = useState<'index' | 'comments'>('index');
  const threads = useComments(scope);
  const review = useReview(scope);
  const open = threads.filter((thread) => !thread.resolved).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-2 pt-2">
        <Tabs
          value={view}
          onValueChange={(value) => setView(value as typeof view)}
        >
          <TabsList className="h-8 w-full">
            <TabsTrigger value="index" className="flex-1 text-xs">
              {review != null ? 'Layers' : 'Changed files'}
            </TabsTrigger>
            <TabsTrigger value="comments" className="flex-1 gap-1.5 text-xs">
              Comments
              {open > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 min-w-4 px-1 text-[10px]"
                >
                  {open}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {view === 'comments' ? (
        <CommentsList scope={scope} onOpen={onOpen} />
      ) : review != null ? (
        <LayersIndex
          scope={scope}
          review={review}
          threads={threads}
          activeEntry={activeEntry}
          onOpen={onOpen}
        />
      ) : (
        <ChangesIndex
          scope={scope}
          threads={threads}
          activeEntry={activeEntry}
          onOpen={onOpen}
        />
      )}
    </div>
  );
}

/** A tick's state as a small icon: reviewed, changed since, or a dot for not yet. */
function TickIcon({ state }: { state: ReviewState }) {
  return (
    <span className="grid w-3.5 shrink-0 place-items-center">
      {state === 'reviewed' ? (
        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : state === 'stale' ? (
        <RotateCw className="size-3 text-amber-600 dark:text-amber-400" />
      ) : (
        <span className="size-1.5 rounded-full bg-foreground/70" />
      )}
    </span>
  );
}

function OpenCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      className="flex shrink-0 items-center gap-0.5 text-[10.5px] text-muted-foreground"
      title={`${plural(count, 'open thread')}`}
    >
      <MessageSquare className="size-3" />
      {count}
    </span>
  );
}

/** Open worktree threads whose lines sit inside one of the layer's steps. */
function layerThreads(
  layer: ReviewLayer,
  threads: readonly CommentThread[],
): number {
  return threads.filter((thread) => {
    if (thread.resolved || !onRevision(thread.anchor, undefined)) return false;
    const path = threadPath(thread);
    const lines = currentLines(thread);
    if (path == null || lines == null) return false;
    return layer.steps.some(
      (step) =>
        step.pointer.path === path &&
        step.location.state !== 'changed' &&
        lines.startLine <= step.location.endLine &&
        lines.endLine >= step.location.startLine,
    );
  }).length;
}

function LayersIndex({
  review,
  threads,
  activeEntry,
  onOpen,
  scope,
}: Omit<Props, 'onOpen'> & {
  review: ReviewResponse;
  threads: readonly CommentThread[];
  onOpen: OpenDocument;
}) {
  const marks = useMarks(scope);
  const progress = layerProgress(review.layers, marks);
  const isActive = (ref: DocumentRef) => activeEntry === entryKey(ref);

  return (
    <div className="min-h-0 flex-1 overflow-auto p-2">
      <button
        type="button"
        onClick={() => onOpen(REVIEW)}
        className={cn(ROW, 'mb-1 py-1.5', isActive(REVIEW) && 'bg-accent')}
      >
        <Newspaper className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium">Summary</span>
        <span className="ml-auto truncate text-[11px] text-muted-foreground">
          From the agent
        </span>
      </button>

      <div className="mt-2 mb-1 flex items-center gap-2 px-2">
        <span className="text-[11px] font-medium text-muted-foreground">
          Layers
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
          {progress.done}/{progress.total} layers reviewed
        </span>
      </div>
      <Progress
        aria-label="Layers reviewed"
        value={
          progress.total === 0 ? 0 : (progress.done / progress.total) * 100
        }
        className="mx-2 mb-2 w-auto"
      />

      {review.layers.map((layer, index) => {
        const ref: DocumentRef = { kind: 'layer', layerId: layer.id };
        const committed = layerCommitted(layer);
        const state = layerState(marks, layer);
        return (
          <button
            type="button"
            key={layer.id}
            title={layer.summary}
            onClick={() => onOpen(ref)}
            className={cn(
              ROW,
              'items-start py-1.5',
              isActive(ref) && 'bg-accent',
              committed && 'text-muted-foreground',
            )}
          >
            <span className="mt-px grid size-4.5 shrink-0 place-items-center rounded bg-muted text-[10px] text-muted-foreground tabular-nums">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block truncate font-medium',
                  committed && 'font-normal',
                )}
              >
                {layer.title}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {committed ? 'Committed' : plural(layer.steps.length, 'step')}
              </span>
            </span>
            <span className="mt-0.5 flex shrink-0 items-center gap-1.5">
              <OpenCount count={layerThreads(layer, threads)} />
              {!committed && <TickIcon state={state} />}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => onOpen(UNEXPLAINED)}
        className={cn(
          ROW,
          'mt-2 border-t pt-2',
          isActive(UNEXPLAINED) && 'bg-accent',
        )}
      >
        <FileQuestion className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">
          <span className="font-medium">Not explained</span>
          <span className="text-muted-foreground">
            {' · '}
            {notExplainedLabel(review.notExplained) ?? 'nothing'}
          </span>
        </span>
      </button>
    </div>
  );
}

function ChangesIndex({
  scope,
  threads,
  activeEntry,
  onOpen,
}: Props & { threads: readonly CommentThread[] }) {
  const { changes } = useChanges(scope);
  const marks = useMarks(scope);
  const actions = useMarkActions(scope, marks);
  const listed = listChanges(changes);
  // A conflicted file has nothing to review until its markers are gone: no tick, it opens the file.
  const files = listed
    .filter((file) => file.change.scope !== 'unmerged')
    .map((file) => ({ path: file.path, fingerprint: file.change.fingerprint }));
  const progress = fileProgress(
    files.map((file) => file.path),
    marks,
  );
  const allDone = progress.total > 0 && progress.done === progress.total;
  const isActive = (ref: DocumentRef) => activeEntry === entryKey(ref);

  if (changes.length === 0) {
    return (
      <div className="grid flex-1 place-items-center p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <ListTree className="size-5 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>No changes</EmptyTitle>
            <EmptyDescription>
              This worktree matches its last commit.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const openThreads = (path: string) =>
    threads.filter(
      (thread) =>
        !thread.resolved &&
        onRevision(thread.anchor, undefined) &&
        threadPath(thread) === path,
    ).length;

  return (
    <div className="min-h-0 flex-1 overflow-auto p-2">
      <button
        type="button"
        onClick={() => onOpen(REVIEW)}
        className={cn(ROW, 'py-1.5', isActive(REVIEW) && 'bg-accent')}
      >
        <FileDiff className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium">All changes</span>
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
          {progress.done} of {progress.total} reviewed
        </span>
      </button>
      <div className="mt-1.5 mb-2 px-2">
        <Progress
          aria-label="Files reviewed"
          value={
            progress.total === 0 ? 0 : (progress.done / progress.total) * 100
          }
        />
        <Button
          size="sm"
          variant="outline"
          className="mt-2 h-7 w-full text-xs"
          disabled={actions.isPending}
          onClick={() => actions.setFiles(files, !allDone)}
        >
          <Check className="size-3.5" />
          {allDone ? 'Unmark all' : 'Mark all reviewed'}
        </Button>
      </div>

      {listed.map((file) => (
        <ChangeRow
          key={file.path}
          file={file}
          marks={marks}
          active={isActive({ kind: 'change', path: file.path })}
          threads={openThreads(file.path)}
          onOpen={() =>
            onOpen({
              kind: file.change.scope === 'unmerged' ? 'file' : 'change',
              path: file.path,
            })
          }
          onTick={() =>
            actions.toggleFile({
              path: file.path,
              fingerprint: file.change.fingerprint,
            })
          }
        />
      ))}
    </div>
  );
}

function ChangeRow({
  file,
  marks,
  active,
  threads,
  onOpen,
  onTick,
}: {
  file: ListedChange;
  marks: Marks;
  active: boolean;
  threads: number;
  onOpen: () => void;
  onTick: () => void;
}) {
  const { path, staged } = file;
  const state = fileState(marks, path);
  const conflicted = file.change.scope === 'unmerged';
  return (
    <div className={cn(ROW, 'p-0 pr-2', active && 'bg-accent text-foreground')}>
      {conflicted ? (
        <span
          className="ml-1 grid size-5 shrink-0 place-items-center text-amber-600"
          title="Conflicted: resolve its markers, then commit"
        >
          <TriangleAlert className="size-3.5" />
        </span>
      ) : (
        <button
          type="button"
          aria-pressed={state === 'reviewed'}
          aria-label={
            state === 'reviewed' ? `Unmark ${path}` : `Mark ${path} reviewed`
          }
          title={
            state === 'stale'
              ? 'Changed since you reviewed it'
              : state === 'reviewed'
                ? 'Reviewed'
                : 'Mark reviewed'
          }
          onClick={onTick}
          className={cn(
            'ml-1 grid size-5 shrink-0 place-items-center rounded-full border transition-colors',
            state === 'reviewed' &&
              'border-emerald-600 bg-emerald-600 text-white',
            state === 'stale' && 'border-amber-500 text-amber-600',
            state === 'unreviewed' &&
              'text-muted-foreground hover:border-foreground',
          )}
        >
          {state === 'reviewed' ? (
            <Check className="size-3" strokeWidth={3} />
          ) : state === 'stale' ? (
            <RotateCw className="size-3" />
          ) : null}
        </button>
      )}
      <button
        type="button"
        title={path}
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left"
      >
        <FileTypeIcon path={path} className="size-3.5 shrink-0" />
        <span
          className={cn(
            'truncate',
            active ? 'text-foreground' : 'text-muted-foreground',
            state === 'reviewed' &&
              'line-through decoration-muted-foreground/40',
          )}
        >
          {basename(path)}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {conflicted && (
            <span className="text-[10.5px] text-amber-700 dark:text-amber-300">
              conflicted
            </span>
          )}
          {staged != null && (
            <span
              className="text-[10.5px] text-muted-foreground"
              title={
                staged === 'all'
                  ? 'Staged (git add)'
                  : 'Partly staged: some edits are not in the index yet'
              }
            >
              staged
            </span>
          )}
          <OpenCount count={threads} />
        </span>
      </button>
    </div>
  );
}

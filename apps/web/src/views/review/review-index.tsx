import {
  CheckIcon,
  FileTextIcon,
  ListTreeIcon,
  MessageSquareIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { CommentAnchor, CommentThread } from '../../domain/comments';
import type { DocumentRef } from '../../domain/documents';
import { entryKey } from '../../domain/documents';
import {
  type Artifact,
  basename,
  changePath,
  type Layers,
  type ReviewEvidenceItem,
  type ReviewScope,
  type ReviewStatus,
  reviewProgress,
  type Status,
} from '../../domain/review';
import { useComments } from '../../query/comments';
import {
  useArtifacts,
  useChanges,
  useReviewEvidence,
} from '../../query/review';
import { FileTypeIcon } from './file-type-icon';
import { ThreadCard } from './thread-card';

type OpenDocument = (ref: DocumentRef, anchor?: CommentAnchor) => void;
type Props = {
  scope: ReviewScope;
  activeEntry: string | undefined;
  onOpen: OpenDocument;
};

const ROW =
  'flex w-full min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[12.5px] transition-colors hover:bg-accent';

/** The Review surface: layers in reading order, changed files, and comments. */
export function ReviewIndex({ scope, activeEntry, onOpen }: Props) {
  const [view, setView] = useState<'layers' | 'comments'>('layers');
  const { status, layers } = useChanges(scope);
  const { threads } = useComments(scope);
  const evidence = useReviewEvidence(scope);
  const artifacts = useArtifacts(scope);
  const openComments = threads.filter((thread) => !thread.resolved).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-2 pt-2">
        <Tabs
          value={view}
          onValueChange={(value) => setView(value as typeof view)}
          aria-label="Review views"
        >
          <TabsList className="h-8 w-full">
            <TabsTrigger value="layers" className="flex-1 text-xs">
              {layers.layers.length > 0 ? 'Layers' : 'Changed files'}
            </TabsTrigger>
            <TabsTrigger value="comments" className="flex-1 gap-1.5 text-xs">
              Comments
              {openComments > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 min-w-4 px-1 text-[10px]"
                >
                  {openComments}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {view === 'layers' ? (
        <LayersView
          scope={scope}
          activeEntry={activeEntry}
          onOpen={onOpen}
          status={status}
          layers={layers}
          evidence={evidence}
          threads={threads}
          artifacts={artifacts}
        />
      ) : (
        <CommentsView
          status={status}
          threads={threads}
          scope={scope}
          onOpen={onOpen}
        />
      )}
    </div>
  );
}

function LayersView({
  activeEntry,
  onOpen,
  status,
  layers,
  evidence,
  threads,
  artifacts,
}: Props & {
  status: Status;
  layers: Layers;
  evidence: readonly ReviewEvidenceItem[];
  threads: readonly CommentThread[];
  artifacts: readonly Artifact[];
}) {
  const paths = uniquePaths([
    ...status.changes.map(changePath),
    ...layers.layers.flatMap((layer) => layer.files.map((file) => file.path)),
  ]);
  const layered = new Set(
    layers.layers.flatMap((layer) => layer.files.map((file) => file.path)),
  );
  const loose = paths.filter((path) => !layered.has(path));
  const evidenceByPath = new Map(evidence.map((item) => [item.path, item]));
  const scopesByPath = new Map<string, string[]>();
  for (const change of status.changes) {
    const path = changePath(change);
    const scopes = scopesByPath.get(path) ?? [];
    if (!scopes.includes(change.scope)) scopes.push(change.scope);
    scopesByPath.set(path, scopes);
  }
  const progress = reviewProgress(paths, evidence);
  const isActive = (ref: DocumentRef) => activeEntry === entryKey(ref);
  const reviewBuilt = layers.layers.length > 0;

  if (paths.length === 0 && layers.layers.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <div className="grid min-h-48 place-items-center p-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <ListTreeIcon className="size-5 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>No changes</EmptyTitle>
              <EmptyDescription>
                This worktree matches its last commit.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
        {artifacts.length > 0 && (
          <ArtifactLinks
            artifacts={artifacts}
            activeEntry={activeEntry}
            onOpen={onOpen}
          />
        )}
      </div>
    );
  }

  const openThreads = (path: string) =>
    threads.filter(
      (thread) =>
        thread.anchor.filePath === path &&
        thread.anchor.revision == null &&
        !thread.resolved,
    ).length;

  const fileRow = (path: string, note?: string) => (
    <ChangeRow
      key={path}
      path={path}
      note={note}
      scopes={scopesByPath.get(path) ?? []}
      reviewStatus={evidenceByPath.get(path)?.reviewStatus}
      commentCount={openThreads(path)}
      active={isActive({ kind: 'change', path })}
      onOpen={onOpen}
      indented={reviewBuilt}
    />
  );

  return (
    <div className="min-h-0 flex-1 overflow-auto p-2">
      <button
        type="button"
        aria-pressed={isActive({ kind: 'handoff' })}
        onClick={() => onOpen({ kind: 'handoff' })}
        className={cn(
          ROW,
          'mb-2 flex-col items-stretch gap-1.5 py-2',
          isActive({ kind: 'handoff' }) && 'bg-accent',
        )}
      >
        <span className="flex items-center gap-1.5 font-medium">
          {reviewBuilt ? 'The whole handoff' : 'All changes'}
          <span className="ml-auto text-[11px] font-normal text-muted-foreground tabular-nums">
            {progress.done} of {progress.total} reviewed
          </span>
        </span>
        <Progress
          value={
            progress.total === 0 ? 0 : (progress.done / progress.total) * 100
          }
          aria-label={`${progress.done} of ${progress.total} files reviewed`}
        />
      </button>

      {layers.layers.map((layer, index) => {
        const ref: DocumentRef = { kind: 'layer', layerId: layer.id };
        const layerPaths = uniquePaths(layer.files.map((file) => file.path));
        const layerProgress = reviewProgress(layerPaths, evidence);
        const commentCount = layerPaths.reduce(
          (total, path) => total + openThreads(path),
          0,
        );
        return (
          <section key={layer.id} className="mb-2">
            <button
              type="button"
              aria-pressed={isActive(ref)}
              onClick={() => onOpen(ref)}
              className={cn(ROW, isActive(ref) && 'bg-accent')}
            >
              <span className="grid size-4.5 shrink-0 place-items-center rounded bg-muted text-[10px] text-muted-foreground">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {layer.title}
              </span>
              {commentCount > 0 && (
                <span className="flex shrink-0 items-center gap-0.5 text-[10.5px] text-muted-foreground">
                  <MessageSquareIcon className="size-3" />
                  {commentCount}
                </span>
              )}
              <span className="shrink-0 text-[10.5px] text-muted-foreground tabular-nums">
                {layerPaths.length}
              </span>
              <span className="shrink-0 text-[10.5px] text-muted-foreground tabular-nums">
                {layerProgress.done}/{layerProgress.total}
              </span>
            </button>
            {layer.files
              .map((file) => file.path)
              .filter((path, index, all) => all.indexOf(path) === index)
              .map((path) => {
                const note = layer.files.find(
                  (file) => file.path === path,
                )?.note;
                return fileRow(path, note);
              })}
          </section>
        );
      })}

      {loose.length > 0 && (
        <section className="mb-2">
          {reviewBuilt && (
            <p className="px-2 py-1 text-[11px] font-medium text-muted-foreground">
              Not in a layer
            </p>
          )}
          {loose.map((path) => fileRow(path))}
        </section>
      )}

      {artifacts.length > 0 && (
        <ArtifactLinks
          artifacts={artifacts}
          activeEntry={activeEntry}
          onOpen={onOpen}
        />
      )}
    </div>
  );
}

function ChangeRow({
  path,
  note,
  scopes,
  reviewStatus,
  commentCount,
  active,
  onOpen,
  indented = false,
}: {
  path: string;
  note: string | undefined;
  scopes: readonly string[];
  reviewStatus: ReviewStatus | undefined;
  commentCount: number;
  active: boolean;
  onOpen: OpenDocument;
  indented?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${basename(path)}${scopes.length > 0 ? ` · ${scopes.join(' + ')}` : ''}`}
      title={note == null ? path : `${path}\n${note}`}
      className={cn(
        ROW,
        'text-muted-foreground',
        indented && 'pl-7',
        active && 'bg-accent font-medium text-foreground',
      )}
      onClick={() => onOpen({ kind: 'change', path })}
    >
      <ReviewStatusIcon status={reviewStatus} />
      <FileTypeIcon path={path} className="size-3.5 shrink-0" />
      <span
        className={cn(
          'min-w-0 flex-1 truncate',
          reviewStatus === 'reviewed' &&
            'line-through decoration-muted-foreground/40',
        )}
      >
        {basename(path)}
      </span>
      {commentCount > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-[10.5px]">
          <MessageSquareIcon className="size-3" />
          {commentCount}
        </span>
      )}
    </button>
  );
}

function ReviewStatusIcon({ status }: { status: ReviewStatus | undefined }) {
  const normalized = status ?? 'unreviewed';
  return (
    <span
      className="grid w-3.5 shrink-0 place-items-center"
      data-review-state={normalized}
      title={reviewStatusLabel(status)}
    >
      {normalized === 'reviewed' ? (
        <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : normalized === 'stale' ? (
        <RotateCcwIcon className="size-3 text-amber-600 dark:text-amber-400" />
      ) : (
        <span className="size-1.5 rounded-full bg-muted-foreground/60" />
      )}
    </span>
  );
}

function reviewStatusLabel(status: ReviewStatus | undefined) {
  if (status === 'reviewed') return 'Reviewed';
  if (status === 'stale') return 'Changed since review';
  return 'Not reviewed';
}

function ArtifactLinks({
  artifacts,
  activeEntry,
  onOpen,
}: {
  artifacts: readonly Artifact[];
  activeEntry: string | undefined;
  onOpen: OpenDocument;
}) {
  return (
    <section className="flex flex-col gap-0.5 border-t pt-2">
      <p className="px-2 py-1 text-xs text-muted-foreground">From the agent</p>
      {artifacts.map((artifact) => {
        const ref: DocumentRef = { kind: 'artifact', artifactId: artifact.id };
        return (
          <button
            key={artifact.id}
            type="button"
            aria-pressed={activeEntry === entryKey(ref)}
            className={cn(ROW, activeEntry === entryKey(ref) && 'bg-accent')}
            onClick={() => onOpen(ref)}
          >
            <FileTextIcon className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{artifact.name}</span>
            <span className="text-[10.5px] text-muted-foreground">
              {artifact.sizeBytes.toLocaleString()} bytes
            </span>
          </button>
        );
      })}
    </section>
  );
}

function CommentsView({
  scope,
  status,
  threads,
  onOpen,
}: {
  scope: ReviewScope;
  status: Status;
  threads: readonly CommentThread[];
  onOpen: OpenDocument;
}) {
  const [filter, setFilter] = useState<'open' | 'resolved'>('open');
  const changed = new Set(status.changes.map(changePath));
  const visible = [...threads]
    .filter((thread) => thread.resolved === (filter === 'resolved'))
    .sort((left, right) =>
      lastActivity(left).localeCompare(lastActivity(right)),
    );
  const counts = {
    open: threads.filter((thread) => !thread.resolved).length,
    resolved: threads.filter((thread) => thread.resolved).length,
  };
  const empty =
    filter === 'open' ? 'No open comments yet.' : 'Nothing resolved yet.';

  const reveal = (anchor: CommentAnchor) => {
    const ref: DocumentRef =
      anchor.revision != null
        ? { kind: 'commit', oid: anchor.revision }
        : anchor.comparison?.kind !== 'file' && changed.has(anchor.filePath)
          ? { kind: 'change', path: anchor.filePath }
          : { kind: 'file', path: anchor.filePath };
    onOpen(ref, anchor);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 gap-1 px-2 pt-2">
        {(['open', 'resolved'] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              'rounded-md px-2 py-1 text-[11.5px] capitalize text-muted-foreground transition-colors hover:bg-accent',
              filter === value && 'bg-accent text-foreground',
            )}
          >
            {value} <span className="tabular-nums">{counts[value]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-muted-foreground">
          {empty}
        </p>
      ) : (
        <MessageScrollerProvider
          key={filter}
          autoScroll
          defaultScrollPosition="end"
        >
          <MessageScroller className="min-h-0 flex-1">
            <MessageScrollerViewport aria-label="Comments">
              <MessageScrollerContent
                className={cn('p-2', filter === 'open' ? 'gap-3' : 'gap-1.5')}
              >
                {visible.map((thread, index) => (
                  <MessageScrollerItem
                    key={thread.id}
                    messageId={thread.id}
                    scrollAnchor={index === visible.length - 1}
                  >
                    <ThreadCard
                      thread={thread}
                      scope={scope}
                      onReveal={() => reveal(thread.anchor)}
                    />
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      )}
    </div>
  );
}

function lastActivity(thread: CommentThread) {
  return thread.messages.at(-1)?.createdAt ?? '';
}

function uniquePaths(paths: readonly string[]) {
  return [...new Set(paths.filter(Boolean))];
}

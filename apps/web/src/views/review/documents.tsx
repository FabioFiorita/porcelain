import { formatDistanceToNowStrict } from 'date-fns';
import { CopyIcon, FileDiffIcon, MessageSquarePlusIcon } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DocumentRef } from '../../domain/documents';
import { historyRefLabel, ordinal } from '../../domain/history';
import type { CommitChanges, ReviewScope } from '../../domain/review';
import { changePath, reviewProgress, shortOid } from '../../domain/review';
import { useHistory } from '../../query/history';
import {
  useChanges,
  useCommit,
  useReviewEvidence,
  useTextFile,
} from '../../query/review';
import { copyText } from '../workspace/copy';
import { usePreferences } from '../workspace/preferences';
import { ArtifactDocument } from './artifact-document';
import { CodeDocument } from './code-document';
import { commitEntry } from './diff-entries';
import { DocumentToolbar } from './document-toolbar';
import { FileComments } from './file-comments';
import { FileTypeIcon } from './file-type-icon';
import { HandoffSummary } from './handoff-artifact';
import { HtmlFrame } from './html-frame';
import { MarkdownView } from './markdown-view';
import { SourcePreview } from './pierre-preview';
import { ReviewCodeDocument } from './review-code-document';
import { ReviewEmpty } from './review-empty';
import { MarkAllReviewed } from './reviewed-control';

export type OpenDocument = (ref: DocumentRef) => void;

function ProgressPill({ done, total }: { done: number; total: number }) {
  return (
    <div className="hidden items-center gap-2 text-[11px] text-muted-foreground md:flex">
      <Progress
        value={total === 0 ? 0 : (done / total) * 100}
        className="w-20"
        aria-label={`${done} of ${total} files reviewed`}
      />
      <span className="tabular-nums">
        {done}/{total}
      </span>
    </div>
  );
}

export function DocumentView({
  scope,
  document,
  onOpen,
}: {
  scope: ReviewScope;
  document: DocumentRef;
  onOpen: OpenDocument;
}) {
  switch (document.kind) {
    case 'handoff':
      return <HandoffDocument scope={scope} onOpen={onOpen} />;
    case 'layer':
      return <LayerDocument scope={scope} layerId={document.layerId} />;
    case 'change':
      return <ChangeDocument scope={scope} path={document.path} />;
    case 'file':
      return (
        <FileDocument scope={scope} path={document.path} onOpen={onOpen} />
      );
    case 'commit':
      return <CommitDocument scope={scope} oid={document.oid} />;
    case 'artifact':
      return (
        <ArtifactDocument scope={scope} artifactId={document.artifactId} />
      );
  }
}

function HandoffDocument({
  scope,
  onOpen,
}: {
  scope: ReviewScope;
  onOpen: OpenDocument;
}) {
  const { status, layers } = useChanges(scope);
  const evidence = useReviewEvidence(scope);
  const paths = uniquePaths([
    ...status.changes.map(changePath),
    ...layers.layers.flatMap((layer) => layer.files.map((file) => file.path)),
  ]);
  const reviewBuilt = layers.layers.length > 0;
  const progress = reviewProgress(paths, evidence);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DocumentToolbar
        title={reviewBuilt ? 'Handoff' : 'Changes'}
        subtitle={
          reviewBuilt
            ? `${layers.layers.length} ${layers.layers.length === 1 ? 'layer' : 'layers'} · ${paths.length} ${paths.length === 1 ? 'file' : 'files'}`
            : `${paths.length} ${paths.length === 1 ? 'file' : 'files'}`
        }
      >
        <ProgressPill {...progress} />
        <MarkAllReviewed scope={scope} entries={evidence} />
      </DocumentToolbar>
      <ReviewCodeDocument
        scope={scope}
        header={() => (
          <>
            {paths.length === 0 && (
              <div className="grid min-h-48 place-items-center p-6">
                <ReviewEmpty
                  title="No changes"
                  description="This worktree matches its last commit."
                />
              </div>
            )}
            <HandoffSummary
              scope={scope}
              layers={layers.layers}
              onOpen={onOpen}
            />
          </>
        )}
      />
    </div>
  );
}

function LayerDocument({
  scope,
  layerId,
}: {
  scope: ReviewScope;
  layerId: string;
}) {
  const { status, layers } = useChanges(scope);
  const layer = layers.layers.find((candidate) => candidate.id === layerId);
  const layerPaths = uniquePaths(layer?.files.map((file) => file.path) ?? []);
  const layerPathSet = new Set(layerPaths);
  const changes = status.changes.filter((change) =>
    layerPathSet.has(changePath(change)),
  );
  const evidence = useReviewEvidence(scope, changes).filter((entry) =>
    layerPathSet.has(entry.path),
  );

  if (!layer)
    return (
      <ReviewEmpty
        title="Layer no longer present"
        description="Choose a layer that is still present in the current review."
      />
    );

  const progress = reviewProgress(layerPaths, evidence);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DocumentToolbar
        title={`${layers.layers.indexOf(layer) + 1}. ${layer.title}`}
        subtitle={`Layer · ${layerPaths.length} ${layerPaths.length === 1 ? 'file' : 'files'}`}
      >
        <ProgressPill {...progress} />
        <MarkAllReviewed scope={scope} entries={evidence} />
      </DocumentToolbar>
      <ReviewCodeDocument
        scope={scope}
        changes={changes}
        header={() =>
          layer.summary == null ? null : (
            <div className="mx-4 mt-3 rounded-xl border bg-muted/30 px-4 py-3">
              <MarkdownView
                text={layer.summary}
                className="mt-1 max-w-[78ch] text-muted-foreground"
              />
            </div>
          )
        }
      />
    </div>
  );
}

function ChangeDocument({ scope, path }: { scope: ReviewScope; path: string }) {
  const { status } = useChanges(scope);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const changes = status.changes.filter(
    (change) => changePath(change) === path,
  );
  if (changes.length === 0)
    return (
      <ReviewEmpty
        title="Change no longer present"
        description="Choose a change that is still present in the current review."
      />
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DocumentToolbar
        title={path}
        subtitle={`${changes.length} comparison${changes.length === 1 ? '' : 's'}`}
      >
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={commentsOpen}
          onClick={() => setCommentsOpen((open) => !open)}
        >
          <MessageSquarePlusIcon className="size-3.5" />
          Comment
        </Button>
      </DocumentToolbar>
      {commentsOpen && (
        <div className="shrink-0 border-b px-3.5 py-2">
          <FileComments scope={scope} path={path} />
        </div>
      )}
      <ReviewCodeDocument scope={scope} changes={changes} />
    </div>
  );
}

function FileDocument({
  scope,
  path,
  onOpen,
}: {
  scope: ReviewScope;
  path: string;
  onOpen: OpenDocument;
}) {
  const file = useTextFile(scope, path);
  return (
    <ReadableFileDocument
      scope={scope}
      path={path}
      text={file.text}
      onOpen={onOpen}
    />
  );
}

type ReadableFileKind = 'markdown' | 'html' | 'code';
type FileDisplayMode = 'rendered' | 'source';

function ReadableFileDocument({
  scope,
  path,
  text,
  onOpen,
}: {
  scope: ReviewScope;
  path: string;
  text: string;
  onOpen: OpenDocument;
}) {
  const { preferences } = usePreferences();
  const { status } = useChanges(scope);
  const kind = fileKind(path);
  const changed = status.changes.some((change) => changePath(change) === path);
  const [mode, setMode] = useState<FileDisplayMode>(() =>
    defaultFileDisplayMode(kind, preferences),
  );
  const [commentsOpen, setCommentsOpen] = useState(false);
  const showingSource = kind === 'code' || mode === 'source';

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      <FileToolbar path={path}>
        {kind !== 'code' && (
          <Tabs
            value={mode}
            onValueChange={(value) => setMode(value as FileDisplayMode)}
          >
            <TabsList className="h-7">
              <TabsTrigger value="rendered" className="px-2 text-xs">
                {kind === 'markdown' ? 'Reader' : 'Preview'}
              </TabsTrigger>
              <TabsTrigger value="source" className="px-2 text-xs">
                Source
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {showingSource && (
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={commentsOpen}
            onClick={() => setCommentsOpen((open) => !open)}
          >
            <MessageSquarePlusIcon className="size-3.5" />
            Comment
          </Button>
        )}
        {changed && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpen({ kind: 'change', path })}
          >
            <FileDiffIcon className="size-3.5" />
            Open diff
          </Button>
        )}
      </FileToolbar>
      {commentsOpen && showingSource && (
        <div className="shrink-0 border-b px-3.5 py-2">
          <FileComments scope={scope} path={path} />
        </div>
      )}
      {mode === 'rendered' && kind === 'markdown' ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <MarkdownView
            text={text}
            className="mx-auto max-w-[78ch] px-6 py-6"
          />
        </div>
      ) : mode === 'rendered' && kind === 'html' ? (
        <div className="flex min-h-0 flex-1 flex-col bg-background">
          <p className="border-b bg-muted/40 px-3.5 py-1.5 text-[11px] text-muted-foreground">
            Sandboxed preview: scripts run, but the page cannot reach Porcelain,
            your cookies or the network origin.
          </p>
          <HtmlFrame html={text} title={path} className="min-h-0 flex-1" />
        </div>
      ) : (
        <SourcePreview path={path} contents={text} />
      )}
    </div>
  );
}

function FileToolbar({
  path,
  children,
}: {
  path: string;
  children?: React.ReactNode;
}) {
  const separator = path.lastIndexOf('/') + 1;
  const directory = path.slice(0, separator);
  const name = path.slice(separator);
  return (
    <DocumentToolbar
      title={
        <span className="flex min-w-0 items-center gap-1.5">
          <FileTypeIcon path={path} className="size-4 shrink-0" />
          {directory && (
            <span className="truncate font-normal text-muted-foreground">
              {directory}
            </span>
          )}
          <span className="shrink-0">{name}</span>
        </span>
      }
    >
      {children}
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Copy path"
        title="Copy path"
        onClick={() => copyText(path, 'path')}
      >
        <CopyIcon />
      </Button>
    </DocumentToolbar>
  );
}

function fileKind(path: string): ReadableFileKind {
  const lower = path.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.mdx')) return 'markdown';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  return 'code';
}

function defaultFileDisplayMode(
  kind: ReadableFileKind,
  preferences: ReturnType<typeof usePreferences>['preferences'],
): FileDisplayMode {
  if (kind === 'markdown')
    return preferences.markdownDefault === 'reader' ? 'rendered' : 'source';
  if (kind === 'html')
    return preferences.htmlDefault === 'preview' ? 'rendered' : 'source';
  return 'source';
}

export function CommitDocument({
  scope,
  oid,
}: {
  scope: ReviewScope;
  oid: string;
}) {
  // A merge can be read against any of its parents; all other commits only
  // have the first parent (or the empty tree for a root commit).
  const [parent, setParent] = useState(1);
  const [, startTransition] = useTransition();
  const commit = useCommit(scope, oid, parent);
  const history = useHistory(scope);
  const entries = useMemo(
    () =>
      commit.changes.flatMap((change) => {
        const entry = commitEntry(oid, change);
        return entry == null ? [] : [entry];
      }),
    [commit, oid],
  );
  const omitted = useMemo(
    () => commit.changes.filter((change) => commitEntry(oid, change) == null),
    [commit, oid],
  );
  const historyEntry = history.commits.find((item) => item.oid === oid);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DocumentToolbar
        title={<span className="font-mono">{shortOid(oid)}</span>}
        subtitle={`${commit.changes.length} file${commit.changes.length === 1 ? '' : 's'} changed`}
      >
        {commit.parentOids.length > 1 && (
          // Keep the current diff visible while the other parent is loading.
          <Tabs
            value={String(parent)}
            onValueChange={(value) =>
              startTransition(() => setParent(Number(value)))
            }
          >
            <TabsList className="h-7">
              {commit.parentOids.map((parentOid, index) => (
                <TabsTrigger
                  key={parentOid}
                  value={String(index + 1)}
                  className="px-2 text-xs"
                >
                  {ordinal(index + 1)} parent ·{' '}
                  <span className="font-mono">{shortOid(parentOid)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => copyText(oid, 'commit id')}
        >
          <CopyIcon className="size-3.5" />
          Copy id
        </Button>
      </DocumentToolbar>
      <CodeDocument
        entries={entries}
        header={() => (
          <CommitHeader
            commit={commit}
            historyEntry={historyEntry}
            oid={oid}
            omitted={omitted}
          />
        )}
      />
    </div>
  );
}

function CommitHeader({
  commit,
  historyEntry,
  oid,
  omitted,
}: {
  commit: CommitChanges;
  historyEntry?: ReturnType<typeof useHistory>['commits'][number] | undefined;
  oid: string;
  omitted: readonly CommitChanges['changes'][number][];
}) {
  return (
    <section className="mx-4 mt-3 rounded-xl border px-4 py-3">
      <h2 className="text-sm font-semibold">
        {historyEntry?.subject ?? 'Commit'}
      </h2>
      {historyEntry?.body != null && (
        <p className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-muted-foreground">
          {historyEntry.body}
        </p>
      )}
      {historyEntry?.bodyTruncated && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Commit message truncated
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
        {historyEntry != null && (
          <span>
            {historyEntry.author.name} ·{' '}
            {formatDistanceToNowStrict(
              new Date(historyEntry.author.timestamp),
              { addSuffix: true },
            )}
          </span>
        )}
        <span className="font-mono">{oid}</span>
        {commit.comparison.kind === 'parent' ? (
          <span>
            against{' '}
            <span className="font-mono">
              {shortOid(commit.comparison.baseOid)}
            </span>
            {commit.parentOids.length > 1 &&
              ` (${ordinal(commit.comparison.parentNumber)} parent of a merge)`}
          </span>
        ) : (
          <span>root commit</span>
        )}
        {historyEntry?.refs.map((ref) => (
          <Badge
            key={ref}
            title={ref}
            variant="secondary"
            className="h-4 px-1.5 text-[10px] font-normal"
          >
            {historyRefLabel(ref)}
          </Badge>
        ))}
      </div>
      {omitted.length > 0 && <OmittedCommitChanges changes={omitted} />}
    </section>
  );
}

function OmittedCommitChanges({
  changes,
}: {
  changes: readonly CommitChanges['changes'][number][];
}) {
  return (
    <ul className="mt-3 space-y-1.5" aria-label="Changes without code preview">
      {changes.map((change) => {
        const path = change.newPath ?? change.oldPath ?? 'Unknown path';
        const reason =
          change.patch.kind === 'binary'
            ? 'Binary change'
            : change.patch.kind === 'submodule'
              ? 'Submodule change'
              : 'Patch could not be displayed';
        return (
          <li
            key={`${change.oldPath}->${change.newPath}:${change.status}`}
            className="rounded-lg border bg-muted/25 px-3 py-2 text-xs"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-mono font-medium">{path}</span>
              <span className="shrink-0 text-muted-foreground">
                {change.status} · {reason}
              </span>
            </div>
            {change.patch.kind === 'submodule' && (
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
                {change.patch.text}
              </pre>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function uniquePaths(paths: readonly string[]) {
  return [...new Set(paths.filter(Boolean))];
}

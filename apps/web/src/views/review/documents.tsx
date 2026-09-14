import { formatDistanceToNowStrict } from 'date-fns';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DocumentRef } from '../../domain/documents';
import type {
  Artifact,
  ArtifactContent,
  ReviewEvidenceItem,
  ReviewScope,
} from '../../domain/review';
import { artifactKind, changePath, shortOid } from '../../domain/review';
import {
  useArtifactContents,
  useArtifacts,
  useChanges,
  useCommit,
  useReviewEvidence,
  useTextFile,
} from '../../query/review';
import { usePreferences } from '../workspace/preferences';
import { DocumentToolbar } from './document-toolbar';
import { FileComments } from './file-comments';
import { HandoffSummary } from './handoff-artifact';
import { HtmlFrame } from './html-frame';
import { MarkdownView } from './markdown-view';
import { DiffPreview, SourcePreview } from './pierre-preview';
import { ReviewCodeDocument } from './review-code-document';
import { ReviewEmpty } from './review-empty';
import { MarkAllReviewed } from './reviewed-control';

export type OpenDocument = (ref: DocumentRef) => void;

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
      return <FileDocument scope={scope} path={document.path} />;
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
        <div className="hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex">
          <Progress
            value={
              progress.total === 0 ? 0 : (progress.done / progress.total) * 100
            }
            className="w-20"
            aria-label={`${progress.done} of ${progress.total} files reviewed`}
          />
          <span className="tabular-nums">
            {progress.done}/{progress.total}
          </span>
        </div>
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
  if (!layer)
    return (
      <ReviewEmpty
        title="Layer no longer present"
        description="Choose a layer that is still present in the current review."
      />
    );

  // A layer names a logical path. Include every current comparison for that
  // path so staged and unstaged evidence cannot disappear from the layer.
  const layerPaths = new Set(layer.files.map((file) => file.path));
  const changes = status.changes.filter((change) =>
    layerPaths.has(changePath(change)),
  );
  const paths = [...new Set(changes.map(changePath))];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReviewCodeDocument
        scope={scope}
        changes={changes}
        header={() => (
          <div className="mx-4 mt-3 rounded-xl border bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Layer {layers.layers.indexOf(layer) + 1} · {paths.length}{' '}
              {paths.length === 1 ? 'file' : 'files'}
            </p>
            <h1 className="mt-1 text-base font-medium">{layer.title}</h1>
            {layer.summary && (
              <MarkdownView
                text={layer.summary}
                className="mt-1 max-w-[78ch] text-muted-foreground"
              />
            )}
          </div>
        )}
      />
    </div>
  );
}

function ChangeDocument({ scope, path }: { scope: ReviewScope; path: string }) {
  const { status } = useChanges(scope);
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
      <ReviewCodeDocument
        scope={scope}
        changes={changes}
        header={() => (
          <>
            <DocumentHeading
              eyebrow="Change"
              title={path}
              detail={`${changes.length} comparison${changes.length === 1 ? '' : 's'} · staged and unstaged evidence remain visible`}
            />
            <div className="border-b px-6 py-4">
              <FileComments scope={scope} path={path} />
            </div>
          </>
        )}
      />
    </div>
  );
}

function FileDocument({ scope, path }: { scope: ReviewScope; path: string }) {
  const file = useTextFile(scope, path);
  return (
    <ReadableFileDocument
      scope={scope}
      path={path}
      text={file.text}
      byteLength={file.byteLength}
    />
  );
}

type ReadableFileKind = 'markdown' | 'html' | 'code';
type FileDisplayMode = 'rendered' | 'source';

function ReadableFileDocument({
  scope,
  path,
  text,
  byteLength,
}: {
  scope: ReviewScope;
  path: string;
  text: string;
  byteLength: number;
}) {
  const { preferences } = usePreferences();
  const kind = fileKind(path);
  const [mode, setMode] = useState<FileDisplayMode>(() =>
    defaultFileDisplayMode(kind, preferences),
  );

  return (
    <DocumentFrame>
      <DocumentHeading
        eyebrow="File"
        title={path}
        detail={`${byteLength.toLocaleString()} bytes · Read only`}
      >
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
      </DocumentHeading>
      <div className="border-b px-6 py-4">
        <FileComments scope={scope} path={path} />
      </div>
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
    </DocumentFrame>
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

function CommitDocument({ scope, oid }: { scope: ReviewScope; oid: string }) {
  const commit = useCommit(scope, oid);
  return (
    <DocumentFrame>
      <DocumentHeading
        eyebrow="History"
        title={`Commit ${shortOid(oid)}`}
        detail={
          commit.comparison.kind === 'parent'
            ? `Compared with parent ${commit.comparison.parentNumber}`
            : 'Initial commit · compared with empty tree'
        }
      />
      {commit.changes.map((change) => (
        <section key={change.newPath ?? change.oldPath} className="border-t">
          <div className="flex items-center gap-3 px-6 py-3">
            <h3 className="min-w-0 flex-1 break-all text-sm">
              {change.newPath ?? change.oldPath}
            </h3>
            <Badge variant="outline">{change.status}</Badge>
          </div>
          {'text' in change.patch ? (
            <DiffPreview patch={change.patch.text} />
          ) : (
            <ReviewEmpty
              title="Binary change"
              description="Binary contents are not displayed."
            />
          )}
        </section>
      ))}
    </DocumentFrame>
  );
}

export function ArtifactDocument({
  scope,
  artifactId,
}: {
  scope: ReviewScope;
  artifactId: string;
}) {
  const artifact = useArtifacts(scope).find((item) => item.id === artifactId);
  const [content] = useArtifactContents(
    scope,
    artifact == null ? [] : [artifact.id],
  );
  if (!artifact)
    return (
      <ReviewEmpty
        title="Artifact unavailable"
        description="This upload is no longer available for the selected worktree."
      />
    );
  if (!content)
    return (
      <ReviewEmpty
        title="Artifact content unavailable"
        description="This upload no longer has readable content for the selected worktree."
      />
    );
  return <ArtifactDetails artifact={artifact} content={content} />;
}

function ArtifactDetails({
  artifact,
  content,
}: {
  artifact: Artifact;
  content: ArtifactContent;
}) {
  const kind = artifactKind(artifact.name, content.content);
  return (
    <DocumentFrame>
      <DocumentToolbar
        title={artifact.name}
        subtitle={`From the agent · Stored artifact · ${formatDistanceToNowStrict(new Date(artifact.createdAt), { addSuffix: true })}`}
      />
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 border-b px-6 py-4 text-sm">
        <dt className="text-muted-foreground">Created</dt>
        <dd>{artifact.createdAt.replace('T', ' ').replace('Z', ' UTC')}</dd>
        <dt className="text-muted-foreground">Format</dt>
        <dd>
          {kind === 'html'
            ? 'HTML preview'
            : kind === 'markdown'
              ? 'Markdown'
              : 'Text'}
        </dd>
      </dl>
      {kind === 'html' ? (
        <HtmlFrame
          html={content.content}
          title={artifact.name}
          className="h-[min(70svh,56rem)]"
        />
      ) : kind === 'markdown' ? (
        <div className="mx-auto max-w-[78ch] px-6 py-4">
          <MarkdownView text={content.content} />
        </div>
      ) : (
        <pre className="whitespace-pre-wrap break-words px-6 py-5 font-mono text-xs leading-relaxed">
          {content.content}
        </pre>
      )}
    </DocumentFrame>
  );
}

function DocumentFrame({ children }: { children: React.ReactNode }) {
  return (
    <article className="min-h-0 flex-1 overflow-auto bg-card">
      {children}
    </article>
  );
}

function DocumentHeading({
  eyebrow,
  title,
  detail,
  children,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex items-start gap-4 border-b px-6 py-5">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{eyebrow}</p>
        <h1 className="break-all text-lg font-medium tracking-tight">
          {title}
        </h1>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      {children != null && <div className="shrink-0">{children}</div>}
    </header>
  );
}

function uniquePaths(paths: readonly string[]) {
  return [...new Set(paths.filter(Boolean))];
}

function reviewProgress(
  paths: readonly string[],
  evidence: readonly ReviewEvidenceItem[],
) {
  const evidenceByPath = new Map(evidence.map((item) => [item.path, item]));
  const unique = uniquePaths(paths);
  return {
    done: unique.filter(
      (path) => evidenceByPath.get(path)?.reviewStatus === 'reviewed',
    ).length,
    total: unique.length,
  };
}

import { FileTextIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { DocumentRef } from '../../domain/documents';
import type {
  Artifact,
  ArtifactContent,
  Change,
  ReviewScope,
} from '../../domain/review';
import {
  artifactKind,
  changePath,
  type Layers,
  shortOid,
} from '../../domain/review';
import {
  useArtifactContents,
  useArtifacts,
  useChanges,
  useCommit,
  useDiff,
  useTextFile,
} from '../../query/review';
import { FileComments } from './file-comments';
import { HtmlFrame } from './html-frame';
import { MarkdownView } from './markdown-view';
import { DiffPreview, SourcePreview } from './pierre-preview';
import { ReviewCodeDocument } from './review-code-document';
import { ReviewEmpty } from './review-empty';

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
  const artifacts = useArtifacts(scope);
  const paths = [...new Set(status.changes.map(changePath))];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {paths.length === 0 ? (
        <ReviewEmpty
          title="No changes"
          description="This worktree matches its last commit."
        />
      ) : (
        <ReviewCodeDocument
          scope={scope}
          status={status}
          header={() => (
            <HandoffHeader
              artifacts={artifacts}
              layers={layers.layers}
              fileCount={paths.length}
              onOpen={onOpen}
            />
          )}
        />
      )}
    </div>
  );
}

function HandoffHeader({
  artifacts,
  layers,
  fileCount,
  onOpen,
}: {
  artifacts: readonly Artifact[];
  layers: Layers['layers'];
  fileCount: number;
  onOpen: OpenDocument;
}) {
  return (
    <div className="px-4 pt-3">
      <div className="flex items-end gap-3 px-1 pb-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            {layers.length > 0 ? 'Handoff' : 'Changes'}
          </p>
          <h1 className="text-base font-medium tracking-tight">
            {layers.length > 0 ? 'Review handoff' : 'All changes'}
          </h1>
        </div>
        <span className="text-xs text-muted-foreground">
          {fileCount} {fileCount === 1 ? 'file' : 'files'}
        </span>
      </div>
      {(artifacts.length > 0 || layers.length > 0) && (
        <section className="overflow-hidden rounded-xl border bg-card">
          {artifacts.length > 0 && (
            <div className="flex min-h-10 flex-wrap items-center gap-1 border-b bg-muted/40 px-3 py-1.5">
              <span className="mr-auto text-xs font-medium">
                From the agent
              </span>
              {artifacts.map((artifact) => (
                <button
                  key={artifact.id}
                  type="button"
                  className="flex h-7 min-w-0 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() =>
                    onOpen({ kind: 'artifact', artifactId: artifact.id })
                  }
                >
                  <FileTextIcon className="size-3.5 shrink-0" />
                  <span className="max-w-48 truncate">{artifact.name}</span>
                </button>
              ))}
            </div>
          )}
          {layers.length > 0 && (
            <div className="px-2 py-2">
              <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">
                Read in this order
              </p>
              {layers.map((layer, index) => (
                <LayerLink
                  key={layer.id}
                  layer={layer}
                  index={index}
                  onOpen={onOpen}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function LayerLink({
  layer,
  index,
  onOpen,
}: {
  layer: Layers['layers'][number];
  index: number;
  onOpen: OpenDocument;
}) {
  return (
    <button
      type="button"
      className="flex w-full min-w-0 items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent"
      onClick={() => onOpen({ kind: 'layer', layerId: layer.id })}
    >
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded bg-muted text-[10.5px] text-muted-foreground">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-[12.5px] font-medium">{layer.title}</span>
        {layer.summary && (
          <MarkdownView
            text={layer.summary}
            className="text-xs text-muted-foreground [&_p]:my-0.5"
          />
        )}
      </span>
      <span className="mt-0.5 shrink-0 text-[11px] text-muted-foreground">
        {layer.files.length} {layer.files.length === 1 ? 'file' : 'files'}
      </span>
    </button>
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
        description="Refresh the review and choose a current layer."
      />
    );

  const changes = layer.files.flatMap((file) =>
    status.changes.filter(
      (change) =>
        change.scope === file.scope && changePath(change) === file.path,
    ),
  );
  const paths = [...new Set(changes.map(changePath))];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReviewCodeDocument
        scope={scope}
        status={status}
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
        description="Refresh the review and choose a current change."
      />
    );

  const untracked = changes.find((change) => change.scope === 'untracked');
  if (untracked && changes.length === 1)
    return <FileDocument scope={scope} path={path} />;

  return (
    <DocumentFrame>
      <DocumentHeading
        eyebrow="Change"
        title={path}
        detail={`${changes.length} comparison${changes.length === 1 ? '' : 's'} · staged and unstaged evidence remain visible`}
      />
      <div className="border-b px-6 py-4">
        <FileComments scope={scope} path={path} />
      </div>
      {changes.map((change) => (
        <ChangeEvidence
          key={`${change.scope}:${changePath(change)}:${'kind' in change ? change.kind : 'untracked'}`}
          scope={scope}
          change={change}
          statusToken={status.statusToken}
        />
      ))}
    </DocumentFrame>
  );
}

function ChangeEvidence({
  scope,
  change,
  statusToken,
}: {
  scope: ReviewScope;
  change: Change;
  statusToken: string;
}) {
  if (change.scope === 'untracked')
    return <UntrackedEvidence scope={scope} path={change.path} />;
  if (change.scope === 'unmerged' || !change.supported)
    return (
      <section className="border-t px-6 py-5">
        <ReviewEmpty
          title={`${changePath(change)} · ${change.scope}`}
          description="This change requires external inspection. Conflict resolution and submodule inspection are not supported here."
        />
      </section>
    );

  return (
    <TrackedEvidence scope={scope} change={change} statusToken={statusToken} />
  );
}

function TrackedEvidence({
  scope,
  change,
  statusToken,
}: {
  scope: ReviewScope;
  change: Extract<Change, { kind: string }>;
  statusToken: string;
}) {
  const diff = useDiff(scope, {
    expectedStatusToken: statusToken,
    change: {
      scope: change.scope,
      oldPath: change.oldPath,
      newPath: change.newPath,
    },
  });

  return (
    <section className="border-t">
      <div className="flex items-center gap-3 px-6 py-3">
        <span className="min-w-0 flex-1 text-xs text-muted-foreground">
          {change.scope} · {change.kind}
        </span>
      </div>
      {'patch' in diff.content ? (
        <DiffPreview patch={diff.content.patch} />
      ) : (
        <ReviewEmpty
          title="Preview unavailable"
          description={
            diff.content.kind === 'binary'
              ? 'This is a binary change.'
              : `Content omitted: ${diff.content.reason}.`
          }
        />
      )}
    </section>
  );
}

function UntrackedEvidence({
  scope,
  path,
}: {
  scope: ReviewScope;
  path: string;
}) {
  const file = useTextFile(scope, path);
  return (
    <section className="border-t px-6 py-5">
      <p className="mb-3 text-xs text-muted-foreground">Untracked file</p>
      <SourcePreview path={path} contents={file.text} />
    </section>
  );
}

function FileDocument({ scope, path }: { scope: ReviewScope; path: string }) {
  const file = useTextFile(scope, path);
  return (
    <DocumentFrame>
      <DocumentHeading
        eyebrow="File"
        title={path}
        detail={`${file.byteLength.toLocaleString()} bytes · Read only`}
      />
      <div className="border-b px-6 py-4">
        <FileComments scope={scope} path={path} />
      </div>
      <SourcePreview path={path} contents={file.text} />
    </DocumentFrame>
  );
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
      <DocumentHeading
        eyebrow="From the agent"
        title={artifact.name}
        detail={`Stored artifact · ${artifact.sizeBytes.toLocaleString()} bytes`}
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
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <header className="flex flex-col gap-1 border-b px-6 py-5">
      <p className="text-xs text-muted-foreground">{eyebrow}</p>
      <h1 className="break-all text-lg font-medium tracking-tight">{title}</h1>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </header>
  );
}

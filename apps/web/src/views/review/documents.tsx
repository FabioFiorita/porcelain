import { FileTextIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { DocumentRef } from '../../domain/documents';
import type { Artifact, Change, ReviewScope } from '../../domain/review';
import { changePath, type Layers, shortOid } from '../../domain/review';
import {
  useArtifacts,
  useChanges,
  useCommit,
  useDiff,
  useTextFile,
} from '../../query/review';
import { FileComments } from './file-comments';
import { DiffPreview, SourcePreview } from './pierre-preview';
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
      return (
        <LayerDocument
          scope={scope}
          layerId={document.layerId}
          onOpen={onOpen}
        />
      );
    case 'change':
      return <ChangeDocument scope={scope} path={document.path} />;
    case 'file':
      return <FileDocument scope={scope} path={document.path} />;
    case 'commit':
      return <CommitDocument scope={scope} oid={document.oid} />;
    case 'artifact':
      return <ArtifactDocument scope={scope} name={document.name} />;
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
  const paths = useMemo(
    () => [...new Set(status.changes.map(changePath))],
    [status.changes],
  );

  return (
    <DocumentFrame>
      <DocumentHeading
        eyebrow={layers.layers.length > 0 ? 'From the agent' : 'Changes'}
        title={layers.layers.length > 0 ? 'Review handoff' : 'All changes'}
        detail={`${paths.length} changed ${paths.length === 1 ? 'file' : 'files'}`}
      />
      {artifacts.length > 0 && (
        <section className="flex flex-col gap-2 border-b px-6 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            From the agent
          </p>
          {artifacts.map((artifact) => (
            <button
              key={artifact.id}
              type="button"
              className="flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              onClick={() => onOpen({ kind: 'artifact', name: artifact.name })}
            >
              <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{artifact.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {artifact.sizeBytes.toLocaleString()} bytes
              </span>
            </button>
          ))}
        </section>
      )}
      {layers.layers.length > 0 && (
        <section className="flex flex-col gap-2 border-b px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Read in this order
          </p>
          {layers.layers.map((layer, index) => (
            <LayerLink
              key={layer.id}
              layer={layer}
              index={index}
              onOpen={onOpen}
            />
          ))}
        </section>
      )}
      <section className="flex flex-col gap-2 px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Changed files
          </p>
          <Progress value={0} className="w-24" aria-label="Review progress" />
        </div>
        {paths.length === 0 ? (
          <ReviewEmpty
            title="No changes"
            description="This worktree matches its last commit."
          />
        ) : (
          paths.map((path) => (
            <button
              key={path}
              type="button"
              className="flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              onClick={() => onOpen({ kind: 'change', path })}
            >
              <span className="size-1.5 shrink-0 rounded-full bg-foreground" />
              <span className="min-w-0 flex-1 truncate">{path}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                Open diff
              </span>
            </button>
          ))
        )}
      </section>
    </DocumentFrame>
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
      className="flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
      onClick={() => onOpen({ kind: 'layer', layerId: layer.id })}
    >
      <span className="grid size-6 shrink-0 place-items-center rounded bg-muted text-xs text-muted-foreground">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {layer.title}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {layer.files.length} {layer.files.length === 1 ? 'file' : 'files'}
      </span>
    </button>
  );
}

function LayerDocument({
  scope,
  layerId,
  onOpen,
}: {
  scope: ReviewScope;
  layerId: string;
  onOpen: OpenDocument;
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

  const available = new Set(status.changes.map(changePath));
  const paths = [...new Set(layer.files.map((file) => file.path))];
  return (
    <DocumentFrame>
      <DocumentHeading
        eyebrow={`Layer ${layers.layers.indexOf(layer) + 1}`}
        title={layer.title}
        detail={`${paths.length} ${paths.length === 1 ? 'file' : 'files'} in this layer`}
      />
      <section className="flex flex-col gap-2 px-6 py-5">
        {paths.map((path) => (
          <button
            type="button"
            key={path}
            disabled={!available.has(path)}
            className="flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onOpen({ kind: 'change', path })}
          >
            <span className="min-w-0 flex-1 truncate">{path}</span>
            <Badge variant="outline">
              {available.has(path) ? 'Changed' : 'No longer changed'}
            </Badge>
          </button>
        ))}
      </section>
    </DocumentFrame>
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

function ArtifactDocument({
  scope,
  name,
}: {
  scope: ReviewScope;
  name: string;
}) {
  const artifact = useArtifacts(scope).find((item) => item.name === name);
  if (!artifact)
    return (
      <ReviewEmpty
        title="Artifact unavailable"
        description="This upload is no longer available for the selected worktree."
      />
    );
  return <ArtifactDetails artifact={artifact} />;
}

function ArtifactDetails({ artifact }: { artifact: Artifact }) {
  return (
    <DocumentFrame>
      <DocumentHeading
        eyebrow="From the agent"
        title={artifact.name}
        detail="Stored artifact"
      />
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 px-6 py-6 text-sm">
        <dt className="text-muted-foreground">Created</dt>
        <dd>{artifact.createdAt.replace('T', ' ').replace('Z', ' UTC')}</dd>
        <dt className="text-muted-foreground">Size</dt>
        <dd>{artifact.sizeBytes.toLocaleString()} bytes</dd>
      </dl>
      <ReviewEmpty
        title="Content endpoint not connected"
        description="The live review client currently exposes artifact metadata only."
      />
    </DocumentFrame>
  );
}

function DocumentFrame({ children }: { children: React.ReactNode }) {
  return <article className="min-h-full bg-card">{children}</article>;
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

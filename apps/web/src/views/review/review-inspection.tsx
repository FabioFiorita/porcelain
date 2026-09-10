import { Badge } from '@/components/ui/badge';
import {
  type Change,
  changeKey,
  changePath,
  type ReviewScope,
  type Surface,
} from '../../domain/review';
import {
  useArtifacts,
  useChanges,
  useCommit,
  useDiff,
  useTextFile,
} from '../../query/review';
import { CodePreview } from './code-preview';
import { GitActionInspection } from './git-action-inspection';
import { ReviewEmpty } from './review-empty';
export function ReviewInspection({
  scope,
  surface,
  entry,
  available,
}: {
  scope: ReviewScope;
  surface: Surface;
  entry: string;
  available: boolean;
}) {
  if (!available && surface !== 'artifacts')
    return (
      <ReviewEmpty
        title="Worktree unavailable"
        description="Refresh the environment after restoring the checkout."
      />
    );
  if (!entry)
    return (
      <ReviewEmpty
        title="Ready when you are"
        description="Choose a file, change, commit or artifact from the review sidebar."
      />
    );
  switch (surface) {
    case 'files':
      return <FileInspection scope={scope} path={entry} />;
    case 'changes':
      return <ChangeInspection scope={scope} entry={entry} />;
    case 'history':
      return <CommitInspection scope={scope} oid={entry} />;
    case 'artifacts':
      return <ArtifactInspection scope={scope} id={entry} />;
    case 'git':
      return <GitActionInspection scope={scope} entry={entry} />;
  }
}
function FileInspection({ scope, path }: { scope: ReviewScope; path: string }) {
  const file = useTextFile(scope, path);
  return (
    <article>
      <InspectionHeading
        title={path}
        detail={`${file.byteLength.toLocaleString()} bytes · Read only`}
      />
      <CodePreview
        text={file.text}
        language={path.split('.').at(-1) ?? 'text'}
      />
    </article>
  );
}
function ChangeInspection({
  scope,
  entry,
}: {
  scope: ReviewScope;
  entry: string;
}) {
  const { status } = useChanges(scope);
  const change = status.changes.find((change) => changeKey(change) === entry);
  if (!change)
    return (
      <ReviewEmpty
        title="Change no longer present"
        description="Choose a change from the current list."
      />
    );
  if (change.scope === 'untracked')
    return <FileInspection scope={scope} path={change.path} />;
  if (change.scope === 'unmerged' || !change.supported)
    return (
      <ReviewEmpty
        title={changePath(change)}
        description="This change requires external inspection. Conflict resolution and submodule inspection are not supported here."
      />
    );
  return (
    <DiffInspection scope={scope} change={change} token={status.statusToken} />
  );
}
function DiffInspection({
  scope,
  change,
  token,
}: {
  scope: ReviewScope;
  change: Extract<Change, { kind: string }>;
  token: string;
}) {
  const diff = useDiff(scope, {
    expectedStatusToken: token,
    change: {
      scope: change.scope,
      oldPath: change.oldPath,
      newPath: change.newPath,
    },
  });
  return (
    <article>
      <InspectionHeading
        title={changePath(change)}
        detail={`${change.kind} · ${change.scope}`}
      />
      {'patch' in diff.content ? (
        <CodePreview
          text={diff.content.patch}
          language={changePath(change).split('.').at(-1) ?? 'text'}
          format="diff"
        />
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
    </article>
  );
}
function CommitInspection({ scope, oid }: { scope: ReviewScope; oid: string }) {
  const commit = useCommit(scope, oid);
  return (
    <article>
      <InspectionHeading
        title={`Commit ${oid.slice(0, 7)}`}
        detail={
          commit.comparison.kind === 'parent'
            ? `Compared with parent ${commit.comparison.parentNumber}`
            : 'Initial commit · compared with empty tree'
        }
      />
      {commit.changes.map((change) => (
        <section key={change.newPath ?? change.oldPath}>
          <div className="flex items-center gap-3 px-6 py-4">
            <h3 className="min-w-0 flex-1 break-all text-sm">
              {change.newPath ?? change.oldPath}
            </h3>
            <Badge variant="outline">{change.status}</Badge>
          </div>
          {'text' in change.patch ? (
            <CodePreview
              text={change.patch.text}
              language={
                (change.newPath ?? change.oldPath ?? '').split('.').at(-1) ??
                'text'
              }
              format="diff"
            />
          ) : (
            <ReviewEmpty
              title="Binary change"
              description="Binary contents are not displayed."
            />
          )}
        </section>
      ))}
    </article>
  );
}
function ArtifactInspection({ scope, id }: { scope: ReviewScope; id: string }) {
  const artifact = useArtifacts(scope).find((item) => item.id === id);
  if (!artifact)
    return (
      <ReviewEmpty
        title="Artifact unavailable"
        description="Choose an artifact from the current list."
      />
    );
  return (
    <article>
      <InspectionHeading title={artifact.name} detail="Stored HTML artifact" />
      <dl className="grid grid-cols-[auto_1fr] gap-4 px-6 py-6 text-sm">
        <dt className="text-muted-foreground">Created</dt>
        <dd>{artifact.createdAt.replace('T', ' ').replace('Z', ' UTC')}</dd>
        <dt className="text-muted-foreground">Size</dt>
        <dd>{artifact.sizeBytes.toLocaleString()} bytes</dd>
      </dl>
      <ReviewEmpty
        title="Safely stored"
        description="Artifact rendering and sharing are not available yet. This view shows metadata only."
      />
    </article>
  );
}
function InspectionHeading({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <header className="flex flex-col gap-2 px-6 py-7">
      <p className="text-xs text-muted-foreground">{detail}</p>
      <h3 className="break-all text-lg font-medium tracking-tight">{title}</h3>
    </header>
  );
}

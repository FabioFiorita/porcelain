import type { RevealComment } from '../../domain/comments';
import type { DocumentRef, OpenDocument } from '../../domain/documents';
import { entryKey } from '../../domain/documents';
import type { ReviewScope } from '../../domain/review';
import { changePath, reviewProgress } from '../../domain/review';
import { useChanges, useReviewEvidence } from '../../query/review';
import { ArtifactDocument } from './artifact-document';
import { CommitDocument } from './commit-document';
import { DocumentInteraction } from './document-interaction';
import { DocumentToolbar } from './document-toolbar';
import { FileDocument } from './file-document';
import { HandoffSummary } from './handoff-artifact';
import { LayerDocument } from './layer-document';
import { ReviewCodeDocument } from './review-code-document';
import { ReviewEmpty } from './review-empty';
import { ReviewProgress } from './review-progress';
import { MarkAllReviewed, ReviewedControl } from './reviewed-control';

export function DocumentView({
  scope,
  document,
  onOpen,
  active = false,
  reveal,
}: {
  scope: ReviewScope;
  document: DocumentRef;
  onOpen: OpenDocument;
  active?: boolean;
  reveal?: RevealComment | undefined;
}) {
  return (
    <DocumentInteraction
      value={{
        active,
        storageKey: `porcelain.folds.${scope.worktreeId}.${entryKey(document)}`,
        reveal,
      }}
    >
      <DocumentContent scope={scope} document={document} onOpen={onOpen} />
    </DocumentInteraction>
  );
}
function DocumentContent({
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
          key={`${scope.projectId}:${scope.worktreeId}:${document.layerId}`}
          scope={scope}
          layerId={document.layerId}
          onOpen={onOpen}
        />
      );
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
      <ReviewCodeDocument
        toolbar={(collapseControl) => (
          <DocumentToolbar
            title={reviewBuilt ? 'Handoff' : 'Changes'}
            subtitle={
              reviewBuilt
                ? `${layers.layers.length} ${layers.layers.length === 1 ? 'layer' : 'layers'} · ${paths.length} ${paths.length === 1 ? 'file' : 'files'}`
                : `${paths.length} ${paths.length === 1 ? 'file' : 'files'}`
            }
          >
            <ReviewProgress {...progress} />
            {collapseControl}
            <MarkAllReviewed scope={scope} entries={evidence} />
          </DocumentToolbar>
        )}
        scope={scope}
        files={layers.layers.flatMap((layer) => layer.files)}
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
            {reviewBuilt && (
              <HandoffSummary
                scope={scope}
                layers={layers.layers}
                onOpen={onOpen}
              />
            )}
          </>
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
  const evidence = useReviewEvidence(scope, changes).find(
    (entry) => entry.path === path,
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
        toolbar={() => (
          <DocumentToolbar
            title={path.slice(path.lastIndexOf('/') + 1)}
            subtitle={path}
          >
            {evidence && (
              <ReviewedControl
                scope={scope}
                path={path}
                fingerprint={evidence.fingerprint}
                status={evidence.reviewStatus}
              />
            )}
          </DocumentToolbar>
        )}
        scope={scope}
        changes={changes}
      />
    </div>
  );
}

function uniquePaths(paths: readonly string[]) {
  return [...new Set(paths.filter(Boolean))];
}

import { MessageSquarePlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
import { MarkdownView } from './markdown-view';
import { ReviewCodeDocument } from './review-code-document';
import { ReviewEmpty } from './review-empty';
import { MarkAllReviewed } from './reviewed-control';

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
            <ProgressPill {...progress} />
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
      <ReviewCodeDocument
        toolbar={(collapseControl) => (
          <DocumentToolbar
            title={`${layers.layers.indexOf(layer) + 1}. ${layer.title}`}
            subtitle={`Layer · ${layerPaths.length} ${layerPaths.length === 1 ? 'file' : 'files'}`}
          >
            <ProgressPill {...progress} />
            {collapseControl}
            <MarkAllReviewed scope={scope} entries={evidence} />
          </DocumentToolbar>
        )}
        scope={scope}
        changes={changes}
        files={layer.files}
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
  const [commentRequest, setCommentRequest] = useState<number>();
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
          onClick={() => setCommentRequest(Date.now())}
        >
          <MessageSquarePlusIcon className="size-3.5" />
          Comment
        </Button>
      </DocumentToolbar>
      <ReviewCodeDocument
        scope={scope}
        changes={changes}
        {...(commentRequest !== undefined ? { commentRequest } : {})}
      />
    </div>
  );
}

function uniquePaths(paths: readonly string[]) {
  return [...new Set(paths.filter(Boolean))];
}

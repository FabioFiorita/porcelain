import { Button } from '@/components/ui/button';
import type { RevealComment } from '../../domain/comments';
import type { DocumentRef, OpenDocument } from '../../domain/documents';
import { entryKey } from '../../domain/documents';
import type { ReviewScope } from '../../domain/review';
import { usePublishedReview } from '../../query/published-review';
import { useReviewChanges } from '../../query/review';
import { CommitDocument } from './commit-document';
import { DocumentInteraction } from './document-interaction';
import { DocumentToolbar } from './document-toolbar';
import { FileDocument } from './file-document';
import { PublishedLayer } from './published-layer';
import { PublishedOverview } from './published-overview';
import { ReviewCodeDocument } from './review-code-document';
import { ReviewEmpty } from './review-empty';
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
  }
}

function HandoffDocument({
  scope,
  onOpen,
}: {
  scope: ReviewScope;
  onOpen: OpenDocument;
}) {
  const published = usePublishedReview(scope);
  if (published.isPending)
    return (
      <p role="status" className="p-4 text-sm">
        Loading review…
      </p>
    );
  if (published.isError)
    return <PublicationFailure retry={() => void published.refetch()} />;
  if (published.data?.active)
    return <PublishedOverview review={published.data} onOpen={onOpen} />;
  return <PlainChangesDocument scope={scope} />;
}

function PlainChangesDocument({ scope }: { scope: ReviewScope }) {
  const changes = useReviewChanges(scope);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReviewCodeDocument
        scope={scope}
        toolbar={(collapseControl) => (
          <DocumentToolbar title="Changes" subtitle={`${changes.length} files`}>
            {collapseControl}
            <MarkAllReviewed scope={scope} entries={changes} />
          </DocumentToolbar>
        )}
      />
    </div>
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
  const published = usePublishedReview(scope);
  const layer = published.data?.layers.find(
    (candidate) => candidate.id === layerId,
  );
  if (published.isPending)
    return (
      <p role="status" className="p-4 text-sm">
        Loading layer…
      </p>
    );
  if (published.isError)
    return <PublicationFailure retry={() => void published.refetch()} />;
  if (!layer)
    return (
      <ReviewEmpty
        title="Layer no longer present"
        description="Choose a layer in the current review."
      />
    );
  return (
    <PublishedLayer
      key={`${layerId}:${published.data?.revision}`}
      scope={scope}
      layer={layer}
      onOpen={onOpen}
    />
  );
}

function ChangeDocument({ scope, path }: { scope: ReviewScope; path: string }) {
  const change = useReviewChanges(scope, [path]).find(
    (entry) => entry.path === path,
  );
  if (!change)
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
            <ReviewedControl
              scope={scope}
              path={path}
              fingerprint={change.fingerprint}
              status={change.reviewStatus}
            />
          </DocumentToolbar>
        )}
        scope={scope}
        paths={[path]}
      />
    </div>
  );
}

function PublicationFailure({ retry }: { retry: () => void }) {
  return (
    <div className="flex flex-col items-center p-4">
      <ReviewEmpty
        title="Review could not be loaded"
        description="The saved publication could not be read."
      />
      <Button variant="outline" onClick={retry}>
        Retry review
      </Button>
    </div>
  );
}

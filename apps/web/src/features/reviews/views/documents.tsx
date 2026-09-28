import { Button } from '@/components/ui/button';
import { DiscardButton } from '@/features/git-actions/index';
import { useAccessStore } from '@/features/access/index';
import { useChanges } from '@/features/changes/index';
import { usePublishedReview } from '../queries/published-review';
import { usePrefetchReviewed, useReviewChangeItems } from '../queries/reviewed';
import type { RevealComment } from '../rules/comments';
import {
  type DocumentInteraction,
  type DocumentRef,
  entryKey,
  type OpenDocument,
} from '../rules/documents';
import type { ReviewScope } from '../rules/review';
import type { DocumentContext } from './code-document';
import { CommitDocument } from './commit-document';
import { DocumentToolbar } from './document-toolbar';
import { FileDocument } from './file-document';
import { PublishedLayer } from './published-layer';
import { PublishedOverview } from './published-overview';
import { ReviewCodeDocument } from './review-code-document';
import { MarkAllReviewed, ReviewedControl } from './reviewed-control';
import { ReviewEmpty } from './review-empty';
import { UnexplainedDocument } from './unexplained-document';

type DocumentProps = {
  scope: ReviewScope;
  context: DocumentContext;
  interaction: DocumentInteraction;
  onOpen: OpenDocument;
};

export function DocumentView({
  scope,
  context,
  document,
  onOpen,
  active = false,
  reveal,
}: {
  scope: ReviewScope;
  context: DocumentContext;
  document: DocumentRef;
  onOpen: OpenDocument;
  active?: boolean;
  reveal?: RevealComment | undefined;
}) {
  const props = {
    scope,
    context,
    onOpen,
    interaction: {
      active,
      worktreeId: scope.worktreeId,
      entry: entryKey(document),
      reveal,
    },
  };
  switch (document.kind) {
    case 'handoff':
      return <HandoffDocument {...props} />;
    case 'layer':
      return <LayerDocument {...props} layerId={document.layerId} />;
    case 'unexplained':
      return <UnexplainedDocument {...props} />;
    case 'change':
      return <ChangeDocument {...props} path={document.path} />;
    case 'file':
      return <FileDocument {...props} path={document.path} />;
    case 'commit':
      return <CommitDocument {...props} oid={document.oid} />;
  }
}

function HandoffDocument(props: DocumentProps) {
  const published = usePublishedReview(props.scope, props.context);
  if (published.isPending)
    return (
      <p role="status" className="p-4 text-sm">
        Loading review…
      </p>
    );
  if (published.isError)
    return <PublicationFailure retry={() => void published.refetch()} />;
  if (published.data?.active)
    return <PublishedOverview review={published.data} onOpen={props.onOpen} />;
  return <PlainChangesDocument {...props} />;
}

function PlainChangesDocument({ scope, context, interaction }: DocumentProps) {
  const connection = useAccessStore((state) => state.connection);
  usePrefetchReviewed(scope, context);
  const list = useChanges(scope, connection).changes;
  const changes = useReviewChangeItems(scope, context, list);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReviewCodeDocument
        scope={scope}
        context={context}
        interaction={interaction}
        toolbar={(collapseControl) => (
          <DocumentToolbar title="Changes" subtitle={`${changes.length} files`}>
            {collapseControl}
            <MarkAllReviewed
              scope={scope}
              context={context}
              entries={changes}
            />
          </DocumentToolbar>
        )}
      />
    </div>
  );
}

function LayerDocument({
  layerId,
  ...props
}: DocumentProps & { layerId: string }) {
  const published = usePublishedReview(props.scope, props.context);
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
      {...props}
      layer={layer}
    />
  );
}

function ChangeDocument({
  scope,
  context,
  interaction,
  path,
}: DocumentProps & { path: string }) {
  const connection = useAccessStore((state) => state.connection);
  usePrefetchReviewed(scope, context);
  const list = useChanges(scope, connection).changes;
  const change = useReviewChangeItems(scope, context, list, [path]).find(
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
            <DiscardButton scope={scope} context={context} path={path} />
            <ReviewedControl
              scope={scope}
              context={context}
              path={path}
              fingerprint={change.fingerprint}
              status={change.reviewStatus}
            />
          </DocumentToolbar>
        )}
        scope={scope}
        context={context}
        interaction={interaction}
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

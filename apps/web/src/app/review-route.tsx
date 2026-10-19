import { useNavigate } from '@tanstack/react-router';
import {
  useConnectedContext,
  useRemoteConnections,
} from '@/features/access/index';
import { ReviewPage } from '@/features/reviews/index';
import { ConnectedWorkspace } from './connected-workspace';
import { Button } from '@/components/ui/button';

export function ReviewRoute({
  reviewId,
  revision,
  decision,
  environment,
}: {
  reviewId: string;
  revision?: string;
  decision?: string;
  environment?: string;
}) {
  const remotes = useRemoteConnections();
  const remote = remotes.find(
    (entry) => entry.remote.environmentId === environment,
  );
  const context = useConnectedContext(remote?.connection);
  const navigate = useNavigate();
  const back = () => {
    void navigate({ to: '/', search: {} });
  };
  if (environment && !remote)
    return (
      <ConnectedWorkspace>
        <div className="p-4">
          <p>This review's remote computer is not paired here.</p>
          <Button onClick={back}>Back to workspace</Button>
        </div>
      </ConnectedWorkspace>
    );
  const number = revision === undefined ? undefined : Number(revision);
  if (number !== undefined && (!Number.isSafeInteger(number) || number < 1))
    return (
      <ConnectedWorkspace>
        <div className="p-4">
          <p>Revision not found.</p>
          <Button onClick={back}>Back to workspace</Button>
        </div>
      </ConnectedWorkspace>
    );
  return (
    <ConnectedWorkspace {...(remote ? { remote } : {})}>
      <ReviewPage
        reviewId={reviewId}
        revision={number}
        decision={decision}
        context={context}
        onBack={back}
        onRevision={(selected) => {
          if (selected === undefined)
            void navigate({
              to: '/reviews/$reviewId',
              params: { reviewId },
              search: { environment, decision: undefined },
            });
          else
            void navigate({
              to: '/reviews/$reviewId/$revision',
              params: { reviewId, revision: String(selected) },
              search: { environment, decision: undefined },
            });
        }}
        onDecision={(selected, layerId) => {
          void navigate({
            to: '/reviews/$reviewId/$revision/decisions/$layerId',
            params: { reviewId, revision: String(selected), layerId },
            search: { environment, decision: undefined },
          });
        }}
      />
    </ConnectedWorkspace>
  );
}

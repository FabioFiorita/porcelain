import { SidebarTrigger } from '@/components/ui/sidebar';
import { useNavigate } from '@tanstack/react-router';
import {
  useConnectedContext,
  useRemoteConnections,
} from '@/features/access/index';
import { ReviewPage, ReviewMissing } from '@/features/reviews/index';
import { ConnectedWorkspace } from './connected-workspace';
import { StateNotice } from '@/components/state-notice';
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
        <StateNotice
          title="Computer not paired"
          description="This review's remote computer is not paired here."
        >
          <Button
            variant="outline"
            onClick={() =>
              void navigate({
                to: '/settings/$section',
                params: { section: 'computers' },
              })
            }
          >
            Computer settings
          </Button>
          <Button variant="ghost" onClick={back}>
            Back to workspace
          </Button>
        </StateNotice>
      </ConnectedWorkspace>
    );
  const number = revision === undefined ? undefined : Number(revision);
  if (number !== undefined && (!Number.isSafeInteger(number) || number < 1))
    return (
      <ConnectedWorkspace>
        <ReviewMissing
          reviewId={reviewId}
          revision={revision}
          context={context}
          onBack={back}
          onRevision={() =>
            void navigate({
              to: '/reviews/$reviewId',
              params: { reviewId },
              search: { environment, decision: undefined },
            })
          }
        />
      </ConnectedWorkspace>
    );
  return (
    <ConnectedWorkspace {...(remote ? { remote } : {})}>
      <ReviewPage
        navigation={<SidebarTrigger aria-label="Toggle Sidebar" />}
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

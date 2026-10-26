import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { detectPlatform, formatForDisplay } from '@tanstack/react-hotkeys';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useNavigate } from '@tanstack/react-router';
import {
  useConnectedContext,
  useRemoteConnections,
} from '@/features/access/index';
import { ReviewPage, ReviewMissing } from '@/features/reviews/index';
import { ConnectedWorkspace } from './connected-workspace';
import { StateFrame, StateNotice } from '@/shared/views/state-notice';
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
        <StateFrame
          navigation={<SidebarTrigger aria-label="Toggle Sidebar" />}
          title="Review"
        >
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
        </StateFrame>
      </ConnectedWorkspace>
    );
  const number = revision === undefined ? undefined : Number(revision);
  if (number !== undefined && (!Number.isSafeInteger(number) || number < 1))
    return (
      <ConnectedWorkspace>
        <ReviewMissing
          navigation={<SidebarTrigger aria-label="Toggle Sidebar" />}
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
        navigation={
          <Tooltip>
            <TooltipTrigger
              render={
                <SidebarTrigger
                  aria-label="Toggle Sidebar"
                  aria-keyshortcuts={
                    detectPlatform() === 'mac' ? 'Meta+B' : 'Control+B'
                  }
                />
              }
            />
            <TooltipContent>
              Toggle Sidebar{' '}
              <Kbd>{formatForDisplay(SHORTCUTS.toggleNavigator)}</Kbd>
            </TooltipContent>
          </Tooltip>
        }
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
        onStop={(layerId) => {
          if (number === undefined)
            void navigate({
              to: '/reviews/$reviewId',
              params: { reviewId },
              search: { environment, decision: layerId },
            });
          else if (layerId === undefined)
            void navigate({
              to: '/reviews/$reviewId/$revision',
              params: { reviewId, revision: String(number) },
              search: { environment, decision: undefined },
            });
          else
            void navigate({
              to: '/reviews/$reviewId/$revision/decisions/$layerId',
              params: { reviewId, revision: String(number), layerId },
              search: { environment, decision: undefined },
            });
        }}
      />
    </ConnectedWorkspace>
  );
}

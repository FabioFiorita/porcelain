import { remoteStatusText } from '@porcelain/client/access/rules';
import { Button } from '@/components/ui/button';
import { StateNotice, StateSpinner } from '@/shared/views/state-notice';

import { type RemoteStatus } from '@porcelain/client/access/rules';

export function RemoteUnavailable({
  name,
  status,
  onOpenRemotes,
  onRetry,
}: {
  name: string;
  status: RemoteStatus;
  onOpenRemotes: () => void;
  onRetry: () => void;
}) {
  if (status.kind === 'online') return null;
  if (status.kind === 'checking')
    return <StateSpinner label={`Reaching ${name}`} />;
  if (status.kind === 'reconnecting')
    return (
      <StateNotice
        role="status"
        message={`${name}: ${remoteStatusText(status)}`}
      />
    );
  return (
    <StateNotice
      role="status"
      message={
        status.kind === 'offline'
          ? `${name} is offline`
          : `${name}: ${remoteStatusText(status)}`
      }
      action={
        <div className="flex gap-2">
          {status.kind === 'offline' && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onOpenRemotes}>
            Computer settings
          </Button>
        </div>
      }
    />
  );
}

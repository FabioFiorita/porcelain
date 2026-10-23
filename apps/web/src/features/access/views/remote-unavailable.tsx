import {
  remoteStatusNote,
  remoteStatusText,
} from '@porcelain/client/access/rules';
import { LinkIcon, ServerOffIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { StateNotice } from '@/components/state-notice';

import { type RemoteStatus } from '@porcelain/client/access/rules';

export function RemoteUnavailable({
  name,
  status,
  onOpenRemotes,
}: {
  name: string;
  status: RemoteStatus;
  onOpenRemotes: () => void;
}) {
  if (status.kind === 'online') return null;
  const waiting = status.kind === 'checking' || status.kind === 'reconnecting';
  return (
    <StateNotice
      role="status"
      icon={
        waiting ? (
          <Spinner />
        ) : status.kind === 'needs-pairing' ? (
          <LinkIcon />
        ) : (
          <ServerOffIcon />
        )
      }
      title={
        status.kind === 'offline'
          ? `${name} is offline`
          : `${name}: ${remoteStatusText(status)}`
      }
      description={remoteStatusNote(status)}
    >
      {!waiting && (
        <Button variant="outline" onClick={onOpenRemotes}>
          Computer settings
        </Button>
      )}
    </StateNotice>
  );
}

import { ServerOffIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  remoteStatusNote,
  remoteStatusText,
  type RemoteStatus,
} from '../rules/remotes';

export function RemoteUnavailable({
  name,
  status,
  onOpenRemotes,
}: {
  name: string;
  status: RemoteStatus;
  onOpenRemotes: () => void;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ServerOffIcon />
        </EmptyMedia>
        <EmptyTitle>
          {name}: {remoteStatusText(status)}
        </EmptyTitle>
        <EmptyDescription>{remoteStatusNote(status)}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={onOpenRemotes}>
          Open Remote computers
        </Button>
      </EmptyContent>
    </Empty>
  );
}

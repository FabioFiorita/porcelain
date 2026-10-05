import {
  remoteStatusNote,
  remoteStatusText,
} from '@porcelain/client/access/rules';
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

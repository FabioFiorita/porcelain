import { DisconnectedPage } from './disconnected-page';
import { NotPaired } from './not-paired';

export function PairingView({ reason }: { reason?: string }) {
  return (
    <DisconnectedPage>
      <NotPaired reason={reason} pending={!reason} />
    </DisconnectedPage>
  );
}

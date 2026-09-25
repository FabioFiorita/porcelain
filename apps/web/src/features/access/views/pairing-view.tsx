import { usePairingFlow } from '../queries/pairing-flow';
import { DisconnectedPage } from './disconnected-page';
import { NotPaired } from './not-paired';

export function PairingView() {
  const failure = usePairingFlow();

  return (
    <DisconnectedPage>
      {failure ? (
        <NotPaired reason={failure} />
      ) : (
        <section className="mx-auto flex w-full max-w-md flex-col gap-2">
          <h2 className="text-lg font-medium">Pairing this browser…</h2>
          <p className="text-sm text-muted-foreground">
            Checking that the link belongs to this Porcelain installation.
          </p>
        </section>
      )}
    </DisconnectedPage>
  );
}

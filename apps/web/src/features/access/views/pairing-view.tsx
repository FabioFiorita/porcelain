import { usePairingFlow } from '../adapters/pairing-flow';
import { usePairing } from '../commands/pairing';
import { connectionErrorMessage } from '../queries/session';
import { DisconnectedPage } from './disconnected-page';
import { NotPaired } from './not-paired';

export function PairingView() {
  const pairing = usePairing();
  const missing = usePairingFlow(pairing.submit);
  const failure =
    missing ?? (pairing.error ? connectionErrorMessage(pairing.error) : null);

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

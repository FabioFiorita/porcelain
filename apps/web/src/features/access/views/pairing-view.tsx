import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
  connectionErrorMessage,
  openedPairingLink,
  usePairing,
} from '../queries/connection';
import { DisconnectedPage } from './disconnected-page';
import { NotPaired } from './not-paired';

export function PairingView() {
  const navigate = useNavigate();
  const pairing = usePairing();
  const [link] = useState(openedPairingLink);
  const [failure, setFailure] = useState<string | null>(
    link ? null : 'That link carried no pairing code.',
  );
  const attempted = useRef(false);
  useEffect(() => {
    if (!link || attempted.current) return;
    attempted.current = true;
    void (async () => {
      try {
        await pairing.submit(link);
        await navigate({ to: '/', replace: true });
      } catch (error) {
        setFailure(connectionErrorMessage(error));
      }
    })();
  }, [link, pairing, navigate]);

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

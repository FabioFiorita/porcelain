import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
  connectionErrorMessage,
  openedPairingLink,
  usePairing,
} from '../../query/connection';
import { DisconnectedPage } from './disconnected-page';
import { NotPaired } from './not-paired';

/**
 * The page a pairing link opens. The code was taken out of the address bar
 * before anything rendered, so this reads it from memory, redeems it once and
 * sends the owner on to the workspace.
 */
export function PairingView() {
  const navigate = useNavigate();
  const pairing = usePairing();
  // Read once and kept: the code is handed out a single time, so a re-render
  // must not find it already gone.
  const [link] = useState(openedPairingLink);
  const [failure, setFailure] = useState<string | null>(
    link ? null : 'That link carried no pairing code.',
  );
  // A code is single use: redeeming it twice spends a link the owner still
  // needs, so this runs once per page load and never on a re-render.
  const attempted = useRef(false);
  // The failure message is the page's whole result, so it has to survive the
  // request that produced it.
  // react-doctor-disable-next-line react-doctor/no-set-state-after-await-in-effect
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

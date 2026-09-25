import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
  connectionErrorMessage,
  openedPairingLink,
  usePairing,
} from './connection';

export function usePairingFlow() {
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
  return failure;
}

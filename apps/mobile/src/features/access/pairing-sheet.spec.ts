import { expect, test } from 'vitest';
import { scheduledRegistry } from '../../../spec/kit/atom-registry';
import {
  pairingLinkArrival,
  pairingSheetLink,
  pairingSheetSession,
} from './pairing-sheet';

const link =
  'https://porcelain.fabiofiorita.com/open/pair#c=one-time&e=computer&a=http%3A%2F%2F192.168.1.20%3A4555';

test('a link that arrives before the pairing sheet opens fills it, and closing the sheet forgets it', () => {
  const { registry, flush } = scheduledRegistry();
  try {
    const leaveArrival = registry.mount(pairingLinkArrival(link));
    leaveArrival();
    flush();
    const leaveSheet = registry.mount(pairingSheetSession);
    expect(registry.get(pairingSheetLink)).toBe(link);
    leaveSheet();
    flush();
    expect(registry.get(pairingSheetLink)).toBe('');
  } finally {
    registry.dispose();
  }
});

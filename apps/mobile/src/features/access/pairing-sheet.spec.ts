import { expect, test } from 'vitest';
import { scheduledRegistry } from '../../../spec/kit/atom-registry';
import {
  acceptScannedPairingLink,
  pairingLinkArrival,
  pairingScanAccepted,
  pairingSheetLink,
  pairingSheetSession,
  receivePairingIntent,
} from './pairing-sheet';

const link =
  'https://porcelain.fabiofiorita.com/open/pair#c=one-time&e=computer&a=http%3A%2F%2F192.168.1.20%3A4555';
const otherLink =
  'https://porcelain.fabiofiorita.com/open/pair#c=other&e=laptop&a=http%3A%2F%2F192.168.1.30%3A4555';

test('an incoming pairing link fills the next pairing sheet once, and closing the sheet forgets it', () => {
  const { registry, flush } = scheduledRegistry();
  try {
    const slot: { value: string | undefined } = { value: undefined };
    const incoming = {
      get value() {
        return slot.value;
      },
      set: (next: string | undefined) => {
        slot.value = next;
      },
    };
    const arrival = pairingLinkArrival(incoming);
    expect(receivePairingIntent(incoming, link)).toBe('/open/pair');
    const leaveArrival = registry.mount(arrival);
    const leaveSheet = registry.mount(pairingSheetSession);
    expect(registry.get(pairingSheetLink)).toBe(link);
    leaveArrival();
    leaveSheet();
    flush();
    expect(registry.get(pairingSheetLink)).toBe('');
    const again = registry.mount(arrival);
    expect(registry.get(pairingSheetLink)).toBe('');
    again();
  } finally {
    registry.dispose();
  }
});

test('the scanner keeps the first accepted pairing link while it closes', () => {
  const { registry } = scheduledRegistry();
  try {
    const leave = registry.mount(pairingScanAccepted);
    registry.set(acceptScannedPairingLink, link);
    registry.set(acceptScannedPairingLink, otherLink);
    expect(registry.get(pairingSheetLink)).toBe(link);
    leave();
  } finally {
    registry.dispose();
  }
});

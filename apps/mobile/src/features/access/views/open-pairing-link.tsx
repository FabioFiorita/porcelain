import { useLinkingURL } from 'expo-linking';
import { Redirect } from 'expo-router';
import { incomingPairingLink } from '../rules/pairing-link-intake';
import { usePairingLinkArrival } from '../pairing-sheet';

export function OpenPairingLink() {
  usePairingLinkArrival(incomingPairingLink(useLinkingURL()) ?? '');
  return <Redirect href="/pair-computer" />;
}

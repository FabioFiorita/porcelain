import { Redirect } from 'expo-router';
import { usePairingLinkArrival } from '../store';

export function OpenPairingLink() {
  usePairingLinkArrival();
  return <Redirect href="/pair-computer" />;
}

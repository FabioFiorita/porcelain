import type { Transport } from '../../../shared/api/transport.ts';
import type { PairingPlatform } from './pairing-platform.ts';

export type AccessPlatform = PairingPlatform & {
  send: (address: URL, init: Parameters<Transport>[1]) => Promise<Response>;
};

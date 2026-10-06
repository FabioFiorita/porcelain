import type { Transport } from '../../../shared/api/transport.ts';
import type { PairingPlatform } from './pairing-platform.ts';

export type AccessPlatform = Context.Service.Shape<typeof PairingPlatform> & {
  send: (address: URL, init: Parameters<Transport>[1]) => Promise<Response>;
};
import type { Context } from 'effect';

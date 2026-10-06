import { Context } from 'effect';
import type { Transport } from '../../../shared/api/transport.ts';
import type { PairingPlatform } from './pairing-platform.ts';

export class AccessPlatform extends Context.Service<
  AccessPlatform,
  Context.Service.Shape<typeof PairingPlatform> & {
    readonly send: (
      address: URL,
      init: Parameters<Transport>[1],
    ) => Promise<Response>;
  }
>()('@porcelain/client/AccessPlatform') {}

export type AccessPlatformValue = Context.Service.Shape<typeof AccessPlatform>;

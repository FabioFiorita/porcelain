import { Context } from 'effect';
import type { Transport } from '../../../shared/api/transport.ts';
import type { PairingPlatform } from './pairing-platform.ts';
import type { StatusActivity } from './status-activity.ts';

export class AccessPlatform extends Context.Service<
  AccessPlatform,
  Context.Service.Shape<typeof PairingPlatform> & {
    readonly statusActivity?: StatusActivity;
    readonly send: (
      address: URL,
      init: Parameters<Transport>[1],
    ) => Promise<Response>;
  }
>()('@porcelain/client/AccessPlatform') {}

export type AccessPlatformValue = Context.Service.Shape<typeof AccessPlatform>;

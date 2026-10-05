import { Context } from 'effect';
import type { Effect } from 'effect';
import type { DefaultRoute, NetworkAddress } from '../models/remote-access.ts';

export interface NetworkAddressReader {
  list(): NetworkAddress[];
  defaultRoutes(): Effect.Effect<DefaultRoute[]>;
}

export const NetworkAddressReader = Context.Service<
  '@porcelain/access/NetworkAddressReader',
  NetworkAddressReader
>('@porcelain/access/NetworkAddressReader');

import type { NetworkAddress } from '../models/remote-access.ts';

export interface NetworkAddressReader {
  list(): NetworkAddress[];
  routeTable(): string;
  neighbourTable(): string;
}

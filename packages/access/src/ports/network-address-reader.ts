import type { DefaultRoute, NetworkAddress } from '../models/remote-access.ts';

export interface NetworkAddressReader {
  list(): NetworkAddress[];
  defaultRoutes(): Promise<DefaultRoute[]>;
}

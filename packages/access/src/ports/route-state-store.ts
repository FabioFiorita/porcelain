import type { RemoteRoutes } from '../models/remote-access.ts';

export interface RouteStateStore {
  read(): RemoteRoutes;
  save(input: RemoteRoutes): void;
}

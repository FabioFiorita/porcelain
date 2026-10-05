import { Context } from 'effect';
import type { RemoteRoutes } from '../models/remote-access.ts';

export interface RouteStateStore {
  read(): RemoteRoutes;
  save(input: RemoteRoutes): void;
}

export const RouteStateStore = Context.Service<
  '@porcelain/access/RouteStateStore',
  RouteStateStore
>('@porcelain/access/RouteStateStore');

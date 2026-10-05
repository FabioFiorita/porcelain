import { Context } from 'effect';
import type { RemoteRouteOptions as RemoteRouteOptionsShape } from '../models/remote-access.ts';
export const RemoteRouteOptions = Context.Service<
  '@porcelain/access/RemoteRouteOptions',
  RemoteRouteOptionsShape
>('@porcelain/access/RemoteRouteOptions');

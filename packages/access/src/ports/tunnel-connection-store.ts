import { Context } from 'effect';
import type { TunnelHostnames } from '../models/remote-access.ts';

export interface TunnelConnectionStore {
  retain(input: TunnelHostnames): void;
}

export const TunnelConnectionStore = Context.Service<
  '@porcelain/access/TunnelConnectionStore',
  TunnelConnectionStore
>('@porcelain/access/TunnelConnectionStore');

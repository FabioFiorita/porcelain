import type { TunnelHostnames } from '../models/remote-access.ts';

export interface TunnelConnectionStore {
  retain(input: TunnelHostnames): void;
}

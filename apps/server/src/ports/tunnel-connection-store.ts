import type { TunnelHostnames } from '@porcelain/access/models';
import type {
  HeldConnection,
  ReleaseConnection,
} from './device-connection-store.ts';

export type TunnelConnection = {
  hostname: string;
  connection: HeldConnection;
};

export interface TunnelConnectionStore {
  insert(input: TunnelConnection): ReleaseConnection;
  retain(input: TunnelHostnames): void;
}

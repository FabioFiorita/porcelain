import type { NetworkListener, SocketListener } from './closable-listener.ts';
import type { Job } from './job.ts';

export type OpenedServer = {
  jobs: readonly Job[];
  network: NetworkListener;
  owner: SocketListener;
  close(): Promise<void>;
};

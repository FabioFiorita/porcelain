import type { LiveChannel } from './live-channel.ts';
import type { LiveClient } from './live-client.ts';

export type LiveConnector = {
  connect(channel: LiveChannel): LiveClient;
};

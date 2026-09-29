import type { DeviceRoute } from './device.ts';

export type IdentifyRequestClientInput = {
  host: string | undefined;
  scheme: string;
  peerAddress: string;
  localAddress: string | undefined;
  localPort: number | undefined;
  connectingAddress: string | undefined;
  forwardedFor: string | undefined;
};

export type RequestClient = {
  route: DeviceRoute;
  address: string;
  secure: boolean;
  tunnelHostname?: string | undefined;
};

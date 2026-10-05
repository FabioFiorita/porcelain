import type {
  NetworkAddressReader,
  PairingReachReader,
  RouteListenerRunner,
  RuntimeStatusReader,
  TunnelProbe,
} from '@porcelain/access/ports';
import type { DeviceConnectionStore } from '../ports/device-connection-store.ts';
import type { TunnelConnectionStore } from '../ports/tunnel-connection-store.ts';
import type { ServiceUpdateRunner } from '../ports/service-update-runner.ts';
import type { Shared } from './compose-shared.ts';
import type { Stores } from './compose-stores.ts';
import type { ServerHost } from '../ports/server-host.ts';
import type { Clock, IdSource } from '@porcelain/kernel/ports';
import type { ServerSettings } from '../config/server-settings.ts';
import type { EventPublisher } from '../ports/event-publisher.ts';
import type { Logger } from '../ports/logger.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';

export type ComposeContext = {
  lanes: Lanes;
  laneKeys: LaneKeys;
  events: EventPublisher;
  settings: ServerSettings;
  clock: Clock;
  ids: IdSource;
  logger: Logger;
};

export type AccessDependencies = {
  stores: Stores;
  desktopSession: ServerHost['desktopSession'];
  shared: Shared;
  deviceConnections: DeviceConnectionStore;
  tunnelConnections: TunnelConnectionStore;
  pairingReachReader: PairingReachReader;
  runtimeStatusReader: RuntimeStatusReader;
  serviceUpdateRunner: ServiceUpdateRunner;
  serverVersion: string | undefined;
  networkAddressReader: NetworkAddressReader;
  routeListenerRunner: RouteListenerRunner;
  tunnelProbe: TunnelProbe;
};

import type { Clock } from '@porcelain/kernel/ports';
import type { ListAccessResult } from '../models/list-access.ts';
import type { DeviceStore } from '../ports/device-store.ts';
import type { PairingGrantStore } from '../ports/pairing-grant-store.ts';
import { deviceRevoked } from '../rules/device-activity.ts';
import { pairingGrantPending } from '../rules/pairing-grant.ts';

export class ListAccessService {
  private readonly pairingGrants: PairingGrantStore;
  private readonly devices: DeviceStore;
  private readonly clock: Clock;

  constructor(
    pairingGrants: PairingGrantStore,
    devices: DeviceStore,
    clock: Clock,
  ) {
    this.pairingGrants = pairingGrants;
    this.devices = devices;
    this.clock = clock;
  }

  execute(): ListAccessResult {
    const now = this.clock.now();
    return {
      grants: this.pairingGrants
        .list()
        .filter((grant) => pairingGrantPending(grant, now))
        .map(({ id, label, addresses, createdAt, expiresAt }) => ({
          id,
          label,
          addresses,
          createdAt,
          expiresAt,
        })),
      devices: this.devices
        .list()
        .filter((device) => !deviceRevoked(device))
        .map(
          ({
            id,
            label,
            platform,
            createdAt,
            lastSeenAt,
            lastSeenAddress,
          }) => ({
            id,
            label,
            platform,
            createdAt,
            lastSeenAt,
            ...(lastSeenAddress === undefined ? {} : { lastSeenAddress }),
          }),
        ),
    };
  }
}

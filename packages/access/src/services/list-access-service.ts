import type { Clock } from '@porcelain/kernel/ports';
import type { ListAccessResult } from '../models/list-access.ts';
import type { DeviceStore } from '../ports/device-store.ts';
import type { PairingGrantStore } from '../ports/pairing-grant-store.ts';
import { pairingGrantPending } from '../rules/pairing-grant.ts';

export class ListAccessService {
  private readonly pairingGrantStore: PairingGrantStore;
  private readonly deviceStore: DeviceStore;
  private readonly clock: Clock;

  constructor(
    pairingGrantStore: PairingGrantStore,
    deviceStore: DeviceStore,
    clock: Clock,
  ) {
    this.pairingGrantStore = pairingGrantStore;
    this.deviceStore = deviceStore;
    this.clock = clock;
  }

  execute(): ListAccessResult {
    const now = this.clock.now();
    return {
      grants: this.pairingGrantStore
        .list()
        .filter((grant) => pairingGrantPending(grant, now))
        .map(({ id, label, addresses, createdAt, expiresAt }) => ({
          id,
          label,
          addresses,
          createdAt,
          expiresAt,
        })),
      devices: this.deviceStore
        .list()
        .filter((device) => device.revokedAt === undefined)
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

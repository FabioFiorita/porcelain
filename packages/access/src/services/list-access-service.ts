import type { AccessListing } from '../models/pairing.ts';
import type { DeviceStore } from '../ports/device-store.ts';
import type { PairingGrantStore } from '../ports/pairing-grant-store.ts';

export class ListAccessService {
  private readonly grants: PairingGrantStore;
  private readonly devices: DeviceStore;
  private readonly now: () => number;

  constructor(
    grants: PairingGrantStore,
    devices: DeviceStore,
    now: () => number = Date.now,
  ) {
    this.grants = grants;
    this.devices = devices;
    this.now = now;
  }

  execute(): AccessListing {
    return {
      grants: this.grants.listGrants(new Date(this.now()).toISOString()),
      devices: this.devices.listDevices(),
    };
  }
}

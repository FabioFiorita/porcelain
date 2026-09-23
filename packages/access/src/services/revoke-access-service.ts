import type { DeviceRegistry } from '../ports/device-registry.ts';
import type { PairingGrantStore } from '../ports/pairing-grant-store.ts';

export class RevokeAccessService {
  private readonly grants: PairingGrantStore;
  private readonly directory: DeviceRegistry;
  private readonly now: () => number;

  constructor(
    grants: PairingGrantStore,
    directory: DeviceRegistry,
    now: () => number = Date.now,
  ) {
    this.grants = grants;
    this.directory = directory;
    this.now = now;
  }

  execute(id: string): { revoked: boolean; kind?: 'grant' | 'device' } {
    const at = new Date(this.now()).toISOString();
    if (this.grants.revokeGrant(id, at))
      return { revoked: true, kind: 'grant' };
    if (this.directory.revoke(id, at)) return { revoked: true, kind: 'device' };
    return { revoked: false };
  }
}

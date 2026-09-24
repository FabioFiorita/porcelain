import type { DeviceActivityStore } from '../ports/device-activity-store.ts';

export class FlushDeviceActivityService {
  private readonly deviceActivityStore: DeviceActivityStore;

  constructor(deviceActivityStore: DeviceActivityStore) {
    this.deviceActivityStore = deviceActivityStore;
  }

  execute(): void {
    this.deviceActivityStore.flush();
  }
}

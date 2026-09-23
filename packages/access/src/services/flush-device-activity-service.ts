import type {
  FlushDeviceActivityInput,
  FlushDeviceActivityResult,
} from '../models/flush-device-activity.ts';
import type { DeviceActivityStore } from '../ports/device-activity-store.ts';

export class FlushDeviceActivityService {
  private readonly deviceActivityStore: DeviceActivityStore;

  constructor(deviceActivityStore: DeviceActivityStore) {
    this.deviceActivityStore = deviceActivityStore;
  }

  execute(input: FlushDeviceActivityInput): FlushDeviceActivityResult {
    void input;
    this.deviceActivityStore.flush();
    return {};
  }
}

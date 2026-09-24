import type { DeviceActivityWriter } from '../ports/device-activity-writer.ts';

export class FlushDeviceActivityService {
  private readonly deviceActivityWriter: DeviceActivityWriter;

  constructor(deviceActivityWriter: DeviceActivityWriter) {
    this.deviceActivityWriter = deviceActivityWriter;
  }

  execute(): void {
    this.deviceActivityWriter.flush();
  }
}

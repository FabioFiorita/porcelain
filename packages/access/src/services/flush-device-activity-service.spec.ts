import { describe, expect, it } from 'vitest';
import type { StoredDevice } from '@porcelain/access/models';
import { InMemoryDeviceSightingStore } from '../../spec/fakes/in-memory-device-sighting-store.ts';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';
import { FlushDeviceActivityService } from './flush-device-activity-service.ts';

const device: StoredDevice = {
  id: 'device',
  label: 'Phone',
  platform: 'iOS',
  createdAt: '2026-09-22T10:00:00.000Z',
  lastSeenAt: '2026-09-23T09:00:00.000Z',
  secretHash: 'hash',
};

function setup() {
  const devices = new InMemoryDeviceStore();
  devices.add(device);
  const sightings = new InMemoryDeviceSightingStore();
  return {
    devices,
    sightings,
    service: new FlushDeviceActivityService(sightings, devices),
  };
}

describe('FlushDeviceActivityService', () => {
  it('stores each pending sighting and leaves none pending', () => {
    const { devices, sightings, service } = setup();
    sightings.save({
      device: {
        ...device,
        lastSeenAt: '2026-09-23T10:00:00.000Z',
        lastSeenAddress: '10.0.0.1',
      },
    });
    service.execute();
    expect(devices.find({ deviceId: 'device' })).toMatchObject({
      lastSeenAt: '2026-09-23T10:00:00.000Z',
      lastSeenAddress: '10.0.0.1',
    });
    expect(sightings.take()).toEqual([]);
  });

  it('changes nothing when no device was seen since the last flush', () => {
    const { devices, service } = setup();
    service.execute();
    expect(devices.find({ deviceId: 'device' })).toEqual(device);
  });
});

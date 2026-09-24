import { describe, expect, it } from 'vitest';
import { RecordingHeldConnection } from '../../../spec/fakes/recording-held-connection.ts';
import { InMemoryDeviceConnectionStore } from './in-memory-device-connection-store.ts';

describe('InMemoryDeviceConnectionStore', () => {
  it('closes every connection a removed device holds and none of another device', () => {
    const store = new InMemoryDeviceConnectionStore();
    const first = new RecordingHeldConnection();
    const second = new RecordingHeldConnection();
    const other = new RecordingHeldConnection();
    store.insert({ deviceId: 'phone', connection: first });
    store.insert({ deviceId: 'phone', connection: second });
    store.insert({ deviceId: 'tablet', connection: other });
    store.remove({ deviceId: 'phone' });
    expect([
      first.timesClosed(),
      second.timesClosed(),
      other.timesClosed(),
    ]).toEqual([1, 1, 0]);
  });

  it('leaves a released connection open when its device is removed', () => {
    const store = new InMemoryDeviceConnectionStore();
    const released = new RecordingHeldConnection();
    const held = new RecordingHeldConnection();
    const release = store.insert({ deviceId: 'phone', connection: released });
    store.insert({ deviceId: 'phone', connection: held });
    release();
    store.remove({ deviceId: 'phone' });
    expect([released.timesClosed(), held.timesClosed()]).toEqual([0, 1]);
  });

  it('closes a connection once when its device is removed twice', () => {
    const store = new InMemoryDeviceConnectionStore();
    const connection = new RecordingHeldConnection();
    store.insert({ deviceId: 'phone', connection });
    store.remove({ deviceId: 'phone' });
    store.remove({ deviceId: 'phone' });
    expect(connection.timesClosed()).toBe(1);
  });

  it('closes nothing when a device without connections is removed', () => {
    const store = new InMemoryDeviceConnectionStore();
    const connection = new RecordingHeldConnection();
    store.insert({ deviceId: 'tablet', connection });
    store.remove({ deviceId: 'phone' });
    expect(connection.timesClosed()).toBe(0);
  });
});

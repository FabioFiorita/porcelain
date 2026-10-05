import { Cache, Duration, Effect, Layer } from 'effect';
import { DeviceStore } from '@porcelain/access/ports';

export const cachedDeviceStoreLayer = Layer.effect(
  DeviceStore,
  Effect.gen(function* () {
    const devices = yield* DeviceStore;
    const cached = yield* Cache.make({
      capacity: Number.POSITIVE_INFINITY,
      timeToLive: Duration.infinity,
      lookup: (deviceId: string) => devices.find({ deviceId }),
    });
    return DeviceStore.of({
      find: Effect.fn('DeviceCache.find')(function* (input) {
        const stored = yield* Cache.get(cached, input.deviceId);
        if (stored === undefined) {
          yield* Cache.invalidate(cached, input.deviceId);
          return undefined;
        }
        return { ...stored };
      }),
      list: () => devices.list(),
      markRevoked: Effect.fn('DeviceCache.markRevoked')(function* (input) {
        yield* devices.markRevoked(input);
        yield* Cache.invalidate(cached, input.device.id);
      }),
      recordSighting: Effect.fn('DeviceCache.recordSighting')(
        function* (input) {
          yield* devices.recordSighting(input);
          yield* Cache.invalidate(cached, input.device.id);
        },
      ),
      recordTrust: Effect.fn('DeviceCache.recordTrust')(function* (input) {
        yield* devices.recordTrust(input);
        yield* Cache.invalidate(cached, input.device.id);
      }),
    });
  }),
);

import { Effect, Context, Layer } from 'effect';
import { DeviceSightingStore } from '../ports/device-sighting-store.ts';
import { DeviceStore } from '../ports/device-store.ts';

export class FlushDeviceActivityService extends Context.Service<
  FlushDeviceActivityService,
  { readonly execute: () => Effect.Effect<void, never> }
>()('@porcelain/access/FlushDeviceActivityService') {
  static readonly layer = Layer.effect(
    FlushDeviceActivityService,
    Effect.gen(function* () {
      const deviceSightings = yield* DeviceSightingStore;
      const devices = yield* DeviceStore;

      return {
        execute: Effect.fn('FlushDeviceActivityService.execute')(
          function* (): Effect.fn.Return<void, never> {
            return yield* Effect.sync<void>(() => {
              for (const device of deviceSightings.take())
                devices.recordSighting({ device });
            });
          },
        ),
      };
    }),
  );
}

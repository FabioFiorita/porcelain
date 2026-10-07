import { Effect } from 'effect';
import { DeviceSightingStore } from '@porcelain/access/ports';
import { deviceSightingStoreContract } from '@porcelain/access/store-contracts';
import { inMemoryDeviceSightingStoreLayer } from './in-memory-device-sighting-store.ts';

deviceSightingStoreContract('InMemoryDeviceSightingStore adapter', () =>
  Effect.runSync(
    DeviceSightingStore.pipe(Effect.provide(inMemoryDeviceSightingStoreLayer)),
  ),
);

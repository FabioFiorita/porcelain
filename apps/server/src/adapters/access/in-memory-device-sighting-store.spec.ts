import { deviceSightingStoreContract } from '@porcelain/access/store-contracts';
import { InMemoryDeviceSightingStore } from './in-memory-device-sighting-store.ts';

deviceSightingStoreContract(
  'InMemoryDeviceSightingStore adapter',
  () => new InMemoryDeviceSightingStore(),
);

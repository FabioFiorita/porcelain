import { deviceSightingStoreContract } from '../../spec/contracts/device-sighting-store-contract.ts';
import { InMemoryDeviceSightingStore } from '../../spec/fakes/in-memory-device-sighting-store.ts';

deviceSightingStoreContract(
  'InMemoryDeviceSightingStore',
  () => new InMemoryDeviceSightingStore(),
);

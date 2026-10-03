import { deviceStoreContract } from '../../spec/contracts/device-store-contract.ts';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';

deviceStoreContract('InMemoryDeviceStore', (devices) => {
  const store = new InMemoryDeviceStore();
  devices.forEach((device) => store.add(device));
  return { store, close: () => undefined };
});

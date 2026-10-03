import { pairingGrantStoreContract } from '../../spec/contracts/pairing-grant-store-contract.ts';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';
import { InMemoryPairingGrantStore } from '../../spec/fakes/in-memory-pairing-grant-store.ts';

pairingGrantStoreContract('InMemoryPairingGrantStore', () => {
  const devices = new InMemoryDeviceStore();
  return {
    grants: new InMemoryPairingGrantStore(devices),
    devices,
    close: () => undefined,
  };
});

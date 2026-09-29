import type { RemoteAccessSettings } from '../../src/models/remote-access.ts';
import type { RemoteAccessStore } from '../../src/ports/remote-access-store.ts';

export class InMemoryRemoteAccessStore implements RemoteAccessStore {
  private settings: RemoteAccessSettings = {
    lan: false,
    tailnet: false,
    cloudflare: false,
  };

  read(): RemoteAccessSettings {
    return { ...this.settings };
  }

  save(input: RemoteAccessSettings): void {
    this.settings = { ...input };
  }
}

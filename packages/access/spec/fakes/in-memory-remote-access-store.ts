import { Effect } from 'effect';
import type { RemoteAccessSettings } from '../../src/models/remote-access.ts';
import type { RemoteAccessStore } from '../../src/ports/remote-access-store.ts';

export class InMemoryRemoteAccessStore implements RemoteAccessStore {
  private settings: RemoteAccessSettings = {
    lan: false,
    tailnet: false,
    cloudflare: false,
  };

  read(): Effect.Effect<RemoteAccessSettings> {
    return Effect.sync(() => {
      return { ...this.settings };
    });
  }

  save(input: RemoteAccessSettings): Effect.Effect<void> {
    return Effect.sync(() => {
      this.settings = { ...input };
    });
  }
}

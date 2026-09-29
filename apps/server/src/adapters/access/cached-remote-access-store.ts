import type { RemoteAccessSettings } from '@porcelain/access/models';
import type { RemoteAccessStore } from '@porcelain/access/ports';

export class CachedRemoteAccessStore implements RemoteAccessStore {
  private readonly settings: RemoteAccessStore;
  private cached: RemoteAccessSettings | undefined;

  constructor(settings: RemoteAccessStore) {
    this.settings = settings;
  }

  read(): RemoteAccessSettings {
    this.cached ??= this.settings.read();
    return { ...this.cached };
  }

  save(input: RemoteAccessSettings): void {
    this.settings.save(input);
    this.cached = { ...input };
  }
}

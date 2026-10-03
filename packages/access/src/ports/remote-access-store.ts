import type { RemoteAccessSettings } from '../models/remote-access.ts';

export interface RemoteAccessStore {
  read(): RemoteAccessSettings;
  save(input: RemoteAccessSettings): void;
}

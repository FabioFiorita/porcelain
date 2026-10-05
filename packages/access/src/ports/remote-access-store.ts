import { Context } from 'effect';
import type { RemoteAccessSettings } from '../models/remote-access.ts';

export interface RemoteAccessStore {
  read(): RemoteAccessSettings;
  save(input: RemoteAccessSettings): void;
}

export const RemoteAccessStore = Context.Service<
  '@porcelain/access/RemoteAccessStore',
  RemoteAccessStore
>('@porcelain/access/RemoteAccessStore');

import type { Effect } from 'effect';
import { Context } from 'effect';
import type { RemoteAccessSettings } from '../models/remote-access.ts';

export interface RemoteAccessStore {
  read(): Effect.Effect<RemoteAccessSettings>;
  save(input: RemoteAccessSettings): Effect.Effect<void>;
}

export const RemoteAccessStore = Context.Service<
  '@porcelain/access/RemoteAccessStore',
  RemoteAccessStore
>('@porcelain/access/RemoteAccessStore');

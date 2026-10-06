import { Context } from 'effect';
import type { RemoteAccessOptions as RemoteAccessOptionsShape } from '../models/remote-access.ts';
export const RemoteAccessOptions = Context.Service<
  '@porcelain/access/RemoteAccessOptions',
  RemoteAccessOptionsShape
>('@porcelain/access/RemoteAccessOptions');

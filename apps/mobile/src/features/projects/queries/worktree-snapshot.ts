import { Stream } from 'effect';
import { Atom } from 'effect/reactivity';
import type { RemoteConnection } from '@porcelain/client/access';
import {
  collectWorktreeSnapshots,
  readWorktreeSnapshot,
} from '@porcelain/client/projects';
import { clientRuntime } from '../../../shared/application/store';

export const savedWorktrees = collectWorktreeSnapshots(
  Atom.family((computer: RemoteConnection) =>
    clientRuntime
      .atom(Stream.unwrap(readWorktreeSnapshot(computer)))
      .pipe(Atom.setIdleTTL(0)),
  ),
);

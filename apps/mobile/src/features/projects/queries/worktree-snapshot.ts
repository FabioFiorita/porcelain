import { Option, Stream } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { RemoteConnection } from '@porcelain/client/access';
import {
  readInventory,
  readWorktreeSnapshot,
} from '@porcelain/client/projects';
import { clientRuntime } from '../../../shared/application/store';

const computerSnapshot = Atom.family((computer: RemoteConnection) =>
  clientRuntime
    .atom(Stream.unwrap(readWorktreeSnapshot(computer)))
    .pipe(Atom.setIdleTTL(0)),
);

export const savedWorktrees = Atom.family(
  (computers: readonly RemoteConnection[]) =>
    Atom.readable((get) =>
      computers.flatMap((computer) => {
        const snapshot = Option.getOrUndefined(
          AsyncResult.value(get(computerSnapshot(computer))),
        );
        const live = AsyncResult.value(get(readInventory(computer.connection)));
        return snapshot && Option.isNone(live)
          ? [{ environmentId: computer.remote.environmentId, snapshot }]
          : [];
      }),
    ),
);

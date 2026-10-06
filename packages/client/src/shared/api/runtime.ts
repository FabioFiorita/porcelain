import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { porcelainClient } from './client.ts';
import type { RuntimeConnection } from './connection.ts';

export const clientRuntime = Atom.family((connection: RuntimeConnection) =>
  connection.atoms((get) =>
    Layer.merge(
      get(porcelainClient(connection).runtime.layer),
      Layer.effectContext(connection.runtime.contextEffect),
    ),
  ),
);

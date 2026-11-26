import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { requestApi } from '../../../shared/api/client.ts';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';

export const readViewer = Atom.family((connection: RuntimeConnection) =>
  clientRuntime(connection).atom(
    requestApi(connection, (api) => api.session.readSession()),
  ),
);

export const readDeviceLabels = Atom.family((connection: RuntimeConnection) =>
  clientRuntime(connection).atom(
    requestApi(connection, (api) => api.administration.listAccess()).pipe(
      Effect.map(
        (access): ReadonlyMap<string, string> =>
          new Map(access.devices.map((device) => [device.id, device.label])),
      ),
      Effect.orElseSucceed(() => undefined),
    ),
  ),
);

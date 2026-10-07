import { PorcelainClientApi } from '@porcelain/contracts/shared';
import { Atom, AtomHttpApi } from 'effect/reactivity';
import type { RuntimeConnection } from './connection.ts';
import { transportLayer } from './effect-client.ts';

export const porcelainClient = Atom.family((connection: RuntimeConnection) => {
  class Client extends AtomHttpApi.Service<Client>()(
    '@porcelain/client/HttpClient',
    {
      api: PorcelainClientApi,
      runtime: connection.atoms,
      httpClient: transportLayer(connection.transport),
    },
  ) {}
  return Client;
});

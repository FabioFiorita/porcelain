import type { Transport } from './transport.ts';

export function perConnection<Api>(create: (transport: Transport) => Api) {
  const created = new WeakMap<Transport, Api>();
  return (connection: { transport: Transport }): Api => {
    const known = created.get(connection.transport);
    if (known !== undefined) return known;
    const api = create(connection.transport);
    created.set(connection.transport, api);
    return api;
  };
}

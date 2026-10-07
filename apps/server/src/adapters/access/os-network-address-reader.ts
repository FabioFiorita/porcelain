import { Effect, FileSystem, Layer } from 'effect';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { NetworkAddressReader } from '@porcelain/access/ports';
import { linuxDefaultRoutes } from './linux-network-output.ts';

const ROUTE_TABLE = '/proc/net/route';
const NEIGHBOUR_TABLE = '/proc/net/arp';
const INTERFACES = '/sys/class/net';

function physical(name: string): boolean {
  return !name.includes('/') && existsSync(`${INTERFACES}/${name}/device`);
}

export const osNetworkAddressReaderLayer = Layer.effect(
  NetworkAddressReader,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const kernelTable = (path: string) =>
      fs.readFileString(path).pipe(Effect.catch(() => Effect.succeed('')));
    return {
      list: () => {
        return Object.entries(networkInterfaces()).flatMap(
          ([name, entries]) => {
            const hardware = physical(name);
            return (entries ?? []).map((entry) => ({
              interfaceName: name,
              address: entry.address,
              family: entry.family,
              internal: entry.internal,
              physical: hardware,
              netmask: entry.netmask,
              ...(entry.cidr === null ? {} : { cidr: entry.cidr }),
            }));
          },
        );
      },
      defaultRoutes: Effect.fn('OsNetworkAddressReader.defaultRoutes')(() =>
        Effect.all([kernelTable(ROUTE_TABLE), kernelTable(NEIGHBOUR_TABLE)], {
          concurrency: 'unbounded',
        }).pipe(
          Effect.map(([routes, neighbours]) =>
            linuxDefaultRoutes(routes, neighbours),
          ),
        ),
      ),
    };
  }),
);

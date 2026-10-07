import { Effect, Layer } from 'effect';
import { networkInterfaces } from 'node:os';
import { NetworkAddressReader } from '@porcelain/access/ports';
import type { Limits } from '../../config/limits.ts';
import {
  captureMacNetworkPlatform,
  readMacPrimaryService,
  readMacRoute,
} from './mac-network-command.ts';
import {
  macDefaultRoutes,
  macPhysicalInterface,
} from './mac-network-output.ts';

export const macNetworkAddressReaderLayer = (
  limits: Limits['access']['networkDiscovery'],
) =>
  Layer.effect(
    NetworkAddressReader,
    Effect.gen(function* () {
      const provideNetwork = yield* captureMacNetworkPlatform();
      return {
        list: () => {
          return Object.entries(networkInterfaces()).flatMap(
            ([name, entries]) =>
              (entries ?? []).map((entry) => ({
                interfaceName: name,
                address: entry.address,
                family: entry.family,
                internal: entry.internal,
                physical: macPhysicalInterface(name),
                netmask: entry.netmask,
                ...(entry.cidr === null ? {} : { cidr: entry.cidr }),
              })),
          );
        },
        defaultRoutes: Effect.fn('MacNetworkAddressReader.defaultRoutes')(() =>
          Effect.all([readMacRoute(limits), readMacPrimaryService(limits)], {
            concurrency: 'unbounded',
          }).pipe(
            provideNetwork,
            Effect.map(([route, service]) => macDefaultRoutes(route, service)),
          ),
        ),
      };
    }),
  );

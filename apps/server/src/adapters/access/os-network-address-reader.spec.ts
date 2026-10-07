import { it, expect } from '@effect/vitest';
import { Context, Effect, FileSystem, Layer } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { NetworkAddressReader } from '@porcelain/access/ports';
import { osNetworkAddressReaderLayer } from './os-network-address-reader.ts';

it.effect(
  'reads Linux route and neighbour tables through the filesystem and tolerates missing tables',
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      yield* fs.writeFileString(
        `${root}/route`,
        'Iface Destination Gateway Flags RefCnt Use Metric Mask\neth0 00000000 0101A8C0 0003 0 0 100 00000000\n',
      );
      yield* fs.writeFileString(
        `${root}/arp`,
        'IP address HW type Flags HW address Mask Device\n192.168.1.1 0x1 0x2 02:00:5e:10:00:01 * eth0\n',
      );
      const requested: string[] = [];
      const context = yield* Layer.build(
        osNetworkAddressReaderLayer.pipe(
          Layer.provide(
            Layer.succeed(FileSystem.FileSystem, {
              ...fs,
              readFileString: (path) => {
                requested.push(path);
                return fs.readFileString(
                  `${root}/${path === '/proc/net/route' ? 'route' : 'arp'}`,
                );
              },
            }),
          ),
        ),
      );
      const reader = Context.get(context, NetworkAddressReader);
      expect(yield* reader.defaultRoutes()).toEqual([
        {
          interfaceName: 'eth0',
          metric: 100,
          gateway: '192.168.1.1',
          gatewayHardware: '02:00:5e:10:00:01',
        },
      ]);
      expect(requested.toSorted()).toEqual([
        '/proc/net/arp',
        '/proc/net/route',
      ]);
      expect(
        reader
          .list()
          .some(
            (address) => address.address === '127.0.0.1' && address.internal,
          ),
      ).toBe(true);
      yield* fs.remove(`${root}/arp`);
      expect(yield* reader.defaultRoutes()).toEqual([
        { interfaceName: 'eth0', metric: 100, gateway: '192.168.1.1' },
      ]);
      yield* fs.remove(`${root}/route`);
      expect(yield* reader.defaultRoutes()).toEqual([]);
    }).pipe(Effect.provide(NodeServices.layer)),
);

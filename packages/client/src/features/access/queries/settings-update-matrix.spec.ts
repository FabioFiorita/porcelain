import { Effect } from 'effect';
import { AsyncResult, AtomRegistry } from 'effect/reactivity';
import { expect, it } from 'vitest';
import { clientFixtures } from '../../../../spec/kit/client-fixture.ts';
import type { ReadServiceUpdateResponse } from '@porcelain/contracts/access';
import type { SettingsUpdateTarget } from '../commands/settings-updates.ts';
import {
  settingsUpdateAvailable,
  settingsUpdateCount,
  settingsUpdateTrust,
  settingsUpdatesVisible,
} from '../rules/settings-updates.ts';
import { readServiceUpdate, serviceUpdateSnapshot } from './share.ts';

const fixture = clientFixtures();
const offered: ReadServiceUpdateResponse = {
  managed: true,
  available: true,
  version: '1.0.0',
  latest: '1.1.0',
  running: false,
  canUpdate: true,
  last: undefined,
};

type MatrixCase = {
  name: string;
  state?: Partial<ReadServiceUpdateResponse>;
  read?: 'loading' | 'error' | 'stale-error';
  mac?: 'available' | 'absent' | 'missing-latest';
  running?: boolean;
  visible: boolean;
  count: number;
  offered: number;
  trust?: boolean;
};

const cases: readonly MatrixCase[] = [
  { name: 'no computers', visible: false, count: 0, offered: 0 },
  {
    name: 'first request loading',
    state: {},
    read: 'loading',
    visible: false,
    count: 0,
    offered: 0,
  },
  {
    name: 'first request fails',
    state: {},
    read: 'error',
    visible: false,
    count: 0,
    offered: 0,
  },
  {
    name: 'refresh fails after an offer',
    state: {},
    read: 'stale-error',
    visible: false,
    count: 0,
    offered: 0,
  },
  {
    name: 'older installed, available',
    state: {},
    visible: true,
    count: 1,
    offered: 1,
  },
  {
    name: 'older installed, unavailable',
    state: { available: false },
    visible: false,
    count: 0,
    offered: 0,
  },
  {
    name: 'equal installed, unavailable',
    state: { version: '1.1.0', available: false },
    visible: false,
    count: 0,
    offered: 0,
  },
  {
    name: 'newer installed, unavailable',
    state: { version: '2.0.0', available: false },
    visible: false,
    count: 0,
    offered: 0,
  },
  {
    name: 'missing latest, unavailable',
    state: { latest: undefined, available: false },
    visible: false,
    count: 0,
    offered: 0,
  },
  {
    name: 'missing latest, reported available',
    state: { latest: undefined },
    visible: false,
    count: 0,
    offered: 0,
  },
  {
    name: 'unknown installed, available',
    state: { version: undefined },
    visible: true,
    count: 1,
    offered: 1,
  },
  {
    name: 'unmanaged, available',
    state: { managed: false },
    visible: true,
    count: 0,
    offered: 1,
  },
  {
    name: 'unmanaged, unavailable',
    state: { managed: false, available: false },
    visible: false,
    count: 0,
    offered: 0,
  },
  {
    name: 'needs trust, available',
    state: { canUpdate: false },
    visible: true,
    count: 0,
    offered: 1,
    trust: true,
  },
  {
    name: 'needs trust, unavailable',
    state: { canUpdate: false, available: false },
    visible: false,
    count: 0,
    offered: 0,
    trust: true,
  },
  {
    name: 'service updating',
    state: { running: true },
    visible: true,
    count: 0,
    offered: 1,
  },
  {
    name: 'batch active without offers',
    state: { available: false },
    running: true,
    visible: true,
    count: 0,
    offered: 0,
  },
  {
    name: 'batch active during request error',
    state: {},
    read: 'stale-error',
    running: true,
    visible: true,
    count: 0,
    offered: 0,
  },
  {
    name: 'settled batch without offers',
    state: { available: false },
    running: false,
    visible: false,
    count: 0,
    offered: 0,
  },
  {
    name: 'Mac update present',
    mac: 'available',
    visible: true,
    count: 1,
    offered: 1,
  },
  {
    name: 'Mac update absent',
    mac: 'absent',
    visible: false,
    count: 0,
    offered: 0,
  },
  {
    name: 'Mac latest missing',
    mac: 'missing-latest',
    visible: false,
    count: 0,
    offered: 0,
  },
  {
    name: 'Mac update with unavailable computer',
    mac: 'available',
    state: { available: false },
    visible: true,
    count: 1,
    offered: 1,
  },
  {
    name: 'Mac update with Needs trust',
    mac: 'available',
    state: { canUpdate: false },
    visible: true,
    count: 1,
    offered: 2,
    trust: true,
  },
];

it.each(cases)(
  '$name has the expected badge, offers, count and trust data',
  async (row) => {
    let reads = 0;
    const client = fixture(async () => {
      reads += 1;
      if (row.read === 'error' || (row.read === 'stale-error' && reads > 1))
        return new Response(null, { status: 503 });
      const state = { ...offered, ...row.state };
      return Response.json({
        ...state,
        version: state.version ?? null,
        latest: state.latest ?? null,
        last: state.last ?? null,
      });
    });
    const targets: SettingsUpdateTarget[] = [];
    if (row.state) {
      const atom = readServiceUpdate(client.connection);
      client.registry.mount(atom);
      if (row.read !== 'loading') {
        await Effect.runPromise(
          Effect.exit(
            AtomRegistry.getResult(client.registry, atom, {
              suspendOnWaiting: true,
            }),
          ),
        );
        if (row.read === 'stale-error') {
          client.registry.refresh(atom);
          await Effect.runPromise(
            Effect.exit(
              AtomRegistry.getResult(client.registry, atom, {
                suspendOnWaiting: true,
              }),
            ),
          );
        }
      }
      const result = client.registry.get(atom);
      if (row.read === 'loading')
        expect(AsyncResult.isInitial(result)).toBe(true);
      if (row.read === 'error' || row.read === 'stale-error')
        expect(AsyncResult.isFailure(result)).toBe(true);
      const state = serviceUpdateSnapshot(result);
      if (state)
        targets.push({
          kind: 'service',
          id: 'computer',
          name: 'Computer',
          connection: client.connection,
          deviceId: 'pairing-id',
          state,
        });
    }
    if (row.mac)
      targets.push({
        kind: 'mac-app',
        id: 'mac',
        name: 'Mac app',
        available: row.mac !== 'absent',
        latest: row.mac === 'missing-latest' ? undefined : '1.1.0',
        update: () => Effect.void,
      });

    expect(
      settingsUpdatesVisible(targets, { running: row.running ?? false }),
    ).toBe(row.visible);
    expect(targets.filter(settingsUpdateAvailable)).toHaveLength(row.offered);
    expect(settingsUpdateCount(targets)).toBe(row.count);
    const service = targets.find((target) => target.kind === 'service');
    expect(service ? settingsUpdateTrust(service)?.label : undefined).toBe(
      row.trust ? 'Needs trust' : undefined,
    );
    if (row.trust && service)
      expect(settingsUpdateTrust(service)?.deviceId).toBe('pairing-id');
    if (!row.state) expect(reads).toBe(0);
  },
);

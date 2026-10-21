import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { clientFixtures } from '../../../../spec/kit/client-fixture.ts';
import type {
  ServiceUpdateTarget,
  MacAppUpdateTarget,
} from '../commands/settings-updates.ts';
import {
  settingsUpdateBatchProgress,
  settingsUpdateCount,
  settingsUpdateTrust,
  settingsUpdateVersion,
} from './settings-updates.ts';

const fixture = clientFixtures();
function service(): ServiceUpdateTarget {
  return {
    kind: 'service',
    id: 'beelink',
    name: 'Beelink',
    deviceId: 'device-123',
    connection: fixture(async () => Response.json({})).connection,
    state: {
      managed: true,
      available: true,
      canUpdate: true,
      running: false,
      version: '1.0.0',
      latest: '1.1.0',
      last: undefined,
    },
  };
}
const mac: MacAppUpdateTarget = {
  kind: 'mac-app',
  id: 'mac',
  name: 'Mac app',
  available: true,
  latest: '1.1.0',
  update: () => Effect.void,
};

describe('settings update eligibility', () => {
  it.each([
    [false, false, false, undefined],
    [false, false, true, undefined],
    [false, true, false, undefined],
    [false, true, true, undefined],
    [true, false, false, undefined],
    [true, false, true, undefined],
    [true, true, false, undefined],
    [true, true, true, '1.1.0'],
  ] as const)(
    'available=%s managed=%s canUpdate=%s offers %s',
    (available, managed, canUpdate, expected) => {
      const target = service();
      expect(
        settingsUpdateVersion({
          ...target,
          state: { ...target.state, available, managed, canUpdate },
        }),
      ).toBe(expected);
    },
  );

  it('does not restart a running update or offer an unknown version', () => {
    const target = service();
    expect(
      settingsUpdateVersion({
        ...target,
        state: { ...target.state, running: true },
      }),
    ).toBeUndefined();
    expect(
      settingsUpdateVersion({
        ...target,
        state: { ...target.state, latest: undefined },
      }),
    ).toBeUndefined();
  });

  it('includes the Mac app without any service management or trust flags', () => {
    expect(settingsUpdateVersion(mac)).toBe('1.1.0');
    expect(settingsUpdateVersion({ ...mac, available: false })).toBeUndefined();
    expect(
      settingsUpdateVersion({ ...mac, latest: undefined }),
    ).toBeUndefined();
    const target = service();
    expect(
      settingsUpdateCount([
        target,
        target,
        mac,
        {
          ...target,
          id: 'unmanaged',
          state: { ...target.state, managed: false },
        },
      ]),
    ).toBe(2);
  });
});

it('supplies a copyable device id and the exact trust hint only for untrusted managed rows', () => {
  const target = service();
  const untrusted = { ...target, state: { ...target.state, canUpdate: false } };
  expect(settingsUpdateTrust(untrusted)).toEqual({
    label: 'Needs trust',
    deviceId: 'device-123',
    hint: 'Run porcelain trust device-123 on that computer, or allow it in the Mac app → Devices',
  });
  expect(settingsUpdateTrust({ ...untrusted, deviceId: undefined })).toEqual({
    label: 'Needs trust',
    deviceId: undefined,
    hint: 'Find this device’s id with porcelain devices on that computer, then run porcelain trust <id>, or allow it in the Mac app → Devices',
  });
  expect(settingsUpdateTrust(target)).toBeUndefined();
  expect(
    settingsUpdateTrust({
      ...untrusted,
      state: { ...untrusted.state, managed: false },
    }),
  ).toBeUndefined();
});

it('numbers the current row, including earlier failures, and has no updating label when settled', () => {
  const entries = [
    {
      id: 'a',
      name: 'A',
      kind: 'service' as const,
      version: '1.1.0',
      status: 'failed' as const,
      message: 'Failed',
    },
    {
      id: 'b',
      name: 'B',
      kind: 'service' as const,
      version: '1.1.0',
      status: 'updating' as const,
    },
  ];
  expect(settingsUpdateBatchProgress({ running: true, entries })).toEqual({
    total: 2,
    current: 2,
    label: 'Updating 2 of 2',
  });
  expect(settingsUpdateBatchProgress({ running: false, entries: [] })).toEqual({
    total: 0,
    current: undefined,
    label: undefined,
  });
});

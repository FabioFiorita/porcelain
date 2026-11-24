import { expect, it } from 'vite-plus/test';
import { guardKeychainPreferences } from '../apps/desktop/spec/kit/disposable-mac-keychain.ts';

type Preferences = { defaultPath: string | undefined; searchList: string[] };

const login = '/Users/fixture/Library/Keychains/login.keychain-db';
const work = '/Users/fixture/Library/Keychains/Work Items.keychain-db';
const isolated = '/private/tmp/fixture/porcelain-smoke.keychain-db';

function macKeychain(initial: Preferences, writable = true) {
  let preferences = structuredClone(initial);
  const writes: string[][] = [];
  const readPaths = (paths: readonly string[]) => ({
    status: 0,
    stdout: paths.map((path) => `    "${path}"\n`).join(''),
    stderr: '',
  });
  const security: Parameters<typeof guardKeychainPreferences>[0] = (args) => {
    const [command, domainFlag, domain, setter, ...paths] = args;
    if (
      domainFlag !== '-d' ||
      domain !== 'user' ||
      (command !== 'default-keychain' && command !== 'list-keychains')
    )
      throw new Error(`Unexpected security command ${args.join(' ')}`);
    if (setter === '-s') {
      writes.push(args.slice());
      if (writable && command === 'default-keychain')
        preferences.defaultPath = paths[0];
      if (writable && command === 'list-keychains')
        preferences.searchList = paths;
      return readPaths([]);
    }
    if (command === 'list-keychains') return readPaths(preferences.searchList);
    if (preferences.defaultPath) return readPaths([preferences.defaultPath]);
    return {
      status: 1,
      stdout: '',
      stderr:
        'security: SecKeychainCopyDomainDefault user: A default keychain could not be found.',
    };
  };
  const verify = guardKeychainPreferences(security);
  return {
    verify,
    writes,
    change: (updated: Preferences) => {
      preferences = structuredClone(updated);
    },
    current: () => structuredClone(preferences),
  };
}

it('reads unchanged real-home preferences without writing either setting', () => {
  const original = { defaultPath: login, searchList: [login, work] };
  const fixture = macKeychain(original);
  fixture.verify('after setup');
  fixture.verify('after teardown');
  expect(fixture.current()).toEqual(original);
  expect(fixture.writes).toEqual([]);
});

it('restores the default keychain and fails setup when only the default changed', () => {
  const original = { defaultPath: login, searchList: [login, work] };
  const fixture = macKeychain(original);
  fixture.change({ defaultPath: isolated, searchList: [login, work] });
  expect(() => fixture.verify('after setup')).toThrow(
    'Real HOME default keychain changed after setup. Original preferences restored.',
  );
  expect(fixture.current()).toEqual(original);
});

it('restores the exact search order and fails teardown when only the order changed', () => {
  const original = { defaultPath: login, searchList: [login, work] };
  const fixture = macKeychain(original);
  fixture.verify('after setup');
  fixture.change({ defaultPath: login, searchList: [work, login] });
  expect(() => fixture.verify('after teardown')).toThrow(
    'Real HOME search list changed after teardown. Original preferences restored.',
  );
  expect(fixture.current()).toEqual(original);
});

it('restores an absent default and an empty list after both settings changed', () => {
  const original = { defaultPath: undefined, searchList: [] };
  const fixture = macKeychain(original);
  fixture.change({ defaultPath: isolated, searchList: [isolated] });
  expect(() => fixture.verify('after setup')).toThrow(
    'Real HOME default keychain and search list changed after setup. Original preferences restored.',
  );
  expect(fixture.current()).toEqual(original);
  expect(fixture.writes).toEqual([
    ['default-keychain', '-d', 'user', '-s'],
    ['list-keychains', '-d', 'user', '-s'],
  ]);
});

it('fails when the commands report success but readback still shows drift', () => {
  const original = { defaultPath: login, searchList: [login, work] };
  const fixture = macKeychain(original, false);
  fixture.change({ defaultPath: login, searchList: [work, login] });
  expect(() => fixture.verify('after teardown')).toThrow(
    'Real HOME search list changed after teardown. Could not confirm restoration.',
  );
  expect(fixture.current()).toEqual({
    defaultPath: login,
    searchList: [work, login],
  });
});

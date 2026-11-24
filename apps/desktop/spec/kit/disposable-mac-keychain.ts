import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, realpathSync } from 'node:fs';
import { userInfo } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

type SecurityCommand = (args: readonly string[]) => {
  status: number | null;
  stdout: string | null;
  stderr: string | null;
  error?: Error | undefined;
};

const defaultCommand = ['default-keychain', '-d', 'user'] as const;
const searchCommand = ['list-keychains', '-d', 'user'] as const;

function securityFor(environment: NodeJS.ProcessEnv): SecurityCommand {
  return (args) =>
    spawnSync('/usr/bin/security', args, {
      env: { ...environment, LC_ALL: 'C' },
      encoding: 'utf8',
      timeout: 10_000,
      killSignal: 'SIGKILL',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
}

function output(command: string, result: ReturnType<SecurityCommand>): string {
  if (result.status === 0 && result.stdout !== null) return result.stdout;
  const details = result.stderr?.trim() || result.error?.message;
  throw new Error(`security ${command} failed${details ? `: ${details}` : ''}`);
}

function keychainPaths(stdout: string): string[] {
  const lines = stdout.trim();
  if (!lines) return [];
  return lines.split('\n').map((line) => {
    const path = /^"(.+)"$/.exec(line.trim())?.[1];
    if (!path?.startsWith('/'))
      throw new Error('Could not parse the keychain path returned by security');
    return path;
  });
}

function readDefault(security: SecurityCommand): string | undefined {
  const result = security(defaultCommand);
  if (
    result.status === 1 &&
    result.stderr?.includes('A default keychain could not be found.')
  )
    return undefined;
  const paths = keychainPaths(output('default-keychain', result));
  if (paths.length > 1)
    throw new Error('security returned multiple default keychains');
  return paths[0];
}

function readPreferences(security: SecurityCommand) {
  return {
    defaultPath: readDefault(security),
    searchList: keychainPaths(
      output('list-keychains', security(searchCommand)),
    ),
  };
}

export function guardKeychainPreferences(security: SecurityCommand) {
  const original = readPreferences(security);
  return (phase: 'after setup' | 'after teardown'): void => {
    const current = readPreferences(security);
    const changed = [
      ...(original.defaultPath === current.defaultPath
        ? []
        : ['default keychain']),
      ...(isDeepStrictEqual(original.searchList, current.searchList)
        ? []
        : ['search list']),
    ];
    if (changed.length === 0) return;

    const message = `Real HOME ${changed.join(' and ')} changed ${phase}`;
    const errors: unknown[] = [];
    for (const args of [
      [
        ...defaultCommand,
        '-s',
        ...(original.defaultPath ? [original.defaultPath] : []),
      ],
      [...searchCommand, '-s', ...original.searchList],
    ] as const) {
      try {
        output(args[0], security(args));
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      if (!isDeepStrictEqual(original, readPreferences(security)))
        throw new Error(
          'Restoration did not match the original keychain preferences',
        );
    } catch (error) {
      errors.push(error);
    }
    if (errors.length > 0)
      throw new AggregateError(
        errors,
        `${message}. Could not confirm restoration.`,
      );
    throw new Error(`${message}. Original preferences restored.`);
  };
}

export function disposableMacKeychain(
  home: string,
  environment: NodeJS.ProcessEnv,
) {
  const realHome = realpathSync(userInfo().homedir);
  if (realpathSync(home) === realHome)
    throw new Error('A disposable Keychain requires a separate home');
  const verifyRealHome = guardKeychainPreferences(
    securityFor({ ...process.env, HOME: realHome }),
  );
  const scopedSecurity = securityFor({ ...environment, HOME: home });

  return {
    setup(): void {
      let failure: { error: unknown } | undefined;
      try {
        const keychains = join(home, 'Library', 'Keychains');
        mkdirSync(keychains, { recursive: true });
        mkdirSync(join(home, 'Library', 'Preferences'), { recursive: true });
        const keychain = join(
          realpathSync(keychains),
          'porcelain-smoke.keychain-db',
        );
        const password = randomBytes(24).toString('hex');
        for (const args of [
          ['create-keychain', '-p', password, keychain],
          ['unlock-keychain', '-p', password, keychain],
          [...searchCommand, '-s', keychain],
          [...defaultCommand, '-s', keychain],
        ] as const) {
          output(args[0], scopedSecurity(args));
        }
        if (readDefault(scopedSecurity) !== keychain)
          throw new Error(
            'The disposable Keychain was not the default in its home',
          );
      } catch (error) {
        failure = { error };
      }
      try {
        verifyRealHome('after setup');
      } catch (error) {
        if (failure)
          throw new AggregateError(
            [failure.error, error],
            'Disposable Keychain setup failed',
          );
        throw error;
      }
      if (failure) throw failure.error;
    },
    verifyAfterTeardown(): void {
      verifyRealHome('after teardown');
    },
  };
}

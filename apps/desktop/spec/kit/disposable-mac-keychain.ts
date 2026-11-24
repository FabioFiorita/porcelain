import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

export function prepareDisposableMacKeychain(
  home: string,
  environment: NodeJS.ProcessEnv,
): void {
  const keychains = join(home, 'Library', 'Keychains');
  mkdirSync(keychains, { recursive: true });
  mkdirSync(join(home, 'Library', 'Preferences'), { recursive: true });
  const keychain = join(realpathSync(keychains), 'porcelain-smoke.keychain-db');
  const password = randomBytes(24).toString('hex');
  const security = (args: string[]) => {
    try {
      return execFileSync('/usr/bin/security', args, {
        env: { ...environment, HOME: home },
        encoding: 'utf8',
        timeout: 10_000,
        killSignal: 'SIGKILL',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      const details =
        error instanceof Error && 'stderr' in error
          ? String(error.stderr).trim()
          : '';
      throw new Error(
        `Disposable Keychain setup failed during ${args[0]}${details ? `: ${details}` : ''}`,
      );
    }
  };
  security(['create-keychain', '-p', password, keychain]);
  security(['unlock-keychain', '-p', password, keychain]);
  security(['list-keychains', '-d', 'user', '-s', keychain]);
  security(['default-keychain', '-d', 'user', '-s', keychain]);
  if (security(['default-keychain', '-d', 'user']).trim() !== `"${keychain}"`)
    throw new Error('The disposable Keychain was not the default in its home');
}

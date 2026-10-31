import { execFileSync } from 'node:child_process';
import { chmod, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  ServerHandle,
  Recorder,
  kitHeaders,
} from '@porcelain/server/kit/isolated-server';

export async function projectFixture(main: string) {
  const home = dirname(main);
  const metadata = join(main, '.git');
  const backup = join(home, 'navigator-project-backup');
  const server = await ServerHandle.attach(join(home, 'manifest.json'));
  const session = server.session(new Recorder(), {
    projectId: '',
    worktreeId: '',
  });
  let cleanup: (() => Promise<void>) | undefined;
  const restore = async () => {
    if (!cleanup) return;
    await cleanup();
    cleanup = undefined;
  };
  return {
    restore,
    unavailable: async (
      fault: 'missing' | 'replacement' | 'denied' | 'corrupt',
    ) => {
      await restore();
      switch (fault) {
        case 'missing':
          await rename(main, backup);
          cleanup = () => rename(backup, main);
          break;
        case 'replacement':
          await rename(metadata, backup);
          cleanup = async () => {
            await rm(metadata, { recursive: true, force: true });
            await rename(backup, metadata);
          };
          execFileSync('git', [
            'init',
            '--quiet',
            '--initial-branch',
            'main',
            main,
          ]);
          break;
        case 'denied': {
          const mode = (await stat(metadata)).mode;
          await chmod(metadata, 0);
          cleanup = () => chmod(metadata, mode);
          break;
        }
        case 'corrupt':
          await rename(join(metadata, 'HEAD'), backup);
          cleanup = () => rename(backup, join(metadata, 'HEAD'));
          break;
      }
      await session.read({
        method: 'POST',
        path: '/api/inventory/refresh',
        headers: kitHeaders,
      });
    },
  };
}

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openApplication } from './app.ts';
import type { FolderContents } from './filesystem/interfaces/project-folders.ts';

it('keeps browsing and inventory refresh responsive during discovery and cancels the scan on shutdown', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-discovery-queue-'));
  const entered = Promise.withResolvers<AbortSignal>();
  const application = await openApplication({
    dataDirectory: root,
    projectHome: '/fixture/home',
    projectFolders: {
      async read(path, signal) {
        if (path === '/fixture/home') {
          if (!signal) throw new Error('Missing cancellation');
          entered.resolve(signal);
          return new Promise<FolderContents>((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason), {
              once: true,
            });
          });
        }
        return {
          path,
          parent: null,
          directories: [],
          gitMarker: false,
          truncated: false,
        };
      },
    },
  });
  const scan = application.discoverProjects().catch((error: unknown) => error);
  try {
    const signal = await entered.promise;
    const [folder, refreshed] = await Promise.all([
      application.browseProjectFolders('/fixture/other'),
      application.refresh(),
    ]);
    expect(folder.path).toBe('/fixture/other');
    expect(refreshed.inventory.projects).toEqual([]);
    expect(signal.aborted).toBe(false);
    await application.close();
    expect(signal.aborted).toBe(true);
    expect(await scan).toMatchObject({ name: 'ApplicationClosedError' });
  } finally {
    await application.close();
    await scan;
    await rm(root, { recursive: true, force: true });
  }
});

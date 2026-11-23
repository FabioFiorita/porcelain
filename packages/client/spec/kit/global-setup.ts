import { temporaryRoot } from '@porcelain/kernel/test-kit/temporary-root';
import type { TestProject } from 'vite-plus/test/node';
import { temporaryServerBuild } from '@porcelain/server/kit/sandbox';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';

export default async function setup(project: TestProject) {
  const build = await temporaryServerBuild();
  const routes = await mkdtemp(join(temporaryRoot, 'porcelain-client-routes-'));
  project.provide('serverBuild', build.folder);
  project.provide('serverRoutes', routes);
  return async () => {
    await build.remove();
    await rm(routes, { recursive: true, force: true });
  };
}

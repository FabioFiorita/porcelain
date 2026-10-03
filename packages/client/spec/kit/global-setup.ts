import type { TestProject } from 'vitest/node';
import { temporaryServerBuild } from '@porcelain/server/kit/sandbox';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default async function setup(project: TestProject) {
  const build = await temporaryServerBuild();
  const routes = await mkdtemp(join(tmpdir(), 'porcelain-client-routes-'));
  project.provide('serverBuild', build.folder);
  project.provide('serverSample', 'none');
  project.provide('serverRoutes', routes);
  return async () => {
    await build.remove();
    await rm(routes, { recursive: true, force: true });
  };
}

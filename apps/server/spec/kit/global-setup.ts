import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';
import { z } from 'zod';
import { buildIsolatedServer } from './sandbox.ts';

const integrationFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../integration',
);
const routeLogSchema = z.object({
  registered: z.array(z.string()),
  requested: z.array(z.string()),
});

async function unrequestedRoutes(folder: string) {
  const logs = await readdir(folder);
  const tests = (await readdir(integrationFolder)).filter((name) =>
    name.endsWith('.integration.ts'),
  );
  if (logs.length !== tests.length) return [];
  const registered = new Set<string>();
  const requested = new Set<string>();
  for (const name of logs) {
    const log = routeLogSchema.parse(
      JSON.parse(await readFile(join(folder, name), 'utf8')),
    );
    for (const route of log.registered) registered.add(route);
    for (const route of log.requested) requested.add(route);
  }
  return [...registered].filter((route) => !requested.has(route)).sort();
}

export default async function setup(project: TestProject) {
  const perf = project.name === '@porcelain/server-perf';
  const build = await mkdtemp(join(tmpdir(), 'porcelain-server-build-'));
  const routes = await mkdtemp(join(tmpdir(), 'porcelain-server-routes-'));
  await buildIsolatedServer(build, perf ? 'perf' : undefined);
  project.provide('serverBuild', build);
  project.provide('serverSample', perf ? 'perf' : 'none');
  project.provide('serverRoutes', routes);
  return async () => {
    const unrequested = perf ? [] : await unrequestedRoutes(routes);
    await rm(build, { recursive: true, force: true });
    await rm(routes, { recursive: true, force: true });
    if (unrequested.length > 0)
      throw new Error(
        `Route coverage: no integration test requested ${unrequested.join(', ')}; every registered route is requested by at least one test in apps/server/spec/integration/.`,
      );
  };
}

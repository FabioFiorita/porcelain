import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';
import { z } from 'zod';
import { temporaryServerBuild } from './sandbox.ts';

const integrationFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../integration',
);
const routeLogSchema = z.object({
  registered: z.array(z.string()),
  requested: z.array(z.string()),
});

async function unrequestedRoutes(folder: string, project: TestProject) {
  const logs = await readdir(folder);
  const tests = (await readdir(integrationFolder)).filter((name) =>
    name.endsWith('.integration.ts'),
  );
  const ran = project.vitest.state
    .getTestModules()
    .filter((module) => module.project.name === project.name).length;
  if (ran < tests.length) {
    process.stderr.write(
      `Route coverage: not judged, this run selected ${ran} of ${tests.length} integration files; a run of every file judges it.\n`,
    );
    return [];
  }
  if (logs.length !== ran)
    throw new Error(
      `Route coverage: ${ran} integration files ran but ${logs.length} wrote a route log; every file's server records the routes its tests reached.`,
    );
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
  const build = await temporaryServerBuild(perf ? 'perf' : undefined);
  const routes = await mkdtemp(join(tmpdir(), 'porcelain-server-routes-'));
  project.provide('serverBuild', build.folder);
  project.provide('serverSample', perf ? 'perf' : 'none');
  project.provide('serverRoutes', routes);
  return async () => {
    let unrequested: string[] = [];
    try {
      if (!perf) unrequested = await unrequestedRoutes(routes, project);
    } finally {
      await build.remove();
      await rm(routes, { recursive: true, force: true });
    }
    if (unrequested.length > 0)
      throw new Error(
        `Route coverage: no integration test requested ${unrequested.join(', ')}; every registered route is reached, through its handler, by a request of at least one test in apps/server/spec/integration/.`,
      );
  };
}

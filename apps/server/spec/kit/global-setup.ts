import { Schema } from 'effect';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';
import { temporaryServerBuild } from './sandbox.ts';
import { routeCoverage, handlerCoverage } from './route-coverage.ts';
const integrationFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../integration',
);
const routeLogSchema = Schema.Struct({
  registered: Schema.Array(Schema.String),
  requested: Schema.Array(Schema.String),
  registeredTools: Schema.Array(Schema.String),
  invokedTools: Schema.Array(Schema.String),
});
type CoverageProject = {
  readonly name: TestProject['name'];
  readonly vitest: {
    readonly state: {
      getTestModules(): readonly {
        readonly project: Pick<TestProject, 'name'>;
        readonly moduleId: string;
        readonly children: {
          allTests(): Iterable<{ result(): { state: string } }>;
        };
      }[];
    };
  };
};

async function judgeHandlers(folder: string, project: CoverageProject) {
  const logs = await readdir(folder);
  const tests = (await readdir(integrationFolder)).filter((name) =>
    name.endsWith('.integration.ts'),
  );
  const modules = project.vitest.state
    .getTestModules()
    .filter((module) => module.project.name === project.name)
    .map((module) => ({
      path: module.moduleId,
      executed: [...module.children.allTests()].some((test) =>
        ['passed', 'failed'].includes(test.result().state),
      ),
    }));
  const coverage = routeCoverage(
    tests.map((name) => join(integrationFolder, name)),
    modules,
    logs.length,
  );
  if (!coverage.complete) {
    process.stderr.write(
      `Route coverage: not judged, this run selected ${coverage.selected} of ${tests.length} integration files; a run of every file judges it.\n`,
    );
    return;
  }
  const records = [];
  for (const name of logs)
    records.push(
      Schema.decodeUnknownSync(routeLogSchema)(
        JSON.parse(await readFile(join(folder, name), 'utf8')),
      ),
    );
  handlerCoverage(records);
}
export default async function setup(project: TestProject) {
  const build = await temporaryServerBuild();
  const routes = await mkdtemp(join(tmpdir(), 'porcelain-server-routes-'));
  project.provide('serverBuild', build.folder);
  project.provide('serverRoutes', routes);
  return () => integrationTeardown(project, routes, build);
}

export async function integrationTeardown(
  project: CoverageProject,
  routes: string,
  build: Pick<Awaited<ReturnType<typeof temporaryServerBuild>>, 'remove'>,
) {
  try {
    if (project.name === '@porcelain/server-integration')
      await judgeHandlers(routes, project);
  } finally {
    await build.remove();
    await rm(routes, { recursive: true, force: true });
  }
}

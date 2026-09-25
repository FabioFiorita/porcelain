import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { z } from 'zod';
import {
  journeyBaselineFile,
  readJourneyBaseline,
} from '../../../../architecture/baseline.ts';
import { buildIsolatedServer } from '../../../../scripts/dev-server.ts';
import {
  IsolatedServer,
  type Hit,
} from '../../server-verify/scripts/session.ts';
import {
  loadJourneys,
  negativeJourneys,
  recordedNegatives,
  type Journey,
} from './catalogue.ts';
import { calledRoutes, webCalls } from './web-routes.ts';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const config = resolve(
  repositoryRoot,
  '.agents/skills/web-verify/scripts/vitest.browser.config.ts',
);
const stabilityRepeats = 5;
const usage =
  'Usage: node .agents/skills/web-verify/scripts/browser.ts --list|--all|<journey>\n';

type Run = {
  passed: boolean;
  failures: string[];
  durationMs: number;
  hits: Hit[];
};

type Outcome = {
  runs: Run[];
  routes: Set<string>;
  problems: string[];
};

const reportSchema = z.object({
  testResults: z.array(
    z.object({
      name: z.string(),
      message: z.string().optional(),
      assertionResults: z.array(
        z.object({
          title: z.string(),
          status: z.string(),
          failureMessages: z.array(z.string()),
        }),
      ),
    }),
  ),
});

function git(args: readonly string[]): string {
  const result = spawnSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout;
}

function changedSinceMergeBase(): { base: string; paths: Set<string> } {
  if (process.env.CI !== 'true') return { base: '', paths: new Set() };
  const target = `origin/${process.env.GITHUB_BASE_REF || 'main'}`;
  const base = git(['merge-base', 'HEAD', target]).trim();
  const lines = [
    ...git(['diff', '--name-only', base, '--']).split('\n'),
    ...git(['ls-files', '--others', '--exclude-standard']).split('\n'),
  ];
  return { base, paths: new Set(lines.filter(Boolean)) };
}

function repetitions(journey: Journey, changed: ReadonlySet<string>): number {
  const entry = `.agents/skills/web-verify/feature-map/${journey.feature}.ts`;
  return changed.has(journey.spec) || changed.has(entry) ? stabilityRepeats : 1;
}

function firstLine(message: string): string {
  return (
    stripVTControlCharacters(message)
      .split('\n')
      .find((line) => line.trim() !== '') ?? ''
  ).trim();
}

async function vitest(
  spec: string,
  server: IsolatedServer,
  evidence: string,
): Promise<{ code: number; failures: string[] }> {
  const report = join(evidence, 'vitest.json');
  const code = await new Promise<number>((done, fail) => {
    const child = spawn(
      'pnpm',
      [
        'exec',
        'vitest',
        'run',
        '--config',
        config,
        resolve(repositoryRoot, spec),
        '--reporter=default',
        '--reporter=json',
        `--outputFile.json=${report}`,
      ],
      {
        cwd: repositoryRoot,
        env: {
          ...process.env,
          PORCELAIN_API_TARGET: server.address,
          PORCELAIN_WEB_EVIDENCE: evidence,
          PORCELAIN_WEB_MANIFEST: server.manifestPath,
        },
        stdio: 'inherit',
      },
    );
    child.once('error', fail);
    child.once('close', (status) => done(status ?? 1));
  });
  if (!existsSync(report))
    return {
      code,
      failures: ['Vitest wrote no report; read its output above'],
    };
  const results = reportSchema.parse(
    JSON.parse(await readFile(report, 'utf8')),
  );
  const failures = results.testResults.flatMap((file) => [
    ...(file.message ? [firstLine(file.message)] : []),
    ...file.assertionResults
      .filter((result) => result.status !== 'passed')
      .map(
        (result) =>
          `${result.title}: ${firstLine(result.failureMessages.join('\n')) || result.status}`,
      ),
  ]);
  return {
    code,
    failures:
      code !== 0 && failures.length === 0
        ? [`Vitest exited with ${code}; read its output above`]
        : failures,
  };
}

async function run(
  spec: string,
  build: string,
  evidence: string,
  registered: Set<string>,
): Promise<Run> {
  const started = performance.now();
  await mkdir(evidence, { recursive: true });
  const server = await IsolatedServer.start(repositoryRoot, build);
  try {
    for (const route of server.routes) registered.add(route);
    const result = await vitest(spec, server, evidence);
    const hits = await server.hits();
    await writeFile(
      join(evidence, 'server.json'),
      `${JSON.stringify({ hits, logs: server.logs() }, null, 2)}\n`,
    );
    return {
      passed: result.code === 0,
      failures: result.failures,
      durationMs: Math.round(performance.now() - started),
      hits,
    };
  } finally {
    const stopped = await server.stop();
    if (stopped !== undefined) process.stderr.write(`${stopped}\n`);
  }
}

function uiRoutes(hits: readonly Hit[]): Set<string> {
  return new Set(
    hits
      .filter((hit) => !hit.kit && hit.route !== undefined)
      .map((hit) => `${hit.method} ${hit.route ?? ''}`),
  );
}

async function journeyOutcome(
  journey: Journey,
  times: number,
  build: string,
  evidence: string,
  registered: Set<string>,
): Promise<Outcome> {
  const runs: Run[] = [];
  for (let repetition = 1; repetition <= times; repetition += 1)
    runs.push(
      await run(
        journey.spec,
        build,
        join(evidence, journey.feature, `run-${repetition}`),
        registered,
      ),
    );
  const routes = new Set(runs.flatMap((entry) => [...uiRoutes(entry.hits)]));
  const problems = [
    ...runs.flatMap((entry, index) =>
      entry.failures.map((failure) =>
        times > 1 ? `run ${index + 1} of ${times}: ${failure}` : failure,
      ),
    ),
    ...journey.claims
      .filter(
        (claim) =>
          runs.every((entry) => entry.passed) &&
          !claim.routes.some((route) => routes.has(route)),
      )
      .map(
        (claim) =>
          `claims ${claim.id}: the journey reached none of its routes (${claim.routes.join(', ')}) through the UI; name only the server features the journey drives`,
      ),
  ];
  return { runs, routes, problems };
}

function coverage(
  covered: ReadonlySet<string>,
  registered: readonly string[],
): { called: string[]; uncovered: string[]; problems: string[] } {
  const calls = webCalls(repositoryRoot);
  const matched = calledRoutes(calls.calls, registered);
  const called = [...matched.routes.keys()].toSorted();
  const uncovered = called.filter((route) => !covered.has(route));
  const held = readJourneyBaseline(repositoryRoot);
  const problems = [
    ...calls.problems,
    ...matched.problems,
    ...held.problems,
    ...uncovered
      .filter((route) => !held.routes.includes(route))
      .map(
        (route) =>
          `${route}: the web calls it (${(matched.routes.get(route) ?? []).map((call) => `${call.file}:${call.line}`).join(', ')}) and no journey reaches it through the UI; add a journey that drives it`,
      ),
    ...held.routes
      .filter((route) => covered.has(route) && called.includes(route))
      .map(
        (route) =>
          `${route}: a journey now reaches it through the UI; remove it from ${journeyBaselineFile} so it cannot become uncovered again`,
      ),
    ...held.routes
      .filter((route) => !called.includes(route))
      .map(
        (route) =>
          `${route}: the web no longer calls it; remove it from ${journeyBaselineFile}`,
      ),
  ];
  return { called, uncovered, problems };
}

function list(journeys: readonly Journey[]) {
  for (const journey of journeys)
    process.stdout.write(
      `${journey.feature} ${journey.route}${journey.shortcut ? ` [${journey.shortcut}]` : ''}\n  reach: ${journey.reach}\n  ${journey.behaviour}\n  server: ${journey.server.join(', ')}\n`,
    );
  for (const negative of negativeJourneys)
    process.stdout.write(`negative.${negative.name}: ${negative.plants}\n`);
}

async function main(): Promise<number> {
  const journeys = await loadJourneys();
  const argument = process.argv[2];
  if (argument === '--list' && process.argv.length === 3) {
    list(journeys);
    return 0;
  }
  const all = argument === '--all';
  const selected = journeys.filter(
    (journey) => all || journey.feature === argument,
  );
  const negatives = negativeJourneys.filter(
    (negative) => all || `negative.${negative.name}` === argument,
  );
  if (
    (selected.length === 0 && negatives.length === 0) ||
    process.argv.length !== 3
  ) {
    process.stderr.write(usage);
    return 2;
  }
  const evidence = await mkdtemp(
    join(tmpdir(), 'porcelain-web-browser-evidence-'),
  );
  const build = await mkdtemp(join(tmpdir(), 'porcelain-web-server-'));
  const changed = changedSinceMergeBase();
  const registered = new Set<string>();
  const summary: Record<string, unknown>[] = [];
  let failed = false;
  try {
    await buildIsolatedServer(build);
    const covered = new Set<string>();
    for (const journey of selected) {
      const times = repetitions(journey, changed.paths);
      const outcome = await journeyOutcome(
        journey,
        times,
        build,
        evidence,
        registered,
      );
      for (const route of outcome.routes) covered.add(route);
      const passed = outcome.problems.length === 0;
      if (!passed) failed = true;
      process.stdout.write(
        `${passed ? 'PASS' : 'FAIL'} ${journey.feature} (${times === 1 ? 'once' : `${times} times, changed since ${changed.base.slice(0, 12)}`}; ${outcome.routes.size} routes through the UI)\n`,
      );
      for (const problem of outcome.problems)
        process.stdout.write(`  ${journey.feature}: ${problem}\n`);
      const record = {
        ...journey,
        repetitions: times,
        passed,
        problems: outcome.problems,
        routes: [...outcome.routes].toSorted(),
        runs: outcome.runs,
      };
      summary.push(record);
      await writeFile(
        join(evidence, `${journey.feature}.json`),
        `${JSON.stringify(record, null, 2)}\n`,
      );
    }
    const rejected: Record<string, unknown>[] = [];
    for (const negative of negatives) {
      const outcome = await run(
        negative.spec,
        build,
        join(evidence, `negative.${negative.name}`),
        registered,
      );
      const reason = outcome.failures.find((failure) =>
        negative.rejectedWhen.test(failure),
      );
      const verdict = !outcome.passed && reason !== undefined;
      if (!verdict) failed = true;
      rejected.push({
        ...negative,
        rejectedWhen: String(negative.rejectedWhen),
        rejected: verdict,
        outcome,
      });
      process.stdout.write(
        `${verdict ? 'REJECTED' : 'NOT REJECTED'} negative.${negative.name} (${negative.plants})\n`,
      );
      if (!verdict)
        process.stdout.write(
          `  negative.${negative.name}: ${outcome.passed ? 'the planted journey passed' : `it failed for another reason: ${outcome.failures.join('; ')}`}; the runner must reject it for what it plants\n`,
        );
    }
    if (all && rejected.length !== recordedNegatives) {
      failed = true;
      process.stdout.write(
        `  negatives: ${rejected.length} ran where ${recordedNegatives} are recorded\n`,
      );
    }
    const report: Record<string, unknown> = {
      journeys: summary.length,
      stability: { base: changed.base, repeats: stabilityRepeats },
      negatives: rejected,
      registered: [...registered].toSorted(),
    };
    if (all) {
      const result = coverage(covered, [...registered]);
      const reached = result.called.length - result.uncovered.length;
      process.stdout.write(
        `Coverage: ${reached} of ${result.called.length} routes the web calls are reached through the UI; ${result.uncovered.length} held by ${journeyBaselineFile}.\n`,
      );
      for (const problem of result.problems)
        process.stdout.write(`  coverage: ${problem}\n`);
      if (result.problems.length > 0) failed = true;
      report.coverage = {
        called: result.called,
        covered: result.called.filter(
          (route) => !result.uncovered.includes(route),
        ),
        uncovered: result.uncovered,
        problems: result.problems,
      };
    } else
      process.stdout.write(
        'Coverage is judged with --all, where every journey runs.\n',
      );
    await writeFile(
      join(evidence, 'summary.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
  } finally {
    await rm(build, { recursive: true, force: true });
  }
  process.stdout.write(`Browser evidence: ${evidence}\n`);
  return failed ? 1 : 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}

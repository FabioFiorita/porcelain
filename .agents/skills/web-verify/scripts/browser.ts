import { fork, spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { availableParallelism, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { z } from 'zod';
import {
  workerMessageSchema,
  type Run,
  type RunRequest,
} from './browser-runner.ts';
import {
  journeyBaselineFile,
  readJourneyBaseline,
} from '../../../../architecture/baseline.ts';
import { buildIsolatedServer } from '../../../../scripts/dev-server.ts';
import type { Hit } from '../../server-verify/scripts/session.ts';
import {
  loadJourneys,
  negativeJourneys,
  recordedNegatives,
  type Journey,
  type Shell,
} from './catalogue.ts';
import { calledRoutes, webCalls } from './web-routes.ts';

type WorkerMessage = z.output<typeof workerMessageSchema>;

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const runnerFile = fileURLToPath(
  new URL('./browser-runner.ts', import.meta.url),
);
const browserLockVariable = 'PORCELAIN_BROWSER_LOCK_HELD';
const coresPerBrowser = 4;
const mostBrowsers = 4;
const defaultBrowsers = Math.max(
  1,
  Math.min(mostBrowsers, Math.floor(availableParallelism() / coresPerBrowser)),
);
const workerStopMs = 10_000;
const usage =
  'Usage: pnpm verify:web --list|--all|<journey>... [--repeat <count>] [--browsers <count>]\n';

type Outcome = {
  runs: Run[];
  routes: Set<string>;
  problems: string[];
};

type BrowserWorker = {
  run: (request: RunRequest) => Promise<Run>;
  close: () => Promise<void>;
};

async function startWorker(
  build: string,
  evidence: string,
  shell: Shell,
): Promise<BrowserWorker> {
  const child = fork(runnerFile, [build, evidence, shell], {
    cwd: repositoryRoot,
    serialization: 'advanced',
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  const waiting: {
    done: (message: WorkerMessage) => void;
    fail: (error: Error) => void;
  }[] = [];
  let gone: Error | undefined;
  const exited = new Promise<void>((done) => {
    child.once('exit', (code, signal) => {
      gone = new Error(
        `A browser worker stopped (${code ?? signal ?? 'unknown'})`,
      );
      for (const waiter of waiting.splice(0)) waiter.fail(gone);
      done();
    });
  });
  child.on('message', (message: unknown) => {
    const waiter = waiting.shift();
    const parsed = workerMessageSchema.safeParse(message);
    if (parsed.success) waiter?.done(parsed.data);
    else
      waiter?.fail(
        new Error(`A browser worker sent ${JSON.stringify(message)}`),
      );
  });
  const next = () =>
    new Promise<WorkerMessage>((done, fail) => {
      if (gone === undefined) waiting.push({ done, fail });
      else fail(gone);
    });
  const close = async () => {
    if (gone !== undefined) return;
    const timer = setTimeout(() => child.kill('SIGKILL'), workerStopMs);
    if (child.connected) child.disconnect();
    await exited;
    clearTimeout(timer);
  };
  const ready = await next().catch(async (error: unknown) => {
    await close();
    throw error;
  });
  if (ready.kind !== 'ready') {
    await close();
    throw new Error(
      `A browser worker did not start: ${ready.kind === 'broken' ? ready.message : ready.kind}`,
    );
  }
  return {
    async run(request) {
      const answer = next();
      child.send(request);
      const message = await answer;
      if (message.kind === 'ran') return message.run;
      throw new Error(
        message.kind === 'broken'
          ? message.message
          : 'A browser worker answered a run with ready',
      );
    },
    close,
  };
}

async function startWorkers(
  count: number,
  build: string,
  evidence: string,
  shell: Shell,
): Promise<BrowserWorker[]> {
  const started = await Promise.allSettled(
    Array.from({ length: count }, () => startWorker(build, evidence, shell)),
  );
  const workers = started.flatMap((entry) =>
    entry.status === 'fulfilled' ? [entry.value] : [],
  );
  const failed = started.find((entry) => entry.status === 'rejected');
  if (failed === undefined) return workers;
  await Promise.all(workers.map((worker) => worker.close()));
  throw failed.reason;
}

async function drain<T>(
  items: readonly T[],
  workers: readonly BrowserWorker[],
  work: (item: T, worker: BrowserWorker) => Promise<boolean>,
): Promise<void> {
  const queue = [...items];
  let stopped = false;
  const lanes = await Promise.allSettled(
    workers.map(async (worker) => {
      while (!stopped) {
        const item = queue.shift();
        if (item === undefined) return;
        const carryOn = await work(item, worker).catch((error: unknown) => {
          stopped = true;
          throw error;
        });
        if (!carryOn) stopped = true;
      }
    }),
  );
  const broken = lanes.find((lane) => lane.status === 'rejected');
  if (broken !== undefined) throw broken.reason;
}

function writeOutput(runs: readonly Run[]) {
  for (const entry of runs)
    if (!entry.passed) process.stdout.write(entry.output);
}

function evidenceOf(entry: Run) {
  return {
    passed: entry.passed,
    failures: entry.failures,
    durationMs: entry.durationMs,
    hits: entry.hits,
  };
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
  evidence: string,
  worker: BrowserWorker,
): Promise<Outcome> {
  const runs: Run[] = [];
  for (let repetition = 1; repetition <= times; repetition += 1) {
    const result = await worker.run({
      spec: journey.spec,
      folder: join(evidence, journey.feature, `run-${repetition}`),
      shell: journey.shell,
    });
    runs.push(result);
    if (!result.passed) break;
  }
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

function coveredBaselineProblems(
  covered: ReadonlySet<string>,
  called: readonly string[],
  held: readonly string[],
): string[] {
  return held
    .filter((route) => covered.has(route) && called.includes(route))
    .map(
      (route) =>
        `${route}: a journey now reaches it through the UI; remove it from ${journeyBaselineFile} so it cannot become uncovered again`,
    );
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
    ...coveredBaselineProblems(covered, called, held.routes),
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
      `${journey.feature} ${journey.route}${journey.shortcut ? ` [${journey.shortcut}]` : ''}${journey.shell === 'desktop' ? ' (desktop web)' : ''}\n  reach: ${journey.reach}\n  ${journey.behaviour}\n  server: ${journey.server.join(', ')}\n`,
    );
  for (const negative of negativeJourneys)
    process.stdout.write(`negative.${negative.name}: ${negative.plants}\n`);
}

async function main(): Promise<number> {
  const started = performance.now();
  const journeys = await loadJourneys();
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      all: { type: 'boolean', default: false },
      list: { type: 'boolean', default: false },
      repeat: { type: 'string', default: '1' },
      browsers: { type: 'string', default: String(defaultBrowsers) },
    },
    allowPositionals: true,
  });
  if (values.list && !values.all && positionals.length === 0) {
    list(journeys);
    return 0;
  }
  const all = values.all;
  const times = Number(values.repeat);
  const browsers = Number(values.browsers);
  const selected = journeys.filter(
    (journey) => all || positionals.includes(journey.feature),
  );
  const queue = selected.toSorted(
    (first, second) =>
      Number(first.shell === 'desktop') - Number(second.shell === 'desktop'),
  );
  const negatives = negativeJourneys.filter(
    (negative) => all || positionals.includes(`negative.${negative.name}`),
  );
  const known = new Set([
    ...journeys.map((journey) => journey.feature),
    ...negativeJourneys.map((negative) => `negative.${negative.name}`),
  ]);
  if (
    values.list ||
    !Number.isSafeInteger(times) ||
    times < 1 ||
    !Number.isSafeInteger(browsers) ||
    browsers < 1 ||
    (all && positionals.length > 0) ||
    (selected.length === 0 && negatives.length === 0) ||
    positionals.some((name) => !known.has(name))
  ) {
    process.stderr.write(usage);
    return 2;
  }
  const lanes = Math.min(browsers, Math.max(selected.length, negatives.length));
  process.stdout.write(
    `Selection: ${selected.length} journeys, ${times} run(s) each, ${lanes} at a time; stop on first failure.\n`,
  );
  const evidence = await mkdtemp(
    join(tmpdir(), 'porcelain-web-browser-evidence-'),
  );
  const build = await mkdtemp(join(tmpdir(), 'porcelain-web-server-'));
  const registered = new Set<string>();
  const records = new Map<string, Record<string, unknown>>();
  const summary = () =>
    selected.flatMap((journey) => {
      const record = records.get(journey.feature);
      return record === undefined ? [] : [record];
    });
  let failed = false;
  let workers: BrowserWorker[] = [];
  let buildMs = 0;
  let workerMs = 0;
  let journeyMs = 0;
  let journeyRunMs = 0;
  let negativeMs = 0;
  let coverageMs = 0;
  try {
    const buildStarted = performance.now();
    await buildIsolatedServer(build);
    buildMs = Math.round(performance.now() - buildStarted);
    const workersStarted = performance.now();
    workers = await startWorkers(
      lanes,
      build,
      evidence,
      queue[0]?.shell ?? 'web',
    );
    workerMs = Math.round(performance.now() - workersStarted);
    const covered = new Set<string>();
    const journeysStarted = performance.now();
    await drain(queue, workers, async (journey, worker) => {
      const journeyStarted = performance.now();
      const outcome = await journeyOutcome(journey, times, evidence, worker);
      const wallMs = Math.round(performance.now() - journeyStarted);
      journeyRunMs += wallMs;
      for (const entry of outcome.runs)
        for (const route of entry.registered) registered.add(route);
      for (const route of outcome.routes) covered.add(route);
      const passed = outcome.problems.length === 0;
      if (!passed) failed = true;
      writeOutput(outcome.runs);
      process.stdout.write(
        `${passed ? 'PASS' : 'FAIL'} ${journey.feature} (${outcome.runs.length}/${times} runs; ${outcome.routes.size} routes through the UI; ${wallMs} ms)\n`,
      );
      for (const problem of outcome.problems)
        process.stdout.write(`  ${journey.feature}: ${problem}\n`);
      const record = {
        ...journey,
        repetitions: times,
        passed,
        problems: outcome.problems,
        routes: [...outcome.routes].toSorted(),
        wallMs,
        runs: outcome.runs.map(evidenceOf),
      };
      records.set(journey.feature, record);
      await writeFile(
        join(evidence, `${journey.feature}.json`),
        `${JSON.stringify(record, null, 2)}\n`,
      );
      return passed;
    });
    journeyMs = Math.round(performance.now() - journeysStarted);
    const verdicts = new Map<string, Record<string, unknown>>();
    const negativesStarted = performance.now();
    await drain(failed ? [] : negatives, workers, async (negative, worker) => {
      const outcome = await worker.run({
        spec: negative.spec,
        folder: join(evidence, `negative.${negative.name}`),
        shell: 'web',
      });
      for (const route of outcome.registered) registered.add(route);
      const verdict =
        !outcome.passed &&
        outcome.failures.length > 0 &&
        outcome.failures.every((failure) =>
          negative.rejectedWhen.test(failure),
        );
      if (!verdict) failed = true;
      verdicts.set(negative.name, {
        ...negative,
        rejectedWhen: String(negative.rejectedWhen),
        rejected: verdict,
        outcome: evidenceOf(outcome),
      });
      if (!verdict) writeOutput([outcome]);
      process.stdout.write(
        `${verdict ? 'REJECTED' : 'NOT REJECTED'} negative.${negative.name} (${negative.plants})\n`,
      );
      if (!verdict)
        process.stdout.write(
          `  negative.${negative.name}: ${outcome.passed ? 'the planted journey passed' : `it failed for another reason: ${outcome.failures.join('; ')}`}; the runner must reject it for what it plants\n`,
        );
      return verdict;
    });
    negativeMs = Math.round(performance.now() - negativesStarted);
    const rejected = negatives.flatMap((negative) => {
      const verdict = verdicts.get(negative.name);
      return verdict === undefined ? [] : [verdict];
    });
    if (all && !failed && rejected.length !== recordedNegatives) {
      failed = true;
      process.stdout.write(
        `  negatives: ${rejected.length} ran where ${recordedNegatives} are recorded\n`,
      );
    }
    const report: Record<string, unknown> = {
      journeys: records.size,
      requestedJourneys: selected.map((journey) => journey.feature),
      skippedJourneys: selected
        .filter((journey) => !records.has(journey.feature))
        .map((journey) => journey.feature),
      skippedNegatives: negatives
        .filter((negative) => !verdicts.has(negative.name))
        .map((negative) => negative.name),
      repetitions: times,
      workers: lanes,
      negatives: rejected,
      registered: [...registered].toSorted(),
    };
    const coverageStarted = performance.now();
    if (all && !failed) {
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
    } else if (selected.length > 0) {
      const calls = webCalls(repositoryRoot);
      const matched = calledRoutes(calls.calls, [...registered]);
      const held = readJourneyBaseline(repositoryRoot);
      const problems = [
        ...held.problems,
        ...coveredBaselineProblems(
          covered,
          [...matched.routes.keys()],
          held.routes,
        ),
      ];
      for (const problem of problems)
        process.stdout.write(`  coverage: ${problem}\n`);
      if (problems.length > 0) failed = true;
      report.coveredBaseline = { problems };
      process.stdout.write(
        'Selected journeys checked for stale baseline entries; full coverage is judged with --all.\n',
      );
    } else process.stdout.write('Coverage is judged with --all.\n');
    coverageMs = Math.round(performance.now() - coverageStarted);
    report.passed = !failed;
    report.complete =
      records.size === selected.length &&
      rejected.length === negatives.length &&
      summary().every(
        (record) => Array.isArray(record.runs) && record.runs.length === times,
      );
    report.timings = {
      buildMs,
      workerMs,
      journeyMs,
      journeyRunMs,
      negativeMs,
      coverageMs,
      totalMs: Math.round(performance.now() - started),
    };
    await writeFile(
      join(evidence, 'summary.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
  } catch (error) {
    await writeFile(
      join(evidence, 'summary.json'),
      `${JSON.stringify(
        {
          passed: false,
          complete: false,
          error: error instanceof Error ? error.message : String(error),
          results: summary(),
          requestedJourneys: selected.map((journey) => journey.feature),
          skippedJourneys: selected
            .filter((journey) => !records.has(journey.feature))
            .map((journey) => journey.feature),
        },
        null,
        2,
      )}\n`,
    );
    process.stderr.write(`Partial browser evidence: ${evidence}\n`);
    throw error;
  } finally {
    try {
      await Promise.all(workers.map((worker) => worker.close()));
    } finally {
      await rm(build, { recursive: true, force: true });
    }
  }
  process.stdout.write(
    `Browser time: build ${buildMs} ms; ${lanes} browsers started in ${workerMs} ms; journeys ${journeyMs} ms (${journeyRunMs} ms of journey time); negatives ${negativeMs} ms; coverage ${coverageMs} ms; total ${Math.round(performance.now() - started)} ms.\n`,
  );
  process.stdout.write(`Browser evidence: ${evidence}\n`);
  return failed ? 1 : 0;
}

function withBrowserLock(): Promise<number> {
  if (process.env[browserLockVariable] === '1' || process.argv[2] === '--list')
    return main();
  const lock = join(
    tmpdir(),
    `porcelain-web-verify-${process.getuid?.() ?? 'local'}.lock`,
  );
  process.stdout.write('Waiting for the host browser verification slot.\n');
  return new Promise((done, fail) => {
    const child = spawn(
      'flock',
      [
        '--exclusive',
        '--verbose',
        lock,
        process.execPath,
        fileURLToPath(import.meta.url),
        ...process.argv.slice(2),
      ],
      {
        cwd: repositoryRoot,
        env: { ...process.env, [browserLockVariable]: '1' },
        stdio: 'inherit',
      },
    );
    child.once('error', fail);
    child.once('close', (status) => done(status ?? 1));
  });
}

try {
  process.exitCode = await withBrowserLock();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}

// Runs the lab's scenarios against the realistic playgrounds and compares Git
// process counts with the recorded ceilings. The lab owns the scenarios, the
// runner and the tracer; the ceilings in budgets.json beside this file are the
// repository's, and the lab reads them from here.
import { fork } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBench, settleTraces } from '../../design/server-lab/host/bench.ts';
import type {
  BenchStepResult,
  RuntimeMessage,
  Trace,
} from '../../design/server-lab/host/protocol.ts';
import { simulate } from '../../design/server-lab/host/simulate.ts';

type Budgets = {
  profiles: Record<
    string,
    Record<string, { measured: number; ceiling: number }>
  >;
};

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const labRuntime = join(repoRoot, 'design/server-lab/host/runtime.ts');

const requested = process.argv
  .slice(2)
  .filter((argument) => !argument.startsWith('-'));
const profiles = requested.length > 0 ? requested : ['app', 'monorepo'];

const budgets = JSON.parse(
  await readFile(join(here, 'budgets.json'), 'utf8'),
) as Budgets;

async function measureProfile(profile: string): Promise<BenchStepResult[]> {
  const stateDirectory = await mkdtemp(join(tmpdir(), 'porcelain-bench-'));
  const tokenFile = join(stateDirectory, 'token');
  const traces = new Map<string, Trace>();
  // Changes on every traced message, including one that replaces a trace the
  // tracer re-sends when late work lands on it.
  let traceRevision = 0;
  const child = fork(labRuntime, [], {
    cwd: repoRoot,
    env: {
      ...process.env,
      LAB_MODE: 'playground',
      LAB_PROFILE: profile,
      LAB_REAL_REPOSITORIES: '[]',
      LAB_TOKEN_FILE: tokenFile,
      LAB_PLAYGROUNDS_DIRECTORY: join(repoRoot, '.playgrounds'),
    },
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  try {
    const ready = await new Promise<Extract<RuntimeMessage, { type: 'ready' }>>(
      (settled, rejected) => {
        child.on('message', (message: RuntimeMessage) => {
          // The tracer re-sends a trace when late work lands on it.
          if (message.type === 'trace') {
            traces.set(message.trace.id, message.trace);
            traceRevision++;
          }
          if (message.type === 'ready') settled(message);
          if (message.type === 'failed') rejected(new Error(message.error));
        });
        child.on('exit', (code) =>
          rejected(new Error(`The lab runtime exited with ${code}`)),
        );
      },
    );
    const token = (await readFile(tokenFile, 'utf8')).trim();
    const run = `bench-${profile}`;
    const stepTraces = (step: string) =>
      [...traces.values()].filter(
        (trace) => trace.run === run && trace.step === step,
      );
    return await runBench(
      {
        address: ready.address,
        token,
        run,
        real: false,
        worktrees: ready.worktrees,
        simulate: (worktree, action, count) =>
          simulate(ready.playgroundRoot as string, worktree, action, count),
        progress: () => {},
        settle: (step) =>
          settleTraces(
            () => stepTraces(step),
            () => traceRevision,
          ),
      },
      (_run, step) => stepTraces(step),
    );
  } finally {
    // The runtime removes its generated playground when it shuts down, so ask
    // it to stop rather than killing it and leaving the repository behind.
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise((done) => child.once('exit', done));
      child.send?.({ type: 'shutdown' });
      const giveUp = setTimeout(() => child.kill('SIGKILL'), 20_000);
      await exited;
      clearTimeout(giveUp);
    }
    await rm(stateDirectory, { recursive: true, force: true });
  }
}

let failed = false;
for (const profile of profiles) {
  const recorded = budgets.profiles[profile];
  process.stdout.write(`\n${profile}\n`);
  if (!recorded) {
    process.stdout.write('  no recorded budgets\n');
    failed = true;
    continue;
  }
  process.stdout.write(
    `  ${'step'.padEnd(16)}${'processes'.padStart(10)}${'ceiling'.padStart(9)}${'wallMs'.padStart(8)}${'queueMs'.padStart(9)}  verdict\n`,
  );
  for (const row of await measureProfile(profile)) {
    const budget = recorded[row.step];
    // A step that failed or never settled did less work, so a low count is not
    // a pass.
    const note =
      row.errors > 0
        ? `FAIL ${row.errors} error(s)${row.error ? `: ${row.error}` : ''}`
        : budget === undefined
          ? 'FAIL no recorded budget'
          : row.processes > budget.ceiling
            ? 'FAIL over ceiling'
            : 'pass';
    if (note !== 'pass') failed = true;
    process.stdout.write(
      `  ${row.step.padEnd(16)}${String(row.processes).padStart(10)}${String(budget?.ceiling ?? '-').padStart(9)}${String(row.wallMs).padStart(8)}${String(row.queueMs).padStart(9)}  ${note}\n`,
    );
  }
}
process.stdout.write(
  '\nTime and queue wait are reported, not judged: they vary by 10-15% between runs.\n',
);
process.exitCode = failed ? 1 : 0;

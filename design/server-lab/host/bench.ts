// Scripted interactions that mirror what the web does on common moments, so a
// profile can be compared with another by processes, SQL, queue time and time.
import type { BenchStepResult, Trace, WorktreeInfo } from './protocol.ts';
import type { SimulationAction } from './simulate.ts';

type Inventory = {
  projects: {
    id: string;
    worktrees: {
      id: string;
      path: string;
      main: boolean;
      available: boolean;
    }[];
  }[];
};

export type BenchContext = {
  address: string;
  token: string;
  run: string;
  real: boolean;
  worktrees: WorktreeInfo[];
  simulate?: (
    worktree: string,
    action: SimulationAction,
    count: number,
  ) => Promise<string>;
  progress: (message: string) => void;
  /**
   * Waits for the step's traced work to finish. Both hosts pass
   * {@link settleTraces}; a step that never settles must fail rather than be
   * measured half-done.
   */
  settle: (step: string) => Promise<void>;
};

/** A trace is finished when its request, its Git processes and its queued work all are. */
function finished(trace: Trace) {
  return (
    trace.end !== undefined &&
    trace.processes.every((span) => span.end !== undefined) &&
    trace.operations.every((span) => span.settled !== undefined)
  );
}

/**
 * Waits until the step's traces stop arriving and none is still running, so
 * trailing work is measured instead of being cut off by a fixed delay.
 *
 * `revision` must change on every traced message, not only on a new request:
 * the tracer re-sends a trace when late work lands on it, and both hosts store
 * traces by id, so a replacement leaves the count unchanged.
 */
export async function settleTraces(
  snapshot: () => Trace[],
  revision: () => number,
  timeoutMs = 30_000,
) {
  const deadline = Date.now() + timeoutMs;
  let quiet = 0;
  let seen = -1;
  while (Date.now() < deadline) {
    await new Promise((tick) => setTimeout(tick, 100));
    const current = revision();
    const running = snapshot().filter((trace) => !finished(trace));
    quiet = running.length === 0 && current === seen ? quiet + 1 : 0;
    seen = current;
    if (quiet >= 3) return;
  }
  const running = snapshot().filter((trace) => !finished(trace));
  throw new Error(
    running.length === 0
      ? `Traced work did not settle in ${timeoutMs}ms: traces kept arriving.`
      : `Traced work did not settle in ${timeoutMs}ms: ${running.length} request(s) still running, ${running
          .map(
            (trace) =>
              `${trace.method} ${trace.route ?? trace.url} (${trace.processes.filter((span) => span.end === undefined).length} process(es), ${trace.operations.filter((span) => span.settled === undefined).length} operation(s))`,
          )
          .join('; ')}`,
  );
}

type Api = (
  method: string,
  path: string,
  body?: unknown,
) => Promise<{ status: number; data: unknown }>;

type Step = {
  id: string;
  title: string;
  /** Only disposable playgrounds may be changed. */
  playgroundOnly?: boolean;
  run: (api: Api, scope: Scope, context: BenchContext) => Promise<void>;
};

type Scope = {
  projectId: string;
  worktreeId: string;
  worktreePath: string;
};

const selectWorktree = async (api: Api, scope: Scope) => {
  const w = `/api/worktrees/${scope.worktreeId}`;
  // useChanges (status + layers), evidence, reviewed marks, comments, artifacts.
  await Promise.all([
    api('GET', `${w}/git/status`),
    api('GET', `${w}/review-layers`),
    api('GET', `${w}/evidence`),
    api('GET', `${w}/reviewed`),
    api('GET', `${w}/comments`),
    api('GET', `${w}/artifacts`),
  ]);
};

export const benchSteps: Step[] = [
  {
    id: 'open',
    title: 'Open Porcelain (the sidebar, in one request)',
    run: async (api) => {
      // As observed from the web on load. The list carries each worktree's
      // status dot, so there is nothing else to ask for.
      await api('GET', '/api/inventory');
    },
  },
  {
    id: 'select',
    title: 'Select the review worktree',
    run: (api, scope) => selectWorktree(api, scope),
  },
  {
    id: 'reselect',
    title: 'Select it again (nothing changed)',
    run: (api, scope) => selectWorktree(api, scope),
  },
  {
    id: 'diffs',
    title: 'Open five diffs one by one',
    run: async (api, scope) => {
      const { data } = await api(
        'GET',
        `/api/worktrees/${scope.worktreeId}/git/status`,
      );
      const status = data as {
        statusToken: string;
        changes: {
          scope: string;
          oldPath?: string | null;
          newPath?: string | null;
        }[];
      };
      const ordinary = status.changes
        .filter(
          (change) => change.scope === 'staged' || change.scope === 'unstaged',
        )
        .slice(0, 5);
      for (const change of ordinary)
        await api('POST', `/api/worktrees/${scope.worktreeId}/git/diff`, {
          expectedStatusToken: status.statusToken,
          change: {
            scope: change.scope,
            oldPath: change.oldPath ?? null,
            newPath: change.newPath ?? null,
          },
        });
    },
  },
  {
    id: 'files',
    title: 'Open Files and read five files',
    run: async (api, scope) => {
      const { data } = await api(
        'GET',
        `/api/worktrees/${scope.worktreeId}/file-tree`,
      );
      const entries = (
        (data as { entries?: { path: string; kind?: string; type?: string }[] })
          .entries ?? []
      )
        .filter((entry) => /\.(ts|md|json|css|mjs)$/.test(entry.path))
        .slice(0, 5);
      for (const entry of entries)
        await api(
          'GET',
          `/api/worktrees/${scope.worktreeId}/text?${new URLSearchParams({ path: entry.path })}`,
        );
    },
  },
  {
    id: 'history',
    title: 'Open History and three commits',
    run: async (api, scope) => {
      const { data } = await api(
        'GET',
        `/api/worktrees/${scope.worktreeId}/commits?limit=50`,
      );
      const commits = (
        (data as { commits?: { oid: string }[] }).commits ?? []
      ).slice(0, 3);
      for (const commit of commits)
        await api(
          'GET',
          `/api/worktrees/${scope.worktreeId}/commits/${commit.oid}/changes`,
        );
    },
  },
  {
    id: 'mark',
    title: 'Mark ten files reviewed',
    run: async (api, scope) => {
      const { data } = await api(
        'GET',
        `/api/worktrees/${scope.worktreeId}/evidence`,
      );
      const evidence = (
        (data as { evidence?: { path: string; fingerprint: string | null }[] })
          .evidence ?? []
      )
        .filter((entry) => entry.fingerprint)
        .slice(0, 10);
      for (const entry of evidence)
        await api('PUT', `/api/worktrees/${scope.worktreeId}/reviewed`, {
          path: entry.path,
          reviewed: true,
          fingerprint: entry.fingerprint,
        });
    },
  },
  {
    id: 'agent-edit',
    title: 'Agent edits ten files, reviewer refocuses the window',
    playgroundOnly: true,
    run: async (api, scope, context) => {
      await context.simulate?.(scope.worktreePath, 'edit', 10);
      await Promise.all([
        selectWorktree(api, scope),
        api('GET', '/api/inventory'),
      ]);
    },
  },
];

export async function runBench(
  context: BenchContext,
  collect: (run: string, step: string) => Trace[],
): Promise<BenchStepResult[]> {
  const headers = (step: string) => ({
    authorization: `Bearer ${context.token}`,
    'x-lab-origin': 'bench',
    'x-lab-run': context.run,
    'x-lab-step': step,
  });
  const client =
    (step: string): Api =>
    async (method, path, body) => {
      const init: RequestInit = {
        method,
        headers: {
          ...headers(step),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      };
      const response = await fetch(`${context.address}${path}`, init);
      const text = await response.text();
      let data: unknown = text;
      try {
        data = JSON.parse(text);
      } catch {}
      return { status: response.status, data };
    };

  const inventory = (await client('setup')('GET', '/api/inventory'))
    .data as Inventory;
  const project =
    inventory.projects.find((candidate) =>
      candidate.worktrees.some((worktree) => !worktree.main),
    ) ?? inventory.projects[0];
  if (!project) throw new Error('No project registered');
  const reviewPath = context.worktrees.find(
    (worktree) => worktree.role === 'review',
  )?.path;
  const review =
    project.worktrees.find((worktree) => worktree.path === reviewPath) ??
    project.worktrees.find(
      (worktree) => !worktree.main && worktree.available,
    ) ??
    project.worktrees[0];
  if (!review) throw new Error('No worktree registered');
  const scope: Scope = {
    projectId: project.id,
    worktreeId: review.id,
    worktreePath: review.path,
  };

  const results: BenchStepResult[] = [];
  for (const step of benchSteps) {
    if (step.playgroundOnly && context.real) continue;
    context.progress(step.title);
    const started = performance.now();
    let failed = false;
    let error: string | undefined;
    try {
      await step.run(client(step.id), scope, context);
    } catch (cause) {
      failed = true;
      error = (cause as Error).message;
    }
    const wallMs = performance.now() - started;
    try {
      await context.settle(step.id);
    } catch (cause) {
      failed = true;
      error ??= (cause as Error).message;
    }
    const traces = collect(context.run, step.id);
    results.push({
      step: step.id,
      title: step.title,
      requests: traces.length,
      processes: traces.reduce((sum, trace) => sum + trace.processes.length, 0),
      sql: traces.reduce((sum, trace) => sum + trace.sqlCount, 0),
      wallMs: Math.round(wallMs),
      serverMs: Math.round(
        traces.reduce(
          (sum, trace) => sum + ((trace.end ?? trace.start) - trace.start),
          0,
        ),
      ),
      queueMs: Math.round(
        traces.reduce(
          (sum, trace) =>
            sum +
            trace.operations.reduce(
              (total, span) =>
                total +
                ((span.started ?? span.settled ?? span.queued) - span.queued),
              0,
            ),
          0,
        ),
      ),
      slowestMs: Math.round(
        Math.max(
          0,
          ...traces.map((trace) => (trace.end ?? trace.start) - trace.start),
        ),
      ),
      lateMs: Math.round(
        Math.max(0, ...traces.map((trace) => trace.lateMs ?? 0)),
      ),
      errors:
        (failed ? 1 : 0) +
        traces.filter((trace) => (trace.status ?? 0) >= 400 || trace.aborted)
          .length,
      ...(error === undefined ? {} : { error }),
    });
  }
  return results;
}

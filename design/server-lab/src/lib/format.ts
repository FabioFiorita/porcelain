import type { Trace } from './lab';

export const ms = (value: number | undefined) => {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (value >= 10_000) return `${(value / 1000).toFixed(1)} s`;
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  if (value >= 10) return `${Math.round(value)} ms`;
  return `${value.toFixed(1)} ms`;
};

export const bytes = (value: number | undefined) => {
  if (value === undefined) return '—';
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)} MB`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)} KB`;
  return `${value} B`;
};

export const count = (value: number | undefined) =>
  value === undefined ? '—' : new Intl.NumberFormat('en').format(value);

export const duration = (trace: Trace) =>
  (trace.end ?? trace.start) - trace.start;

export const queueWait = (trace: Trace) =>
  trace.operations.reduce(
    (total, span) =>
      total + ((span.started ?? span.settled ?? span.queued) - span.queued),
    0,
  );

export const processTime = (trace: Trace) =>
  trace.processes.reduce(
    (total, span) => total + ((span.end ?? span.start) - span.start),
    0,
  );

/** `git -C <repo> -c a=b diff --cached … -- path` → `diff --cached …`. */
export function gitCommand(args: string[]) {
  const out: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index] as string;
    if (arg === '-C' || arg === '-c') {
      index++;
      continue;
    }
    if (arg === '--no-replace-objects' || arg.startsWith('--literal-pathspecs'))
      continue;
    out.push(arg);
  }
  return out.join(' ');
}

/** The subcommand plus its leading flags, for grouping repeated calls. */
export function gitSignature(args: string[]) {
  const command = gitCommand(args).split(' -- ')[0] ?? '';
  return command
    .split(' ')
    .filter((part) => !part.includes('/') && !part.includes(':('))
    .slice(0, 4)
    .join(' ');
}

export const percentile = (values: number[], p: number) => {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};

export function routeLabel(trace: Trace) {
  return trace.route ?? trace.url.split('?')[0];
}

/** Drops the worktree/project prefix most routes share, so the verb stays visible. */
export function shortRoute(trace: Trace) {
  return (routeLabel(trace) ?? '')
    .replace(/^\/projects\/:projectId\/worktrees\/:worktreeId/, '…')
    .replace(/^\/worktrees\/:worktreeId/, '…')
    .replace(/^\/projects\/:projectId/, 'project…');
}

export const origins = [
  'web',
  'console',
  'bench',
  'mcp',
  'setup',
  'background',
] as const;
export const originLabel: Record<string, string> = {
  web: 'Web app',
  console: 'Console',
  bench: 'Benchmark',
  mcp: 'MCP agent',
  setup: 'Setup',
  background: 'Background',
};

export type Interaction = {
  id: string;
  origin: Trace['origin'];
  label: string;
  start: number;
  end: number;
  traces: Trace[];
};

/** Consecutive requests from one origin with short gaps read as one interaction. */
export function groupInteractions(traces: Trace[], gapMs = 350): Interaction[] {
  const groups: Interaction[] = [];
  const open = new Map<string, Interaction>();
  for (const trace of traces) {
    const key =
      trace.origin === 'bench'
        ? `bench:${trace.run}:${trace.step}`
        : trace.origin;
    const current = open.get(key);
    const end = (trace.end ?? trace.start) + (trace.lateMs ?? 0);
    if (current && trace.start - current.end <= gapMs) {
      current.traces.push(trace);
      current.end = Math.max(current.end, end);
      continue;
    }
    const group: Interaction = {
      id: trace.id,
      origin: trace.origin,
      label:
        trace.origin === 'bench'
          ? (trace.step ?? 'bench')
          : trace.origin === 'background'
            ? trace.url
            : routeLabel(trace),
      start: trace.start,
      end,
      traces: [trace],
    };
    groups.push(group);
    open.set(key, group);
  }
  return groups;
}

export function totals(traces: Trace[]) {
  return {
    requests: traces.filter((trace) => trace.origin !== 'background').length,
    processes: traces.reduce((sum, trace) => sum + trace.processes.length, 0),
    sql: traces.reduce((sum, trace) => sum + trace.sqlCount, 0),
    queue: traces.reduce((sum, trace) => sum + queueWait(trace), 0),
    late: Math.max(0, ...traces.map((trace) => trace.lateMs ?? 0)),
    errors: traces.filter(
      (trace) => (trace.status ?? 0) >= 400 || trace.aborted,
    ).length,
  };
}

/** Matches a concrete URL path against a route pattern with `:params`. */
export function matchesRoute(pattern: string, path: string) {
  const a = pattern.split('/');
  const b = path.split('?')[0]?.split('/') ?? [];
  return (
    a.length === b.length &&
    a.every((part, index) => part.startsWith(':') || part === b[index])
  );
}

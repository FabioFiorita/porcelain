import { AsyncLocalStorage } from 'node:async_hooks';
import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { subscribe, unsubscribe } from 'node:diagnostics_channel';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import type {
  OperationSpan,
  Origin,
  ProcessSpan,
  Trace,
  Vitals,
} from './protocol.ts';

const now = () => performance.timeOrigin + performance.now();
const MAX_SQL = 150;
/** Late work is still attributed to a finished request for this long. */
const LATE_WINDOW_MS = 30_000;

type Open = { trace: Trace; lastSent: number; pending?: NodeJS.Timeout };

/**
 * Attributes Git processes, operation-queue events and SQL statements to the
 * HTTP request that caused them, through AsyncLocalStorage. Work outside a
 * request becomes a "background" trace that flushes after a quiet period.
 */
export function createTracer(send: (trace: Trace) => void) {
  const storage = new AsyncLocalStorage<Open>();
  const open = new Set<Open>();
  const operations = new Map<number, { entry: Open; span: OperationSpan }>();
  const queues: Vitals['queues'] = {};
  const loop = monitorEventLoopDelay({ resolution: 10 });
  loop.enable();
  let activeProcesses = 0;
  let background: Open | undefined;
  let backgroundTimer: NodeJS.Timeout | undefined;
  let backgroundLabel = 'startup';
  let roots: [string, string][] = [];

  const shorten = (value: string) => {
    for (const [root, label] of roots)
      if (value === root || value.startsWith(`${root}/`))
        return label + value.slice(root.length);
    return value;
  };

  const flush = (entry: Open) => {
    if (entry.pending) clearTimeout(entry.pending);
    entry.pending = undefined;
    entry.lastSent = now();
    send(structuredClone(entry.trace));
  };

  // Late events re-send the finished trace, batched.
  const touched = (entry: Open) => {
    const { trace } = entry;
    if (trace.origin === 'background') {
      if (backgroundTimer) clearTimeout(backgroundTimer);
      backgroundTimer = setTimeout(closeBackground, 400);
      return;
    }
    if (trace.end === undefined) return;
    trace.lateMs = Math.max(trace.lateMs ?? 0, now() - trace.end);
    entry.pending ??= setTimeout(() => flush(entry), 150);
  };

  const closeBackground = () => {
    const entry = background;
    if (!entry) return;
    const busy =
      entry.trace.processes.some((span) => span.end === undefined) ||
      entry.trace.operations.some((span) => span.settled === undefined);
    if (busy) {
      backgroundTimer = setTimeout(closeBackground, 400);
      return;
    }
    background = undefined;
    entry.trace.end = now();
    flush(entry);
  };

  const current = (): Open => {
    const entry = storage.getStore();
    if (entry) return entry;
    if (!background) {
      background = {
        trace: blankTrace('background', 'BACKGROUND', backgroundLabel),
        lastSent: 0,
      };
    }
    return background;
  };

  const unsubscribers = [
    watch('child_process', (message) => {
      const child = (message as { process: ChildProcess }).process;
      const entry = current();
      const span: ProcessSpan = {
        pid: undefined,
        file: '',
        args: [],
        start: now(),
      };
      entry.trace.processes.push(span);
      activeProcesses++;
      // The channel fires inside the ChildProcess constructor, before spawn()
      // records the command. Count output only on streams the server already
      // consumes, so the lab never drains a pipe the server would leave full.
      queueMicrotask(() => {
        span.pid = child.pid;
        span.file = child.spawnfile ?? '';
        span.args = (child.spawnargs ?? []).slice(1).map(shorten);
        const stdout = child.stdout;
        if (
          stdout &&
          stdout.listenerCount('data') + stdout.listenerCount('readable') > 0
        ) {
          span.stdoutBytes = 0;
          stdout.on('data', (chunk: Buffer | string) => {
            span.stdoutBytes =
              (span.stdoutBytes ?? 0) +
              (typeof chunk === 'string'
                ? Buffer.byteLength(chunk)
                : chunk.length);
          });
        }
      });
      let finished = false;
      const finish = (code: number | null, signal: string | null) => {
        if (finished) return;
        finished = true;
        activeProcesses--;
        span.end = now();
        span.exitCode = code;
        span.signal = signal;
        touched(entry);
      };
      child.once('close', finish);
      child.once('error', () => finish(null, 'error'));
    }),
    watch('porcelain:operation', (message) => {
      const event = message as {
        runner: string;
        operation: number;
        phase: 'queued' | 'started' | 'settled';
        failed?: boolean;
      };
      const counts = queues[event.runner] ?? { queued: 0, running: 0 };
      queues[event.runner] = counts;
      if (event.phase === 'queued') {
        const entry = current();
        const span: OperationSpan = {
          runner: event.runner,
          operation: event.operation,
          queued: now(),
        };
        entry.trace.operations.push(span);
        operations.set(event.operation, { entry, span });
        counts.queued++;
        return;
      }
      const known = operations.get(event.operation);
      if (!known) return;
      if (event.phase === 'started') {
        known.span.started = now();
        counts.queued--;
        counts.running++;
      } else {
        known.span.settled = now();
        known.span.failed = event.failed;
        if (known.span.started === undefined) counts.queued--;
        else counts.running--;
        operations.delete(event.operation);
      }
      touched(known.entry);
    }),
    watch('porcelain:sql', (message) => {
      const sql = (message as { sql: string }).sql;
      const entry = current();
      entry.trace.sqlCount++;
      if (entry.trace.sql.length < MAX_SQL)
        entry.trace.sql.push({
          at: now(),
          sql: sql.length > 400 ? `${sql.slice(0, 400)}…` : sql,
          table: sqlTable(sql),
          kind: sqlKind(sql),
        });
      touched(entry);
    }),
  ];

  const vitals = setInterval(() => {
    const memory = process.memoryUsage();
    const sample: Vitals = {
      at: now(),
      rssMb: Math.round(memory.rss / 1e6),
      heapMb: Math.round(memory.heapUsed / 1e6),
      eventLoopP99Ms: +(loop.percentile(99) / 1e6).toFixed(1),
      eventLoopMaxMs: +(loop.max / 1e6).toFixed(1),
      activeProcesses,
      queues: structuredClone(queues),
    };
    loop.reset();
    vitalsListener?.(sample);
  }, 1000);
  vitals.unref();
  let vitalsListener: ((vitals: Vitals) => void) | undefined;

  const sweep = setInterval(() => {
    const cutoff = now() - LATE_WINDOW_MS;
    for (const entry of open)
      if (entry.trace.end !== undefined && entry.trace.end < cutoff) {
        if (entry.pending) flush(entry);
        open.delete(entry);
      }
  }, 5000);
  sweep.unref();

  return {
    setRoots(next: [string, string][]) {
      roots = [...next].sort((a, b) => b[0].length - a[0].length);
    },
    setBackgroundLabel(label: string) {
      if (background) closeBackground();
      backgroundLabel = label;
    },
    /** The trace of the request running in the current async context. */
    current(): Trace | undefined {
      return storage.getStore()?.trace;
    },
    onVitals(listener: (vitals: Vitals) => void) {
      vitalsListener = listener;
    },
    /** Runs `handle` with a new request trace as the async context. */
    request(
      details: {
        method: string;
        url: string;
        origin: Origin;
        run?: string;
        step?: string;
      },
      handle: (
        trace: Trace,
        done: (status: number, aborted: boolean, bytes: number) => void,
      ) => void,
    ) {
      const trace = blankTrace(details.origin, details.method, details.url);
      if (details.run) trace.run = details.run;
      if (details.step) trace.step = details.step;
      const entry: Open = { trace, lastSent: 0 };
      open.add(entry);
      storage.run(entry, () =>
        handle(trace, (status, aborted, bytes) => {
          if (trace.end !== undefined) return;
          trace.end = now();
          trace.status = status;
          trace.responseBytes = bytes;
          if (aborted) trace.aborted = true;
          flush(entry);
        }),
      );
    },
    close() {
      for (const stop of unsubscribers) stop();
      clearInterval(vitals);
      clearInterval(sweep);
      loop.disable();
      if (background) closeBackground();
    },
  };
}

function watch(name: string, listener: (message: unknown) => void) {
  const handler = (message: unknown) => {
    try {
      listener(message);
    } catch (error) {
      // A tracing bug must never break the server under observation.
      console.error('[lab tracing]', error);
    }
  };
  subscribe(name, handler);
  return () => unsubscribe(name, handler);
}

function blankTrace(origin: Origin, method: string, url: string): Trace {
  return {
    id: randomUUID(),
    origin,
    method,
    url,
    start: now(),
    operations: [],
    processes: [],
    sqlCount: 0,
    sql: [],
  };
}

function sqlTable(sql: string) {
  return (
    /\b(?:from|into|update|join|table)\s+["`[]?([\w]+)/i.exec(sql)?.[1] ??
    /^\s*pragma\s+(\w+)/i.exec(sql)?.[1] ??
    '—'
  );
}

function sqlKind(sql: string): 'read' | 'write' | 'other' {
  if (/^\s*(select|with)\b/i.test(sql)) return 'read';
  if (/^\s*(insert|update|delete|replace)\b/i.test(sql)) return 'write';
  return 'other';
}

export { now };

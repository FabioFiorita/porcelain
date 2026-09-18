import { useSyncExternalStore } from 'react';
import type {
  BenchRun,
  Budget,
  LabEvent,
  RouteInfo,
  RuntimeMode,
  RuntimeState,
  Trace,
  Vitals,
  WebState,
} from '../../host/protocol';

export type {
  BenchRun,
  Budget,
  RouteInfo,
  RuntimeMode,
  RuntimeState,
  Trace,
  Vitals,
  WebState,
};

export type LabStatic = {
  profiles: Record<
    string,
    { label?: string; description?: string; targets?: Record<string, unknown> }
  >;
  budgets: Record<string, Budget>;
  simulationActions: {
    action: string;
    title: string;
    detail: string;
    count?: boolean;
  }[];
  benchSteps: { id: string; title: string; playgroundOnly: boolean }[];
  realRoots: string[];
};

type Snapshot = {
  runtime: RuntimeState;
  web: WebState;
  vitals?: Vitals;
  vitalsHistory: Vitals[];
  traces: Trace[];
  bench?: { run: BenchRun; progress?: string; done: boolean };
  messages: { at: number; text: string; ok: boolean }[];
  connected: boolean;
  revision: number;
};

const traces = new Map<string, Trace>();
let snapshot: Snapshot = {
  runtime: { status: 'stopped' },
  web: { status: 'stopped' },
  vitalsHistory: [],
  traces: [],
  messages: [],
  connected: false,
  revision: 0,
};
const listeners = new Set<() => void>();
let scheduled = false;

function commit(patch: Partial<Snapshot>, rebuildTraces = false) {
  snapshot = {
    ...snapshot,
    ...patch,
    ...(rebuildTraces
      ? { traces: [...traces.values()].sort((a, b) => a.start - b.start) }
      : {}),
    revision: snapshot.revision + 1,
  };
  if (scheduled) return;
  scheduled = true;
  // Bench runs stream hundreds of traces; render once per frame.
  requestAnimationFrame(() => {
    scheduled = false;
    for (const listener of listeners) listener();
  });
}

let started = false;
export function connectLab() {
  if (started) return;
  started = true;
  void fetch('/lab/api/traces')
    .then((response) => response.json())
    .then(({ traces: initial }: { traces: Trace[] }) => {
      for (const trace of initial) traces.set(trace.id, trace);
      commit({}, true);
    });
  const source = new EventSource('/lab/api/events');
  source.onopen = () => commit({ connected: true });
  source.onerror = () => commit({ connected: false });
  let pendingTraces = false;
  source.onmessage = (message) => {
    const event = JSON.parse(message.data) as LabEvent;
    switch (event.type) {
      case 'runtime':
        commit({ runtime: event.state });
        break;
      case 'web':
        commit({ web: event.state });
        break;
      case 'vitals':
        commit({
          vitals: event.vitals,
          vitalsHistory: [...snapshot.vitalsHistory, event.vitals].slice(-120),
        });
        break;
      case 'trace':
        traces.set(event.trace.id, event.trace);
        if (!pendingTraces) {
          pendingTraces = true;
          setTimeout(() => {
            pendingTraces = false;
            commit({}, true);
          }, 80);
        }
        break;
      case 'cleared':
        traces.clear();
        commit({}, true);
        break;
      case 'bench':
        commit({ bench: event });
        if (event.done) void refreshBench();
        break;
      case 'simulation':
        commit({
          messages: [
            ...snapshot.messages,
            { at: Date.now(), text: event.message, ok: event.ok },
          ].slice(-50),
        });
        break;
    }
  };
}

export function useLab() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
  );
}

let benchListeners: (() => void)[] = [];
async function refreshBench() {
  for (const listener of benchListeners) listener();
}
export function onBenchDone(listener: () => void) {
  benchListeners.push(listener);
  return () => {
    benchListeners = benchListeners.filter(
      (candidate) => candidate !== listener,
    );
  };
}

export async function labApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/lab/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!response.ok)
    throw new Error(data?.error ?? data?.message ?? response.statusText);
  return data as T;
}

export const startRuntime = (mode: RuntimeMode) =>
  labApi('/runtime', { method: 'POST', body: JSON.stringify({ mode }) });

export type PorcelainResponse = {
  status: number;
  ms: number;
  bytes: number;
  data: unknown;
  text: string;
};

/** Calls the real server through the lab proxy, as the reviewer (bearer token). */
export async function porcelain(
  method: string,
  path: string,
  options: {
    body?: unknown;
    run?: string;
    origin?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<PorcelainResponse> {
  const started = performance.now();
  const response = await fetch(`/porcelain${path}`, {
    method,
    headers: {
      ...(options.body === undefined
        ? {}
        : { 'content-type': 'application/json' }),
      ...(options.run ? { 'x-lab-run': options.run } : {}),
      ...(options.origin ? { 'x-lab-origin': options.origin } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {}
  return {
    status: response.status,
    ms: performance.now() - started,
    bytes: new TextEncoder().encode(text).length,
    data,
    text,
  };
}

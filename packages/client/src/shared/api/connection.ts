import type { ManagedRuntime } from 'effect';
import type { Atom, Reactivity } from 'effect/reactivity';
import type { WriteQueues } from './write-queue.ts';
import type { Transport } from './transport.ts';

export type WorktreeConnection = {
  environmentId: string;
  transport: Transport;
  request: (signal?: AbortSignal) => { signal: AbortSignal };
  cacheIdentity?: readonly string[];
};

export type WorktreeScope = { projectId: string; worktreeId: string };

export type RuntimeConnection = WorktreeConnection & {
  readonly atoms: Atom.RuntimeFactory;
  readonly runtime: ManagedRuntime.ManagedRuntime<
    WriteQueues | Reactivity.Reactivity,
    never
  >;
  readonly close: () => Promise<void>;
};

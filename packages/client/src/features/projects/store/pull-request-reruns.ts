import { Atom } from 'effect/reactivity';
import type { RequestedRerun } from '../rules/pull-request-checks.ts';

export const requestedReruns = Atom.family(
  (_key: { environmentId: string; projectId: string; number: number }) =>
    Atom.make<readonly RequestedRerun[]>([]).pipe(Atom.keepAlive),
);

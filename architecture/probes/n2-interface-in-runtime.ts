import type { Probe } from '../probe.ts';

export default {
  decision: 'N2',
  plants:
    'new apps/server/src/runtime/lane-observer.ts: export interface LaneObserver (a port declared in runtime/)',
  gate: 'lint',
  rule: 'porcelain(interfaces-only-in-ports)',
  edits: [
    {
      kind: 'create',
      path: 'apps/server/src/runtime/lane-observer.ts',
      content: `export interface LaneObserver {
  queued(lane: string): void;
  settled(lane: string, failed: boolean): void;
}
`,
    },
  ],
} satisfies Probe;

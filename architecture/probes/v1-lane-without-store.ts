import type { Probe } from '../probe.ts';

export default {
  decision: 'V1',
  plants:
    'use-cases/access/clear-browser-session.ts, which holds no store or service, queues its pure answer behind the access lane',
  gate: 'lint',
  rule: 'porcelain(lane-only-with-store)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/clear-browser-session.ts',
      old: `    return this.lanes.unqueued(
      async (): Promise<ClearBrowserSessionResponse> => undefined,`,
      new: `    return this.lanes.run(
      'access',
      'read',
      async (): Promise<ClearBrowserSessionResponse> => undefined,`,
    },
  ],
} satisfies Probe;

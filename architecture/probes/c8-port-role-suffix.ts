import type { Probe } from '../probe.ts';

export default {
  decision: 'STYLE',
  plants: 'a port name drops its conventional role suffix',
  gate: 'lint',
  rule: 'porcelain(port-shape)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/ports/event-publisher.ts',
      old: 'export interface EventPublisher',
      new: 'export interface Events',
    },
  ],
} satisfies Probe;

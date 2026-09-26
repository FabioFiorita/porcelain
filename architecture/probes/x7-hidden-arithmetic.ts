import type { Probe } from '../probe.ts';

export default {
  decision: 'X7',
  plants:
    'a service returning [0, 0, 0, 0, 0].length * (1 + 1), a limit built from numbers no larger than 1',
  gate: 'lint',
  rule: 'porcelain(no-number-outside-limits)',
  edits: [
    {
      kind: 'create',
      path: 'packages/projects/src/services/probe-page-size-service.ts',
      content: `export class ProbePageSizeService {
  execute(): number {
    return [0, 0, 0, 0, 0].length * (1 + 1);
  }
}
`,
    },
  ],
} satisfies Probe;

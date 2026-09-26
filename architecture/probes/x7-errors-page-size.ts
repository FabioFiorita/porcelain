import type { Probe } from '../probe.ts';

export default {
  decision: 'X7',
  plants:
    'errors/probe-limit.ts exporting PAGE_SIZE = 50, used by a service returning [0, 0, 0, 0, 0].length * (1 + 1) + PAGE_SIZE',
  gate: 'lint',
  rule: 'porcelain(no-number-outside-limits)',
  edits: [
    {
      kind: 'create',
      path: 'packages/projects/src/errors/probe-limit.ts',
      content: `export const PAGE_SIZE = 50;
`,
    },
    {
      kind: 'create',
      path: 'packages/projects/src/services/probe-page-size-service.ts',
      content: `import { PAGE_SIZE } from '../errors/probe-limit.ts';

export class ProbePageSizeService {
  execute(): number {
    return [0, 0, 0, 0, 0].length * (1 + 1) + PAGE_SIZE;
  }
}
`,
    },
  ],
} satisfies Probe;

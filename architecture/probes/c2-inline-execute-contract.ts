import type { Probe } from '../probe.ts';

export default {
  decision: 'STYLE',
  plants: 'a service declares its input inline instead of using a named model',
  gate: 'lint',
  rule: 'porcelain(no-inline-execute-types)',
  edits: [
    {
      kind: 'create',
      path: 'packages/files/src/services/probe-input-service.ts',
      content:
        'export class ProbeInputService { execute(input: { path: string }): void { String(input.path); } }\n',
    },
  ],
} satisfies Probe;

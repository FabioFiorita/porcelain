import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'an interface declared in runtime/delay.ts',
  gate: 'lint',
  rule: 'porcelain(no-interface-in-runtime)',
  edits: [
    {
      kind: 'append',
      path: 'apps/server/src/runtime/delay.ts',
      content:
        '\nexport interface ProbeDelay {\n  readonly milliseconds: string;\n}\n',
    },
  ],
} satisfies Probe;

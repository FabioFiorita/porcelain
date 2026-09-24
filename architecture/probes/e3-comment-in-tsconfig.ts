import type { Probe } from '../probe.ts';

export default {
  decision: 'EVASION',
  plants: 'tsconfig.json: a // comment inside compilerOptions',
  gate: 'lint',
  rule: 'style(strict-json)',
  edits: [
    {
      kind: 'replace',
      path: 'tsconfig.json',
      old: '    "strict": true,',
      new: `    // strict everywhere
    "strict": true,`,
    },
  ],
} satisfies Probe;

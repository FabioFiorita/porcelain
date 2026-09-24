import type { Probe } from '../probe.ts';

export default {
  decision: 'EVASION',
  plants: '.oxlintrc.json: a // comment inside the rules block',
  gate: 'lint',
  rule: 'is not strict JSON',
  edits: [
    {
      kind: 'replace',
      path: '.oxlintrc.json',
      old: '    "porcelain/no-comments": "error",',
      new: `    // keep comments out of code
    "porcelain/no-comments": "error",`,
    },
  ],
} satisfies Probe;

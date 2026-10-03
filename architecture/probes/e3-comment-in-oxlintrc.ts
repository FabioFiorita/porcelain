import type { Probe } from '../probe.ts';

export default {
  decision: 'EVASION',
  plants: '.oxlintrc.json: a // comment inside the rules block',
  gate: 'lint',
  rule: 'style(strict-json)',
  edits: [
    {
      kind: 'replace',
      path: '.oxlintrc.json',
      old: '    "porcelain/models-are-types": "error",',
      new: `    // keep comments out of code
    "porcelain/models-are-types": "error",`,
    },
  ],
} satisfies Probe;

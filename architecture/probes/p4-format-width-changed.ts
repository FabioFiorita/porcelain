import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'the format configuration widened to 120 columns',
  gate: 'web-lint',
  rule: 'style(format-config)',
  edits: [
    {
      kind: 'replace',
      path: '.oxfmtrc.json',
      old: '"printWidth": 80',
      new: '"printWidth": 120',
    },
  ],
} satisfies Probe;

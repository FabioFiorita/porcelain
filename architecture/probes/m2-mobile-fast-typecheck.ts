import type { Probe } from '../probe.ts';

export default {
  decision: 'M2',
  plants: 'mobile typechecking is removed from the fast check',
  gate: 'lint',
  rule: 'style(package-scripts)',
  edits: [
    {
      kind: 'replace',
      path: 'scripts/check.ts',
      old: "  'typecheck:mobile',\n",
      new: '',
    },
  ],
} satisfies Probe;

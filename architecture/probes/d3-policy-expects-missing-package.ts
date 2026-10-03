import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'policy expects a package that has no folder',
  gate: 'arch',
  rule: 'missing-target-package:',
  edits: [
    {
      kind: 'replace',
      path: 'architecture/policy.ts',
      old: "  process: { '.': './src/index.ts' },",
      new: "  process: { '.': './src/index.ts' },\n  probe: { '.': './src/index.ts' },",
    },
  ],
} satisfies Probe;

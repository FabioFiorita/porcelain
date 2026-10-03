import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'policy expects a ./probe entry that the process package does not export',
  gate: 'arch',
  rule: 'missing-target-export:',
  edits: [
    {
      kind: 'replace',
      path: 'architecture/policy.ts',
      old: "  process: { '.': './src/index.ts' },",
      new: "  process: { '.': './src/index.ts', './probe': './src/probe.ts' },",
    },
  ],
} satisfies Probe;

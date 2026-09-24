import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'the process package exports a ./probe entry that policy does not plan',
  gate: 'arch',
  rule: 'unclassified-package-export:',
  edits: [
    {
      kind: 'replace',
      path: 'packages/process/package.json',
      old: '    ".": "./src/index.ts"\n',
      new: '    ".": "./src/index.ts",\n    "./probe": "./src/index.ts"\n',
    },
  ],
} satisfies Probe;

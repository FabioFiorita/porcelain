import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'a server files adapter imports @porcelain/process, which only git, agents and the installer may use',
  gate: 'arch',
  rule: 'process-importable-by-git-agents-installer:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/server/src/adapters/files/inspect-path.ts',
      content: "import '@porcelain/process';\n",
    },
  ],
} satisfies Probe;

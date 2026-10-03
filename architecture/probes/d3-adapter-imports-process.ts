import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'an access adapter imports @porcelain/process, which only git, agents, the installer and the server gateways listed with a reason may use',
  gate: 'arch',
  rule: 'process-importable-by-git-agents-installer:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/server/src/adapters/access/os-network-address-reader.ts',
      content: "import '@porcelain/process';\n",
    },
  ],
} satisfies Probe;

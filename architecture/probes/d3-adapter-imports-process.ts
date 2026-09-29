import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'the access adapter beside the Tailscale one imports @porcelain/process, which only git, agents, the installer and exactly the Tailscale adapter may use',
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

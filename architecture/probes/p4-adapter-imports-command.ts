import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'an adapter imports a feature command instead of receiving a callback',
  gate: 'web-lint',
  rule: 'porcelain(web-adapters-are-imperative-glue)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/adapters/probe-adapter.ts',
      content:
        "import { useDisconnect } from '../commands/disconnect';\nexport const probeCommand = useDisconnect;\n",
    },
  ],
} satisfies Probe;

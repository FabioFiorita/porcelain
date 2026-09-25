import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a view imports a server contract',
  gate: 'web-lint',
  rule: 'porcelain(web-views-no-contracts)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "import type { Principal } from '@porcelain/contracts/access';\n\nexport type ProbePrincipal = Principal;\n",
    },
  ],
} satisfies Probe;

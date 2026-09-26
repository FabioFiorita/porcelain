import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'an adapter imports the router to own navigation',
  gate: 'web-lint',
  rule: 'porcelain(web-adapters-are-imperative-glue)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/adapters/probe-adapter.ts',
      content:
        "import { useNavigate } from '@tanstack/react-router';\nexport const probeNavigate = useNavigate;\n",
    },
  ],
} satisfies Probe;

import type { Probe } from '../probe.ts';

export default {
  decision: 'WG4',
  plants: 'a new web page has no feature map naming its route',
  gate: 'features',
  rule: 'apps/web/src/routes/probe.tsx: it renders the page at /probe, which no web map file names as its route',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/routes/probe.tsx',
      content:
        "import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/probe')({ component: ProbePage });\nfunction ProbePage() { return <main>Probe page</main>; }\n",
    },
  ],
} satisfies Probe;

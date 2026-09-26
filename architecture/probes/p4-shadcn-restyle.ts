import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a route restyles a shadcn Button with spacing and colour classes',
  gate: 'web-lint',
  rule: 'shadcn(no-restyle)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/routes/probe-restyle.tsx',
      content:
        'import { Button } from \'@/components/ui/button\';\n\nexport const Probe = () => <Button className="p-4 bg-red-500">Save</Button>;\n',
    },
  ],
} satisfies Probe;

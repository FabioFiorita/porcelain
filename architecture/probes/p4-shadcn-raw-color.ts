import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a route paints a shadcn Button with a raw palette colour',
  gate: 'web-lint',
  rule: 'shadcn(no-raw-colors)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/routes/probe-restyle.tsx',
      content:
        'import { Button } from \'@/components/ui/button\';\n\nexport const Probe = () => <Button className="p-4 bg-red-500">Save</Button>;\n',
    },
  ],
} satisfies Probe;

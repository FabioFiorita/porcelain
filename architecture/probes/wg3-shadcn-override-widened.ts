import type { Probe } from '../probe.ts';

export default {
  decision: 'WG3',
  plants:
    '.oxlintrc.json: the components/ui override that spares registry files from the shadcn call-site rules widened to every web file, plus a restyled Button in a route',
  gate: 'web-lint',
  rule: 'style(lint-config)',
  edits: [
    {
      kind: 'replace',
      path: '.oxlintrc.json',
      old: '"files": ["apps/web/src/components/ui/**"]',
      new: '"files": ["apps/web/src/**"]',
    },
    {
      kind: 'create',
      path: 'apps/web/src/routes/probe-restyle.tsx',
      content:
        'import { Button } from \'@/components/ui/button\';\n\nexport const Probe = () => <Button className="p-4 bg-red-500">Save</Button>;\n',
    },
  ],
} satisfies Probe;

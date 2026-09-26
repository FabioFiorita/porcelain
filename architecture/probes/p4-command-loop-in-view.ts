import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a view renames many projects by calling the command once per item',
  gate: 'web-lint',
  rule: 'porcelain(web-views-no-command-loops)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        'export function probeRenameAll(\n  names: string[],\n  rename: { mutate: (name: string) => void },\n) {\n  names.forEach((name) => rename.mutate(name));\n}\n',
    },
  ],
} satisfies Probe;

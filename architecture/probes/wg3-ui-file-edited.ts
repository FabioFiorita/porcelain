import type { Probe } from '../probe.ts';

export default {
  decision: 'WG3',
  plants:
    'a hand edit to a shadcn component: the badge gains a variant the registry does not serve',
  gate: 'web-lint',
  rule: 'style(shadcn-ui-pinned)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/src/components/ui/badge.tsx',
      old: "        link: 'text-primary underline-offset-4 hover:underline',\n",
      new: "        link: 'text-primary underline-offset-4 hover:underline',\n        quiet: 'text-muted-foreground',\n",
    },
  ],
} satisfies Probe;

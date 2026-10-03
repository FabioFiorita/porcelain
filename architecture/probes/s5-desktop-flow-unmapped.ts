import type { Probe } from '../probe.ts';

export default {
  decision: 'S5',
  plants:
    'a desktop e2e test proves a native feature that no desktop map file names in its tests',
  gate: 'features',
  rule: 'apps/desktop/spec/e2e/menus.e2e.ts: it tests a native desktop feature that no desktop map file names in its tests; add it to the tests of the map file of the feature it proves, or write that map file.',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/desktop-verify/features/app.menus.md',
      old: '  - apps/desktop/spec/e2e/menus.e2e.ts\n',
      new: '',
    },
  ],
} satisfies Probe;

import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the tab layout store keeps its panes in memory but saves none to browser storage, so a reload loses the open and pinned tabs',
  gate: 'web-verify',
  feature: 'apps/web/spec/e2e/reviews-reload-layout.e2e.ts',
  rule: "Locator: getByRole('button', { name: 'Unpin README.md', exact: true })",
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/src/features/reviews/store.ts',
      old: '        partialize: (state) => ({ panes: state.panes }),\n',
      new: '        partialize: () => ({ panes: null }),\n',
    },
  ],
} satisfies Probe;

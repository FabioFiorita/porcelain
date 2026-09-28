import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the tab layout store keeps its panes in memory but saves none to browser storage, so a reload loses the open and pinned tabs',
  gate: 'web-verify',
  feature: 'reviews.reload-layout',
  rule: "reviews.reload-layout: open tabs, a pinned tab and a collapsed diff come back after a reload: expect.poll() function didn't resolve in time.",
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/src/features/reviews/store.ts',
      old: '        partialize: (state) => ({ panes: state.panes }),\n',
      new: '        partialize: () => ({ panes: null }),\n',
    },
  ],
} satisfies Probe;

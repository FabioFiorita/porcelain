export default {
  feature: 'review.mark',
  path: '/',
  behavior:
    'Marking and unmarking a changed file updates the visible control and persists both changes in the real server.',
  needsPairing: true,
  spec: 'apps/web/spec/browser/review-mark.browser.ts',
} as const;

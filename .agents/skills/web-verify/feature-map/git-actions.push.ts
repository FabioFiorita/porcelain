import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'git-actions.push',
  route: '/',
  reach: 'Git actions → Push',
  behaviour:
    'Pushing a branch without an upstream to a remote whose URL Porcelain cannot use is refused with how to change it, while Pull stays unavailable and the branch gains no upstream.',
  server: ['changes.read-git-status', 'git-actions.run-action'],
  spec: 'apps/web/spec/browser/git-actions-push.browser.ts',
} satisfies JourneyEntry;

import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'access.remote-update',
  route: '/settings/$section',
  reach:
    'Toggle Sidebar → Settings → This computer → Remote computers → Update to …',
  shell: 'desktop',
  behaviour:
    'This computer lists each remote computer’s update; an app that computer does not trust is told how to get trusted, and a trusted app starts the update there.',
  server: ['access.trusted-update', 'access.service-update'],
  spec: 'apps/web/spec/browser/access-remote-update.browser.ts',
} satisfies JourneyEntry;

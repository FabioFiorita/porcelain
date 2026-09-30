import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'app.settings-scope',
  route: '/',
  reach: 'Toggle Sidebar → Settings',
  shell: 'desktop',
  behaviour:
    'Desktop Settings shows Sharing and does not say preferences are stored on this device.',
  server: ['access.remote-access'],
  spec: 'apps/web/spec/browser/app-settings-scope.browser.ts',
} satisfies JourneyEntry;

import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'app.settings-scope',
  route: '/',
  reach: 'Toggle Sidebar → Settings → Sharing',
  shell: 'desktop',
  behaviour:
    'Desktop Settings lists Sharing as its own section and opens its page with the ways in.',
  server: ['access.remote-access'],
  spec: 'apps/web/spec/browser/app-settings-scope.browser.ts',
} satisfies JourneyEntry;

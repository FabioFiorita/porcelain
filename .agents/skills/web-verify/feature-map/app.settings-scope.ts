import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'app.settings-scope',
  route: '/',
  reach: 'Toggle Sidebar → Settings',
  shell: 'desktop',
  behaviour:
    'Settings says that its preferences stay in this browser while Sharing changes Porcelain for every device.',
  server: ['access.remote-access'],
  spec: 'apps/web/spec/browser/app-settings-scope.browser.ts',
} satisfies JourneyEntry;

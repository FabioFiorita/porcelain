import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'app.settings-scope',
  route: '/',
  reach: 'Toggle Sidebar → Settings → Ways in, Devices, Remote computers',
  shell: 'desktop',
  behaviour:
    'Desktop Settings splits sharing into This computer, Ways in, Devices and Remote computers, each its own page.',
  server: ['access.remote-access'],
  spec: 'apps/web/spec/browser/app-settings-scope.browser.ts',
} satisfies JourneyEntry;

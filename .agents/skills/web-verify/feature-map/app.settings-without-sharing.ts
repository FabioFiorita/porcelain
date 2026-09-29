import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'app.settings-without-sharing',
  route: '/',
  reach: 'Toggle Sidebar → Settings',
  shortcut: 'Alt+Shift+S',
  behaviour:
    'The web the server serves leaves Sharing to the desktop app: Settings keeps its preferences and Updates with no Sharing section, and the navigator still names this computer.',
  server: ['projects.inventory', 'access.service-update'],
  spec: 'apps/web/spec/browser/app-settings-without-sharing.browser.ts',
} satisfies JourneyEntry;

import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'app.settings-page',
  route: '/settings/$section',
  reach: 'Toggle Sidebar → Settings',
  shortcut: 'Alt+Shift+S',
  shell: 'desktop',
  behaviour:
    'Settings is its own page with one section at a time; Back and Escape return to where it was opened, Escape stays while typing in a field, and it opens even with no project registered.',
  server: ['projects.inventory', 'access.remote-access', 'projects.remove'],
  spec: 'apps/web/spec/browser/app-settings-page.browser.ts',
} satisfies JourneyEntry;

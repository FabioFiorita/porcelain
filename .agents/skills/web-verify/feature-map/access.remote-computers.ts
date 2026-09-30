import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'access.remote-computers',
  route: '/settings/$section',
  reach:
    'Toggle Sidebar → Settings → Remote computers → paste the pairing link → Add',
  shell: 'desktop',
  behaviour:
    'The desktop app pairs with another Porcelain from the link porcelain pair prints, across origins with its own credential, shows it online, refuses a used or unreadable link, and forgets it.',
  server: ['access.pairing', 'access.environment'],
  spec: 'apps/web/spec/browser/access-remote-computers.browser.ts',
} satisfies JourneyEntry;

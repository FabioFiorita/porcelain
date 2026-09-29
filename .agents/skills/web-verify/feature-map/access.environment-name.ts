import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'access.environment-name',
  route: '/',
  reach: 'Settings → Sharing → Name of this computer → Save',
  shell: 'desktop',
  behaviour:
    'The navigator header names the computer Porcelain runs on, its host name until the owner chooses a name in Settings, which the header, the browser tab title and the pairing instructions then show, and clearing it goes back to the host name.',
  server: ['access.environment-name', 'projects.inventory'],
  spec: 'apps/web/spec/browser/access-environment-name.browser.ts',
} satisfies JourneyEntry;

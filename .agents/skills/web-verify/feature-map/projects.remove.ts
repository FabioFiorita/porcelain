import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'projects.remove',
  route: '/',
  reach: 'sidebar → project → right-click → Remove from Porcelain → confirm',
  behaviour:
    'Removing a project after confirming takes it out of the navigator and the server forgets it, while cancelling keeps it.',
  server: ['projects.remove'],
  spec: 'apps/web/spec/browser/projects-remove.browser.ts',
} satisfies JourneyEntry;

import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'projects.rename',
  route: '/',
  reach: 'sidebar → project → right-click → Rename project',
  behaviour:
    'Renaming a project in the navigator shows the new name and the server keeps it.',
  server: ['projects.rename'],
  spec: 'apps/web/spec/browser/projects-rename.browser.ts',
} satisfies JourneyEntry;

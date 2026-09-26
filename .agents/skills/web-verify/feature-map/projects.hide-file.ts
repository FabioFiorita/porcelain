import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'projects.hide-file',
  route: '/',
  reach: 'Review → Files → README.md → right-click → Hide file',
  behaviour:
    'Hiding a file takes it out of the file tree and the server keeps it hidden for the project, and showing it again returns it.',
  server: ['projects.file-preferences'],
  spec: 'apps/web/spec/browser/projects-hide-file.browser.ts',
} satisfies JourneyEntry;

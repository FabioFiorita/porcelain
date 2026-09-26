import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'projects.open-folder',
  route: '/',
  reach: 'sidebar → Open project → Browse for a folder → folder → Open',
  behaviour:
    'Browsing the server folders from the Open project dialog opens a Git repository as a registered project in the navigator, while a folder that is not a repository cannot be opened by browsing or by typing its path.',
  server: ['projects.browse-folders', 'projects.register'],
  spec: 'apps/web/spec/browser/projects-open-folder.browser.ts',
} satisfies JourneyEntry;

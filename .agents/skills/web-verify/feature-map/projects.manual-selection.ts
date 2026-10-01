import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'projects.manual-selection',
  route: '/',
  reach: 'sidebar → Open project → browse → repository → Open',
  behaviour:
    'Repositories are registered only after explicit folder selection; opening the app does not discover or register other repositories.',
  server: ['projects.browse-folders', 'projects.register'],
  spec: 'apps/web/spec/browser/projects-manual-selection.browser.ts',
} satisfies JourneyEntry;

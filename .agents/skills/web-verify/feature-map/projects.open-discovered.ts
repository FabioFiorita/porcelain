import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'projects.open-discovered',
  route: '/',
  reach: 'sidebar → Open project → Found on this machine → search → repository',
  behaviour:
    'A repository found under the project home can be searched for and opened from the Open project dialog, and it appears in the navigator as a project the server registered.',
  server: ['projects.discover', 'projects.register'],
  spec: 'apps/web/spec/browser/projects-open-discovered.browser.ts',
} satisfies JourneyEntry;

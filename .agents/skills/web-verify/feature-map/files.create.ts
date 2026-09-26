import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'files.create',
  route: '/',
  reach: 'Review → Files → New file or New folder',
  behaviour:
    'At phone width, both creation buttons open an inline name editor and create the named entry on disk.',
  server: ['files.edit-file', 'files.list-directory'],
  spec: 'apps/web/spec/browser/files-create.browser.ts',
} satisfies JourneyEntry;

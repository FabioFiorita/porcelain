import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'access.restore-outage',
  route: '/$projectId/$worktreeId',
  reach: 'reload a workspace address while the server cannot answer',
  behaviour:
    'A reload whose session restore fails for a reason other than an unpaired browser keeps the workspace address, shows the retrying workspace error and opens the workspace once the connection returns.',
  server: ['access.session'],
  spec: 'apps/web/spec/browser/access-restore-outage.browser.ts',
} satisfies JourneyEntry;

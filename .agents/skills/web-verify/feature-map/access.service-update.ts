import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'access.service-update',
  route: '/',
  reach: 'Settings → Updates → Update to <version>',
  behaviour:
    'Settings shows the running version and the newer one the server offers; updating shows its progress, a failed update says why and that Porcelain still runs the version it had, and a successful one ends on the new version with an offer to reload.',
  server: ['access.service-update'],
  spec: 'apps/web/spec/browser/access-service-update.browser.ts',
} satisfies JourneyEntry;

import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'app.shell',
  route: '/',
  reach: 'open Porcelain in a browser that was never paired',
  behaviour:
    'A browser that was never paired finds no session on the real server and sees the instructions to pair it.',
  server: ['access.session'],
  spec: 'apps/web/spec/browser/app-shell.browser.ts',
} satisfies JourneyEntry;

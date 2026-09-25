export default {
  feature: 'access.pairing',
  path: '/pair',
  behavior:
    'A one-time link pairs the browser and opens the connected workspace; a link for another installation is rejected after checking the real server health.',
  needsPairing: true,
  spec: 'apps/web/spec/browser/access-pairing.browser.ts',
} as const;

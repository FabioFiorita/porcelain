export default {
  feature: 'access.session',
  path: '/api/inventory',
  behavior:
    'An unpaired browser cannot restore inventory, and clearing its session succeeds against the real server.',
  spec: 'apps/web/spec/browser/access-session.browser.ts',
} as const;

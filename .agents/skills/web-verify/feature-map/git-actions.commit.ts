export default {
  feature: 'git-actions.commit',
  path: '/',
  behavior:
    'A manual commit from the web writes the selected changes and appears in the real server history.',
  needsPairing: true,
  spec: 'apps/web/spec/browser/git-actions-commit.browser.ts',
} as const;

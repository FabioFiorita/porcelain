export default {
  feature: 'projects.rename',
  path: '/',
  behavior:
    'Renaming a project through the navigator updates its label and persists the name in the real server.',
  needsPairing: true,
  spec: 'apps/web/spec/browser/projects-rename.browser.ts',
} as const;

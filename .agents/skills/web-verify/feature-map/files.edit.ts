export default {
  feature: 'files.edit',
  path: '/',
  behavior:
    'Editing a file saves after a pause, with Done, and when its tab closes against the real server.',
  needsPairing: true,
  spec: 'apps/web/spec/browser/files-edit.browser.ts',
} as const;

export default {
  feature: 'files.conflict',
  path: '/',
  behavior:
    'A changed-file refusal carries a stable code through the browser transport so the review client recognizes the conflict.',
  needsPairing: true,
  spec: 'apps/web/spec/browser/files-conflict.browser.ts',
} as const;

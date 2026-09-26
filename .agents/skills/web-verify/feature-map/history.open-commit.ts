import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'history.open-commit',
  route: '/',
  reach: 'Review → History → commit',
  behaviour:
    'Opening a commit from History shows its message, the files it changed with the diff of each text file, and a binary change listed without a code preview that says why.',
  server: [
    'changes.list-commits',
    'changes.read-commit-files',
    'changes.read-commit-diffs',
  ],
  spec: 'apps/web/spec/browser/history-open-commit.browser.ts',
} satisfies JourneyEntry;

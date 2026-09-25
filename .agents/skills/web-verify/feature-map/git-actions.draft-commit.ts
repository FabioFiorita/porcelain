import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'git-actions.draft-commit',
  route: '/',
  reach:
    'Commit → Commit model → Generate with AI → Commit selected files, or Commit → Use groups → Commit groups in order',
  behaviour:
    'With a coding CLI on the server the commit dialog drafts the message or the groups with the chosen model and commits what was drafted, while the server refuses a commit the worktree has moved past since the draft and a draft that leaves a selected file out.',
  server: [
    'git-actions.list-commit-models',
    'git-actions.generate-commit-draft',
    'git-actions.run-action',
  ],
  spec: 'apps/web/spec/browser/git-actions-draft-commit.browser.ts',
} satisfies JourneyEntry;

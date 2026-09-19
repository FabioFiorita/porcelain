import type { CommitModel } from '../../contracts/git-actions';

/** What the mock server's agent CLIs can run: Claude Code and Codex, both signed in. */
export const COMMIT_MODELS: CommitModel[] = [
  { id: 'claude:haiku', label: 'Haiku 4.5' },
  { id: 'claude:sonnet', label: 'Sonnet 5' },
  { id: 'claude:opus', label: 'Opus 5' },
  { id: 'claude:fable', label: 'Fable 5.1' },
  { id: 'codex:gpt-5-codex', label: 'GPT-5 Codex' },
  { id: 'codex:luna', label: 'Luna' },
];

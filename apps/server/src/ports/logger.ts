export type FailureReport =
  | {
      kind: 'request';
      requestId: string;
      method: string;
      url: string;
      error: unknown;
    }
  | { kind: 'job'; job: string; error: unknown }
  | { kind: 'git-action'; requestId: string; error: unknown }
  | { kind: 'review-refresh'; worktreeId: string; error: unknown }
  | { kind: 'live-updates'; error: unknown };

export interface Logger {
  failure(input: FailureReport): void;
}

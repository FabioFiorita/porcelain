import type { GitFilesystemError } from '../../shared/errors/git-filesystem-error.ts';
import type { FileSystem, PlatformError } from 'effect';
import type { ChildProcessSpawner } from 'effect/process';
import type { GitCommandError } from '../../shared/errors/git-command-error.ts';
import type { GitActionRejectedError } from '../../shared/errors/git-action-rejected-error.ts';
import type { InvalidGitStatusError } from '../../shared/errors/invalid-git-status-error.ts';
import type { UnsupportedPathEncodingError } from '../../shared/errors/unsupported-path-encoding-error.ts';
import type { InspectionLimitError } from '../../shared/errors/inspection-limit-error.ts';
import type { GitTimeoutError } from '../../shared/errors/git-timeout-error.ts';

export type ActionFailure =
  | GitFilesystemError
  | GitCommandError
  | GitActionRejectedError
  | InvalidGitStatusError
  | UnsupportedPathEncodingError
  | InspectionLimitError
  | GitTimeoutError
  | PlatformError.PlatformError;
export type ActionPlatform =
  | FileSystem.FileSystem
  | ChildProcessSpawner.ChildProcessSpawner;

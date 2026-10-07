import type { GitCommandError } from '../../shared/errors/git-command-error.ts';
import type { GitTimeoutError } from '../../shared/errors/git-timeout-error.ts';
import type { GitFilesystemError } from '../../shared/errors/git-filesystem-error.ts';
import type { UnsupportedFilesystemIdentityError } from '../../shared/errors/unsupported-filesystem-identity-error.ts';
import type { RepositoryIdentityMismatchError } from '../../shared/errors/repository-identity-mismatch-error.ts';
import type { UnsupportedGitFiltersError } from '../../shared/errors/unsupported-git-filters-error.ts';
import type { InspectionLimitError } from '../../shared/errors/inspection-limit-error.ts';

export type CheckoutVerificationFailure =
  | GitCommandError
  | GitTimeoutError
  | GitFilesystemError
  | UnsupportedFilesystemIdentityError
  | RepositoryIdentityMismatchError
  | InspectionLimitError;

export type CheckoutFilterFailure =
  | GitCommandError
  | GitTimeoutError
  | InspectionLimitError
  | UnsupportedGitFiltersError;

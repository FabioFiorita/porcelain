import type {
  WorktreeChangedError,
  WorktreeNotFoundError,
} from '@porcelain/kernel/errors';
import type {
  ProjectNotFoundError,
  WorktreeUnavailableError,
} from '@porcelain/projects/errors';

export type WorktreeAccessFailure =
  | WorktreeChangedError
  | WorktreeNotFoundError
  | WorktreeUnavailableError
  | ProjectNotFoundError;

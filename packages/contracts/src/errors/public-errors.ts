import { z } from 'zod'
import {
  boardCardNotFoundErrorSchema,
  boardInvalidTitleErrorSchema,
  boardUnavailableErrorSchema,
} from '../board/board.errors'
import {
  filesAlreadyExistsErrorSchema,
  filesNotFoundErrorSchema,
  filesPathOutsideProjectErrorSchema,
} from '../files'
import {
  gitBranchAlreadyExistsErrorSchema,
  gitBranchNotFoundErrorSchema,
  gitNotARepositoryErrorSchema,
  gitWorkingTreeConflictErrorSchema,
  gitWorktreeConflictErrorSchema,
} from '../git'
import {
  projectsNotADirectoryErrorSchema,
  projectsNotFoundErrorSchema,
  projectsUnavailableErrorSchema,
} from '../projects'
import {
  reviewCommentNotFoundErrorSchema,
  reviewUnavailableErrorSchema,
} from '../review/review.errors'
import {
  terminalCapacityErrorSchema,
  terminalExitedErrorSchema,
  terminalInvalidSizeErrorSchema,
  terminalNotFoundErrorSchema,
  terminalPasteUnavailableErrorSchema,
} from '../terminal'
import { definePublicError } from './define-public-error'
import {
  authForbiddenErrorSchema,
  authUnauthenticatedErrorSchema,
  internalUnexpectedErrorSchema,
  requestInvalidErrorSchema,
  resourceNotFoundErrorSchema,
  resourceUnavailableErrorSchema,
  stateConflictErrorSchema,
} from './system-errors'

export const protocolUpdateRequiredErrorDetailsSchema = z
  .object({
    expected: z.number().int().nonnegative(),
    received: z.number().int().nonnegative().nullable(),
  })
  .strict()

export const protocolUpdateRequiredErrorSchema = definePublicError({
  code: 'protocol.update-required',
  category: 'conflict',
  retryable: false,
  details: protocolUpdateRequiredErrorDetailsSchema,
})

export const publicErrorSchema = z.discriminatedUnion('code', [
  requestInvalidErrorSchema,
  authUnauthenticatedErrorSchema,
  authForbiddenErrorSchema,
  resourceNotFoundErrorSchema,
  stateConflictErrorSchema,
  resourceUnavailableErrorSchema,
  internalUnexpectedErrorSchema,
  protocolUpdateRequiredErrorSchema,
  boardUnavailableErrorSchema,
  boardCardNotFoundErrorSchema,
  boardInvalidTitleErrorSchema,
  reviewUnavailableErrorSchema,
  reviewCommentNotFoundErrorSchema,
  projectsNotFoundErrorSchema,
  projectsNotADirectoryErrorSchema,
  projectsUnavailableErrorSchema,
  filesAlreadyExistsErrorSchema,
  filesPathOutsideProjectErrorSchema,
  filesNotFoundErrorSchema,
  gitNotARepositoryErrorSchema,
  gitBranchNotFoundErrorSchema,
  gitBranchAlreadyExistsErrorSchema,
  gitWorktreeConflictErrorSchema,
  gitWorkingTreeConflictErrorSchema,
  terminalNotFoundErrorSchema,
  terminalExitedErrorSchema,
  terminalCapacityErrorSchema,
  terminalInvalidSizeErrorSchema,
  terminalPasteUnavailableErrorSchema,
])

export type PorcelainError = z.infer<typeof publicErrorSchema>
export type PublicErrorCode = PorcelainError['code']

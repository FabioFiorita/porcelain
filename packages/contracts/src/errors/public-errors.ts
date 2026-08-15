import { z } from 'zod'
import {
  actionsNotFoundErrorSchema,
  actionsUnavailableErrorSchema,
  actionsUntrustedErrorSchema,
} from '../actions'
import {
  boardCardNotFoundErrorSchema,
  boardInvalidTitleErrorSchema,
  boardUnavailableErrorSchema,
} from '../board'
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
  canvasNotFoundErrorSchema,
  canvasUnavailableErrorSchema,
  projectsNotADirectoryErrorSchema,
  projectsNotFoundErrorSchema,
  projectsUnavailableErrorSchema,
} from '../projects'
import { reviewCommentNotFoundErrorSchema, reviewUnavailableErrorSchema } from '../review'
import {
  devServerNotFoundErrorSchema,
  devServerRunningErrorSchema,
  devServerTargetErrorSchema,
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
  actionsUnavailableErrorSchema,
  actionsNotFoundErrorSchema,
  actionsUntrustedErrorSchema,
  reviewUnavailableErrorSchema,
  reviewCommentNotFoundErrorSchema,
  projectsNotFoundErrorSchema,
  projectsNotADirectoryErrorSchema,
  projectsUnavailableErrorSchema,
  canvasNotFoundErrorSchema,
  canvasUnavailableErrorSchema,
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
  devServerNotFoundErrorSchema,
  devServerTargetErrorSchema,
  devServerRunningErrorSchema,
])

export type PorcelainError = z.infer<typeof publicErrorSchema>
export type PublicErrorCode = PorcelainError['code']

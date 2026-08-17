import { z } from 'zod'
import {
  actionsNotFoundErrorSchema,
  actionsTargetInvalidErrorSchema,
  actionsUnavailableErrorSchema,
  actionsUntrustedErrorSchema,
} from '../actions'
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
  projectsDevRepoForbiddenErrorSchema,
  projectsNotADirectoryErrorSchema,
  projectsNotFoundErrorSchema,
  projectsOverlayTargetInvalidErrorSchema,
  projectsUnavailableErrorSchema,
} from '../projects'
import { reviewCommentNotFoundErrorSchema, reviewUnavailableErrorSchema } from '../review'
import {
  tasksAttachmentRejectedErrorSchema,
  tasksInvalidTitleErrorSchema,
  tasksNotFoundErrorSchema,
  tasksUnavailableErrorSchema,
} from '../tasks'
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
  tasksUnavailableErrorSchema,
  tasksNotFoundErrorSchema,
  tasksInvalidTitleErrorSchema,
  tasksAttachmentRejectedErrorSchema,
  actionsUnavailableErrorSchema,
  actionsNotFoundErrorSchema,
  actionsUntrustedErrorSchema,
  actionsTargetInvalidErrorSchema,
  projectsDevRepoForbiddenErrorSchema,
  projectsNotFoundErrorSchema,
  projectsNotADirectoryErrorSchema,
  projectsUnavailableErrorSchema,
  projectsOverlayTargetInvalidErrorSchema,
  canvasNotFoundErrorSchema,
  canvasUnavailableErrorSchema,
  reviewUnavailableErrorSchema,
  reviewCommentNotFoundErrorSchema,
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

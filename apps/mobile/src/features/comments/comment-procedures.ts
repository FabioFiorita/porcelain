import { reviewCommentMutations } from '@porcelain/client-runtime/review'
import { reviewProcedures } from '@porcelain/contracts/review'

import { type Environment, isPaired } from '@/features/remote'
import { getDaemonClient } from '@/lib/daemon/client'
import { DaemonError } from '@/lib/daemon/errors'
import { callDaemon, type DaemonProcedure, namedContractProcedure } from '@/lib/daemon/procedure'

/**
 * Mobile's Review-comment bindings.
 *
 * The five writes are composed from the shared mutation definitions rather than named here, so
 * the catalog key and the contract stay paired by the one module (`client-runtime/review`)
 * that already owns which procedure each consequence belongs to.
 */

export const reviewCommentsProcedure = namedContractProcedure(
  'reviewComments',
  reviewProcedures.reviewComments,
)

export const addReviewCommentProcedure = namedContractProcedure(
  reviewCommentMutations.add.procedureName,
  reviewCommentMutations.add.procedure,
)

export const editReviewCommentProcedure = namedContractProcedure(
  reviewCommentMutations.edit.procedureName,
  reviewCommentMutations.edit.procedure,
)

export const deleteReviewCommentProcedure = namedContractProcedure(
  reviewCommentMutations.delete.procedureName,
  reviewCommentMutations.delete.procedure,
)

export const resolveReviewCommentProcedure = namedContractProcedure(
  reviewCommentMutations.setResolved.procedureName,
  reviewCommentMutations.setResolved.procedure,
)

export const clearResolvedReviewCommentsProcedure = namedContractProcedure(
  reviewCommentMutations.clearResolved.procedureName,
  reviewCommentMutations.clearResolved.procedure,
)

/** Call a Review binding through the paired daemon, refusing loudly when there is none. */
export function callReviewDaemon<TInput, TOutput>(
  environment: Environment | null,
  procedure: DaemonProcedure<TInput, TOutput>,
  input: TInput,
): Promise<TOutput> {
  if (!isPaired(environment)) {
    return Promise.reject(new DaemonError('unreachable', procedure.name, 'No daemon is paired.'))
  }
  return callDaemon(getDaemonClient(environment), procedure, input)
}

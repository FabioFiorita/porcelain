import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { reviewContractFixtures } from '@porcelain/contracts/review'
import {
  createValidatingTrpcHarness,
  type DaemonMockHandlers,
} from '@renderer/hooks/trpc-test-harness'
import { useRepoStore } from '@renderer/stores/repo'
import { type RenderResult, render } from '@testing-library/react'
import type { ReactElement } from 'react'

const REPO = reviewContractFixtures.reviewComments.input
const COMMENTS = reviewContractFixtures.reviewComments.output

/** A required canonical comment fixture with a useful failure if the fixture contract drifts. */
export function reviewCommentAt(index: number) {
  const comment = COMMENTS[index]
  if (comment === undefined) throw new Error(`Expected Review comment fixture at index ${index}`)
  return comment
}

/** Default Review comment procedure handlers for presentation tests. */
export function defaultCommentHandlers(overrides: DaemonMockHandlers = {}): DaemonMockHandlers {
  return {
    daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
    reviewComments: () => ({ ok: true, value: [...COMMENTS] }),
    addReviewComment: () => ({ ok: true, value: reviewContractFixtures.addReviewComment.output }),
    editReviewComment: () => ({ ok: true, value: undefined }),
    deleteReviewComment: () => ({ ok: true, value: undefined }),
    resolveReviewComment: () => ({ ok: true, value: undefined }),
    clearResolvedReviewComments: () => ({ ok: true, value: undefined }),
    ...overrides,
  }
}

/** Render a comments surface under the validating tRPC harness with an active Project. */
export function renderComments(
  ui: ReactElement,
  handlers: DaemonMockHandlers = {},
): RenderResult & { mock: ReturnType<typeof createValidatingTrpcHarness>['mock'] } {
  useRepoStore.setState({ repo: { path: REPO, name: 'repo' } })
  const { mock, wrapper: Wrapper } = createValidatingTrpcHarness(defaultCommentHandlers(handlers))
  const result = render(ui, {
    wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
  })
  return { ...result, mock }
}

export { COMMENTS, REPO }

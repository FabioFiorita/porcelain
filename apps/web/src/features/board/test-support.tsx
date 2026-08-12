import { boardContractFixtures } from '@porcelain/contracts/board'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import {
  createValidatingTrpcHarness,
  type DaemonMockHandlers,
} from '@renderer/hooks/trpc-test-harness'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { type RenderResult, render } from '@testing-library/react'
import type { ReactElement } from 'react'

const REPO = boardContractFixtures.listBoardCards.input
const CARDS = boardContractFixtures.listBoardCards.output

/** A required canonical card fixture with a useful failure if the fixture contract drifts. */
export function boardCardAt(index: number) {
  const card = CARDS[index]
  if (card === undefined) throw new Error(`Expected Board card fixture at index ${index}`)
  return card
}

/** Default Board procedure handlers for presentation tests. */
export function defaultBoardHandlers(overrides: DaemonMockHandlers = {}): DaemonMockHandlers {
  return {
    daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
    listBoardCards: () => ({ ok: true, value: [...CARDS] }),
    createBoardCard: () => ({ ok: true, value: boardContractFixtures.createBoardCard.output }),
    updateBoardCard: () => ({ ok: true, value: boardContractFixtures.updateBoardCard.output }),
    moveBoardCard: () => ({ ok: true, value: boardContractFixtures.moveBoardCard.output }),
    deleteBoardCard: () => ({ ok: true, value: boardContractFixtures.deleteBoardCard.output }),
    clearBoardColumn: () => ({ ok: true, value: boardContractFixtures.clearBoardColumn.output }),
    ...overrides,
  }
}

/** Render a Board surface under the validating tRPC harness with an active Project. */
export function renderBoard(
  ui: ReactElement,
  handlers: DaemonMockHandlers = {},
): RenderResult & { mock: ReturnType<typeof createValidatingTrpcHarness>['mock'] } {
  useProjectSelectionStore.setState({ project: { path: REPO, name: 'repo' } })
  const { mock, wrapper: Wrapper } = createValidatingTrpcHarness(defaultBoardHandlers(handlers))
  const result = render(ui, {
    wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
  })
  return { ...result, mock }
}

export { CARDS, REPO }

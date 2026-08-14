import { beforeEach, describe, expect, it } from 'vitest'

import { useActionsSelectionStore } from './actions-selection-store'

describe('actions selection handoff', () => {
  beforeEach(() => {
    useActionsSelectionStore.setState({ selectedActionId: null })
  })

  it('keeps one selected action until the terminal companion consumes it', () => {
    useActionsSelectionStore.getState().selectAction('action-verify')
    expect(useActionsSelectionStore.getState().selectedActionId).toBe('action-verify')

    useActionsSelectionStore.getState().clearSelectedAction()
    expect(useActionsSelectionStore.getState().selectedActionId).toBeNull()
  })
})

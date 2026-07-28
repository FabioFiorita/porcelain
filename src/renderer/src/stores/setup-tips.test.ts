import { beforeEach, describe, expect, it } from 'vitest'
import { useSetupTipsStore } from './setup-tips'

describe('setup-tips store', () => {
  beforeEach(() => {
    useSetupTipsStore.setState({ dismissed: {} })
  })

  it('dismisses per repo and tip', () => {
    expect(useSetupTipsStore.getState().isDismissed('/a', 'layers-kickoff')).toBe(false)
    useSetupTipsStore.getState().dismiss('/a', 'layers-kickoff')
    expect(useSetupTipsStore.getState().isDismissed('/a', 'layers-kickoff')).toBe(true)
    expect(useSetupTipsStore.getState().isDismissed('/a', 'scope-kickoff')).toBe(false)
    expect(useSetupTipsStore.getState().isDismissed('/b', 'layers-kickoff')).toBe(false)
  })
})

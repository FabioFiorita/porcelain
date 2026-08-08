import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const expoMocks = vi.hoisted(() => ({
  requireNativeView: vi.fn(),
  requireOptionalNativeModule: vi.fn(),
}))
const nativeView = () => null
const originalExpo = globalThis.expo

function installViewConfig(): void {
  Reflect.set(globalThis, 'expo', {
    getViewConfig: vi.fn().mockReturnValue({ directEventTypes: {}, validAttributes: {} }),
  })
}

vi.mock('expo', () => expoMocks)

describe('resolvePorcelainTerminalNativeView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    Reflect.set(globalThis, 'expo', undefined)
  })

  afterEach(() => {
    Reflect.set(globalThis, 'expo', originalExpo)
  })

  it('does not require a missing native view from an older OTA binary', async () => {
    const { resolvePorcelainTerminalNativeView } = await import('./porcelain-terminal-native')

    expect(resolvePorcelainTerminalNativeView()).toBeNull()
    expect(expoMocks.requireNativeView).not.toHaveBeenCalled()
  })

  it('resolves the Porcelain native view after the module is installed', async () => {
    installViewConfig()
    expoMocks.requireNativeView.mockReturnValue(nativeView)
    const { resolvePorcelainTerminalNativeView } = await import('./porcelain-terminal-native')

    expect(resolvePorcelainTerminalNativeView()).toBe(nativeView)
    expect(expoMocks.requireNativeView).toHaveBeenCalledWith('PorcelainTerminalSurface')
  })
})

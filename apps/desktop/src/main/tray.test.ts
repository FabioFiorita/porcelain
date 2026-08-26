import { describe, expect, it } from 'vitest'
import { shouldInstallTray } from './tray-policy'

describe('desktop tray policy', () => {
  it('does not install a menu-bar icon on macOS', () => {
    expect(shouldInstallTray('darwin')).toBe(false)
    expect(shouldInstallTray('linux')).toBe(true)
    expect(shouldInstallTray('win32')).toBe(true)
  })
})

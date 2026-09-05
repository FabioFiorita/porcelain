import { formatForDisplay, matchesKeyboardEvent } from '@tanstack/react-hotkeys'
import { describe, expect, it } from 'vitest'
import { bindingConflict, fileBinding } from './file-command-bindings'

describe('Files bindings', () => {
  it('keeps disabled bindings disabled and defaults independent of overrides', () => {
    expect(fileBinding('files.create-file', {})).toBe('Mod+N')
    expect(fileBinding('files.create-file', { 'files.create-file': null })).toBeNull()
  })
  it('rejects equivalent bindings and keys owned by other commands', () => {
    expect(bindingConflict('files.create-folder', 'Control+N', {})).toBe('Create file')
    expect(bindingConflict('files.create-file', 'Mod+K', {})).toBe('another app command')
    expect(bindingConflict('files.create-file', 'Mod+Shift+Y', {})).toBeNull()
  })
  it('formats portable bindings for both platforms', () => {
    expect(formatForDisplay('Mod+N', { platform: 'windows' })).toBe('Ctrl+N')
    expect(formatForDisplay('Mod+N', { platform: 'mac' })).toContain('⌘')
  })
  it('matches only the primary modifier on each platform', () => {
    const control = new KeyboardEvent('keydown', { key: 'n', ctrlKey: true })
    const command = new KeyboardEvent('keydown', { key: 'n', metaKey: true })
    expect(matchesKeyboardEvent(control, 'Mod+N', 'windows')).toBe(true)
    expect(matchesKeyboardEvent(command, 'Mod+N', 'windows')).toBe(false)
    expect(matchesKeyboardEvent(command, 'Mod+N', 'mac')).toBe(true)
    expect(matchesKeyboardEvent(control, 'Mod+N', 'mac')).toBe(false)
  })
})

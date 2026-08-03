import { describe, expect, it } from 'vitest'

import { disclosureSymbol, fileSymbol, folderSymbol } from '@/theme/file-icons'

describe('fileSymbol', () => {
  it('gives TypeScript and JavaScript the two renderer hues', () => {
    expect(fileSymbol('daemon.ts', 'dark').tint).toBe('#51A2FF')
    expect(fileSymbol('daemon.js', 'dark').tint).toBe('#FDC700')
  })

  it('reads the extension case-insensitively', () => {
    expect(fileSymbol('Icon.PNG', 'light')).toEqual(fileSymbol('icon.png', 'light'))
  })

  it('marks tests by name, whatever the language', () => {
    const spec = fileSymbol('diff-rows.test.ts', 'dark')
    expect(spec.name).toBe('testtube.2')
    expect(spec.name).not.toBe(fileSymbol('diff-rows.ts', 'dark').name)
  })

  it('falls back to a plain document for an unknown extension', () => {
    expect(fileSymbol('LICENSE', 'dark').name).toBe('doc')
    expect(fileSymbol('archive.zzz', 'dark').name).toBe('doc')
  })

  it('tracks the appearance', () => {
    expect(fileSymbol('daemon.ts', 'light').tint).not.toBe(fileSymbol('daemon.ts', 'dark').tint)
  })
})

describe('folderSymbol', () => {
  it('opens and closes', () => {
    expect(folderSymbol(true, 'dark').name).toBe('folder.fill')
    expect(folderSymbol(false, 'dark').name).toBe('folder')
  })
})

describe('disclosureSymbol', () => {
  it('points down only when open', () => {
    expect(disclosureSymbol(true, 'dark').name).toBe('chevron.down')
    expect(disclosureSymbol(false, 'dark').name).toBe('chevron.right')
  })
})

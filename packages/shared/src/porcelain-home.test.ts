import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { porcelainHome, porcelainHomePath } from './porcelain-home'

describe('porcelainHome', () => {
  const prevHome = process.env.PORCELAIN_HOME

  afterEach(() => {
    if (prevHome === undefined) delete process.env.PORCELAIN_HOME
    else process.env.PORCELAIN_HOME = prevHome
  })

  it('defaults to ~/.porcelain', () => {
    delete process.env.PORCELAIN_HOME
    expect(porcelainHome()).toBe(join(homedir(), '.porcelain'))
    expect(porcelainHomePath('board.json')).toBe(join(homedir(), '.porcelain', 'board.json'))
  })

  it('honours PORCELAIN_HOME for the dev stack', () => {
    const home = join(homedir(), 'porcelain-dev-test')
    process.env.PORCELAIN_HOME = home
    expect(porcelainHome()).toBe(home)
    expect(porcelainHomePath('admin-token')).toBe(join(home, 'admin-token'))
  })
})

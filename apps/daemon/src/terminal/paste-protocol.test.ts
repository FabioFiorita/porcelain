import {
  MAX_TERMINAL_WRITE_CODE_UNITS,
  terminalFilePromptReference,
  terminalImagePromptReference,
  terminalInputFrameSchema,
} from '@porcelain/contracts/terminal'
import { describe, expect, it } from 'vitest'

describe('terminal image paste protocol', () => {
  it('accepts upload-only image requests while preserving immediate paste by default', () => {
    const base = {
      dataBase64: 'YWJj',
      id: 'terminal-1',
      mime: 'image/png' as const,
      reqId: 'request-1',
      t: 'terminal:paste-image' as const,
    }

    expect(terminalInputFrameSchema.parse(base)).not.toHaveProperty('insert')
    expect(terminalInputFrameSchema.parse({ ...base, insert: false })).toMatchObject({
      insert: false,
    })
  })

  it('quotes paths with spaces exactly once for a combined composer write', () => {
    expect(terminalImagePromptReference('/daemon/pastes/with space.png')).toBe(
      'Analyze this image: "/daemon/pastes/with space.png" ',
    )
  })

  it('accepts a bounded generic file without trusting a client-local path', () => {
    expect(
      terminalInputFrameSchema.parse({
        dataBase64: 'YWJj',
        filename: '../../a report.pdf',
        id: 'terminal-1',
        mime: 'application/pdf',
        reqId: 'request-2',
        t: 'terminal:paste-file',
      }),
    ).toMatchObject({ filename: '../../a report.pdf', t: 'terminal:paste-file' })
    expect(terminalFilePromptReference('/daemon/pastes/a report.pdf')).toBe(
      'Analyze this file: "/daemon/pastes/a report.pdf" ',
    )
  })

  it('bounds interactive writes at the shared write cap', () => {
    expect(MAX_TERMINAL_WRITE_CODE_UNITS).toBe(65_536)
  })
})

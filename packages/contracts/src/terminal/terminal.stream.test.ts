import { describe, expect, it } from 'vitest'
import {
  MAX_PASTE_FILE_BASE64_CODE_UNITS,
  MAX_PASTE_FILE_BYTES,
  MAX_PASTE_FILENAME_CODE_UNITS,
  MAX_PASTE_MIME_CODE_UNITS,
  MAX_SESSION_MESSAGE_BYTES,
  MAX_TERMINAL_SCROLLBACK_CODE_UNITS,
  MAX_TERMINAL_WRITE_CODE_UNITS,
  PASTE_RESULTS,
  terminalClientFrameSchema,
  terminalInputFrameSchema,
  terminalLifecycleFrameSchema,
  terminalOutputFrameSchema,
  terminalServerFrameSchema,
  terminalStreamFixtures,
} from './terminal.stream'

const EMPTY_ID = ''
const FOUND_FIELD = 'found'

/**
 * Caps are self-owned by this module. Literals below are the wire contract; they are not
 * mirrored from a second horizontal protocol file.
 */
describe('Terminal stream caps', () => {
  it('owns every current cap exactly', () => {
    expect(MAX_TERMINAL_WRITE_CODE_UNITS).toBe(65_536)
    expect(MAX_SESSION_MESSAGE_BYTES).toBe(12 * 1024 * 1024)
    expect(MAX_PASTE_FILE_BYTES).toBe(8_388_608)
    expect(MAX_TERMINAL_SCROLLBACK_CODE_UNITS).toBe(64 * 1024)
    expect(MAX_PASTE_FILE_BASE64_CODE_UNITS).toBe(11_184_812)
    expect(MAX_PASTE_FILENAME_CODE_UNITS).toBe(255)
    expect(MAX_PASTE_MIME_CODE_UNITS).toBe(255)
  })

  it('bounds one PTY write at the current write cap', () => {
    const atCap = {
      t: 'terminal:write',
      reqId: 'req-cap',
      id: 'term-1',
      data: 'x'.repeat(MAX_TERMINAL_WRITE_CODE_UNITS),
    }
    expect(terminalInputFrameSchema.safeParse(atCap).success).toBe(true)
    expect(
      terminalInputFrameSchema.safeParse({
        ...atCap,
        data: 'x'.repeat(MAX_TERMINAL_WRITE_CODE_UNITS + 1),
      }).success,
    ).toBe(false)
  })

  it('leaves PTY output bounded only by the buffered frame cap', () => {
    const burst = {
      t: 'terminal:data',
      id: 'term-1',
      data: 'y'.repeat(MAX_TERMINAL_WRITE_CODE_UNITS + 1),
      epoch: 'epoch-1',
      sequence: 1,
    }
    expect(terminalOutputFrameSchema.safeParse(burst).success).toBe(true)
  })

  it('keeps the encoded paste backstop above its decoded cap', () => {
    expect(MAX_PASTE_FILE_BASE64_CODE_UNITS).toBeGreaterThan(MAX_PASTE_FILE_BYTES)
    expect(
      terminalInputFrameSchema.safeParse({
        ...terminalStreamFixtures.input.pasteFile,
        dataBase64: 'a'.repeat(MAX_PASTE_FILE_BASE64_CODE_UNITS + 1),
      }).success,
    ).toBe(false)
  })
})

describe('Terminal lifecycle frames', () => {
  for (const [name, fixture] of Object.entries(terminalStreamFixtures.lifecycle)) {
    it(`accepts the ${name} frame`, () => {
      expect(terminalLifecycleFrameSchema.parse(fixture)).toEqual(fixture)
    })

    it(`rejects the ${name} frame with an unknown field`, () => {
      expect(terminalLifecycleFrameSchema.safeParse({ ...fixture, extra: 1 }).success).toBe(false)
    })
  }

  it('uses a correlated error instead of an attach found sentinel', () => {
    const missing = {
      t: 'terminal:attached',
      reqId: 'req-2',
      id: 'term-gone',
      scrollback: '',
      status: 'exited',
      epoch: 'epoch-2',
      sequence: 0,
    }
    expect(terminalLifecycleFrameSchema.parse(missing)).toEqual(missing)
    expect(terminalLifecycleFrameSchema.parse({ ...missing, exitCode: 1 })).toHaveProperty(
      'exitCode',
      1,
    )
    expect(
      terminalLifecycleFrameSchema.safeParse({ ...missing, [FOUND_FIELD]: false }).success,
    ).toBe(false)
    expect(terminalLifecycleFrameSchema.safeParse({ ...missing, status: 'unknown' }).success).toBe(
      false,
    )
  })

  it('requires a non-empty id for a successful create reply', () => {
    const refused = { t: 'terminal:created', reqId: 'req-1', id: EMPTY_ID }
    expect(terminalLifecycleFrameSchema.safeParse(refused).success).toBe(false)
  })

  it('requires non-empty correlation ids on every command', () => {
    const commands = [
      terminalStreamFixtures.lifecycle.create,
      terminalStreamFixtures.lifecycle.attach,
      terminalStreamFixtures.lifecycle.detach,
      terminalStreamFixtures.lifecycle.resize,
      terminalStreamFixtures.lifecycle.kill,
      terminalStreamFixtures.input.write,
      terminalStreamFixtures.input.pasteFile,
    ]
    for (const command of commands) {
      const schema =
        't' in command && ['terminal:paste-file', 'terminal:write'].includes(command.t)
          ? terminalInputFrameSchema
          : terminalLifecycleFrameSchema
      expect(schema.safeParse({ ...command, reqId: '' }).success).toBe(false)
      expect(schema.safeParse({ ...command, reqId: undefined }).success).toBe(false)
    }
  })

  it('bounds scrollback and requires the attachment ordering baseline', () => {
    const attached = terminalStreamFixtures.lifecycle.attached
    expect(
      terminalLifecycleFrameSchema.safeParse({
        ...attached,
        scrollback: 'x'.repeat(MAX_TERMINAL_SCROLLBACK_CODE_UNITS),
      }).success,
    ).toBe(true)
    expect(
      terminalLifecycleFrameSchema.safeParse({
        ...attached,
        scrollback: 'x'.repeat(MAX_TERMINAL_SCROLLBACK_CODE_UNITS + 1),
      }).success,
    ).toBe(false)
    expect(terminalLifecycleFrameSchema.safeParse({ ...attached, epoch: '' }).success).toBe(false)
    expect(terminalLifecycleFrameSchema.safeParse({ ...attached, sequence: -1 }).success).toBe(
      false,
    )
  })

  it('rejects a non-integer or non-positive create geometry', () => {
    expect(
      terminalLifecycleFrameSchema.safeParse({
        ...terminalStreamFixtures.lifecycle.create,
        cols: 0,
      }).success,
    ).toBe(false)
    expect(
      terminalLifecycleFrameSchema.safeParse({
        ...terminalStreamFixtures.lifecycle.create,
        rows: 40.5,
      }).success,
    ).toBe(false)
  })

  it('requires epoch and nonnegative sequence on output and exit frames', () => {
    expect(
      terminalOutputFrameSchema.safeParse({
        ...terminalStreamFixtures.output.data,
        epoch: '',
      }).success,
    ).toBe(false)
    expect(
      terminalOutputFrameSchema.safeParse({
        ...terminalStreamFixtures.output.data,
        sequence: -1,
      }).success,
    ).toBe(false)
    expect(
      terminalLifecycleFrameSchema.safeParse({
        ...terminalStreamFixtures.lifecycle.exit,
        sequence: 1.5,
      }).success,
    ).toBe(false)
  })
})

describe('Terminal output frames', () => {
  it('accepts the data frame and nothing else', () => {
    expect(terminalOutputFrameSchema.parse(terminalStreamFixtures.output.data)).toEqual(
      terminalStreamFixtures.output.data,
    )
    expect(terminalOutputFrameSchema.safeParse(terminalStreamFixtures.lifecycle.exit).success).toBe(
      false,
    )
  })
})

describe('Terminal input frames', () => {
  for (const [name, fixture] of Object.entries(terminalStreamFixtures.input)) {
    it(`accepts the ${name} frame`, () => {
      expect(terminalInputFrameSchema.parse(fixture)).toEqual(fixture)
    })

    it(`rejects the ${name} frame with an unknown field`, () => {
      expect(terminalInputFrameSchema.safeParse({ ...fixture, extra: 1 }).success).toBe(false)
    })
  }

  it('accepts the current paste result and no others', () => {
    expect([...PASTE_RESULTS]).toEqual(['ok'])
    expect(
      terminalInputFrameSchema.safeParse({
        ...terminalStreamFixtures.input.pasteFile,
        result: 'unknown',
      }).success,
    ).toBe(false)
  })

  it('bounds an attachment display name the way the daemon does', () => {
    expect(
      terminalInputFrameSchema.safeParse({
        ...terminalStreamFixtures.input.pasteFile,
        filename: '',
      }).success,
    ).toBe(false)
    expect(
      terminalInputFrameSchema.safeParse({
        ...terminalStreamFixtures.input.pasteFile,
        filename: 'n'.repeat(MAX_PASTE_FILENAME_CODE_UNITS + 1),
      }).success,
    ).toBe(false)
    expect(
      terminalInputFrameSchema.safeParse({
        ...terminalStreamFixtures.input.pasteFile,
        mime: 'm'.repeat(MAX_PASTE_MIME_CODE_UNITS + 1),
      }).success,
    ).toBe(false)
  })

  it('treats insert as an optional upload-without-prompt flag', () => {
    expect(
      terminalInputFrameSchema.parse({
        ...terminalStreamFixtures.input.pasteFile,
        insert: false,
      }),
    ).toHaveProperty('insert', false)
    expect(
      terminalInputFrameSchema.parse(terminalStreamFixtures.input.pasteFile),
    ).not.toHaveProperty('insert')
  })
})

describe('Terminal client frames', () => {
  it('accepts commands only, excluding daemon replies and output', () => {
    const commands = [
      terminalStreamFixtures.lifecycle.create,
      terminalStreamFixtures.lifecycle.attach,
      terminalStreamFixtures.lifecycle.detach,
      terminalStreamFixtures.lifecycle.resize,
      terminalStreamFixtures.lifecycle.kill,
      terminalStreamFixtures.input.write,
      terminalStreamFixtures.input.pasteFile,
    ]
    for (const command of commands) {
      expect(terminalClientFrameSchema.parse(command)).toEqual(command)
    }

    for (const serverFrame of [
      terminalStreamFixtures.lifecycle.created,
      terminalStreamFixtures.lifecycle.attached,
      terminalStreamFixtures.output.data,
      terminalStreamFixtures.error,
    ]) {
      expect(terminalClientFrameSchema.safeParse(serverFrame).success).toBe(false)
    }
  })
})

describe('Terminal server frames', () => {
  it('accepts every strict daemon event and expected error', () => {
    const frames = [
      terminalStreamFixtures.lifecycle.created,
      terminalStreamFixtures.lifecycle.attached,
      terminalStreamFixtures.output.data,
      terminalStreamFixtures.lifecycle.exit,
      terminalStreamFixtures.input.filePasted,
      terminalStreamFixtures.error,
    ]
    for (const frame of frames) {
      expect(terminalServerFrameSchema.parse(frame)).toEqual(frame)
      expect(terminalServerFrameSchema.safeParse({ ...frame, extra: true }).success).toBe(false)
    }
  })

  it('keeps Terminal errors inside the common public error vocabulary', () => {
    expect(
      terminalServerFrameSchema.safeParse({
        ...terminalStreamFixtures.error,
        error: { ...terminalStreamFixtures.error.error, code: 'request.invalid' },
      }).success,
    ).toBe(false)
    expect(
      terminalServerFrameSchema.safeParse({
        ...terminalStreamFixtures.error,
        reqId: '',
      }).success,
    ).toBe(false)
  })
})

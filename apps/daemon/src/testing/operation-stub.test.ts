// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createDeferredOperationStub } from './operation-stub'

describe('createDeferredOperationStub', () => {
  it('records a deep-frozen structuredClone so later input mutation does not affect the snapshot', async () => {
    const stub = createDeferredOperationStub<{ nested: { n: number }; tags: string[] }, string>()
    const input = { nested: { n: 1 }, tags: ['a'] }

    const pending = stub.operation(input)
    expect(stub.calls).toHaveLength(1)
    expect(stub.calls[0]?.input).toEqual(input)
    expect(stub.calls[0]?.input).not.toBe(input)
    expect(stub.calls[0]?.input.nested).not.toBe(input.nested)
    expect(Object.isFrozen(stub.calls[0]?.input)).toBe(true)
    expect(Object.isFrozen(stub.calls[0]?.input.nested)).toBe(true)
    expect(Object.isFrozen(stub.calls[0]?.input.tags)).toBe(true)

    input.nested.n = 99
    input.tags.push('b')
    expect(stub.calls[0]?.input).toEqual({ nested: { n: 1 }, tags: ['a'] })
    expect(() => {
      const recorded = stub.calls[0]
      if (recorded === undefined) throw new Error('missing call')
      recorded.input.nested.n = 2
    }).toThrow()

    stub.resolve('ok')
    await expect(pending).resolves.toBe('ok')
  })

  it('resolves the pending operation with the supplied value', async () => {
    const stub = createDeferredOperationStub<number, { id: string }>()
    const pending = stub.operation(7)
    stub.resolve({ id: 'card-1' })
    await expect(pending).resolves.toEqual({ id: 'card-1' })
    expect(stub.calls).toEqual([{ input: 7 }])
  })

  it('rejects with the exact Error instance supplied', async () => {
    const stub = createDeferredOperationStub<string, void>()
    const pending = stub.operation('x')
    const error = new Error('board store failed')
    stub.reject(error)
    await expect(pending).rejects.toBe(error)
  })

  it('throws when resolve or reject is called without a pending call', () => {
    const stub = createDeferredOperationStub<void, void>()
    expect(() => stub.resolve(undefined)).toThrow('OperationFake has no pending call to resolve')
    expect(() => stub.reject(new Error('nope'))).toThrow(
      'OperationFake has no pending call to reject',
    )
  })

  it('rejects a second outstanding call until the first is settled', async () => {
    const stub = createDeferredOperationStub<string, string>()
    const first = stub.operation('one')
    expect(() => stub.operation('two')).toThrow(
      'OperationFake may serve one pending call at a time',
    )
    expect(stub.calls).toHaveLength(1)

    stub.resolve('done')
    await expect(first).resolves.toBe('done')

    const second = stub.operation('two')
    stub.resolve('again')
    await expect(second).resolves.toBe('again')
    expect(stub.calls.map((call) => call.input)).toEqual(['one', 'two'])
  })
})

import { describe, expect, it } from 'vitest'

import {
  environmentsFileSchema,
  hostOf,
  isPaired,
  normalizeBaseUrl,
  parseEnvironmentsFile,
  projectNameOf,
} from './remote-environment'

const LAN = 'http://192.168.1.50:43117'
const FUNNEL = 'https://beelink.example.ts.net'

const RECORD = {
  id: '3f2a1c88-0f4d-4b6e-9a11-2c7d5e8b0a34',
  icon: 'desktop' as const,
  nickname: 'studio',
  baseUrl: LAN,
  endpoints: [LAN],
  preferredEndpoint: LAN,
  createdAt: 1_700_000_000_000,
  activeRepoPath: '/synthetic/repo',
}

describe('parseEnvironmentsFile', () => {
  it('round-trips a strict version-1 index', () => {
    const file = { version: 1 as const, activeId: RECORD.id, environments: [RECORD] }

    expect(parseEnvironmentsFile(JSON.stringify(file))).toEqual({
      status: 'ok',
      file: environmentsFileSchema.parse(file),
    })
    expect(environmentsFileSchema.parse(file).environments[0]?.icon).toBe('desktop')
  })

  it('treats version 3, a box icon, and an omitted icon as corrupt', () => {
    expect(
      parseEnvironmentsFile(
        JSON.stringify({ version: 3, activeId: RECORD.id, environments: [RECORD] }),
      ),
    ).toEqual({ status: 'corrupt' })
    expect(
      parseEnvironmentsFile(
        JSON.stringify({
          version: 1,
          activeId: RECORD.id,
          environments: [{ ...RECORD, icon: 'box' }],
        }),
      ),
    ).toEqual({ status: 'corrupt' })
    const { icon: _icon, ...withoutIcon } = RECORD
    expect(
      parseEnvironmentsFile(
        JSON.stringify({ version: 1, activeId: RECORD.id, environments: [withoutIcon] }),
      ),
    ).toEqual({ status: 'corrupt' })
  })

  it('treats an incomplete version-1 record as corrupt', () => {
    expect(
      parseEnvironmentsFile(
        JSON.stringify({ version: 1, activeId: null, environments: [{ id: 'x' }] }),
      ),
    ).toEqual({ status: 'corrupt' })
  })

  it('reads a device that has never paired as empty, not corrupt', () => {
    expect(parseEnvironmentsFile(null)).toEqual({ status: 'empty' })
    expect(parseEnvironmentsFile('  ')).toEqual({ status: 'empty' })
  })

  it('reports unreadable storage as corrupt', () => {
    expect(parseEnvironmentsFile('{not json')).toEqual({ status: 'corrupt' })
    expect(parseEnvironmentsFile('{"version":2,"activeId":null,"environments":[]}')).toEqual({
      status: 'corrupt',
    })
  })

  it('rejects a record whose baseUrl is not a url', () => {
    const file = { version: 1, activeId: null, environments: [{ ...RECORD, baseUrl: 'not-a-url' }] }

    expect(parseEnvironmentsFile(JSON.stringify(file))).toEqual({ status: 'corrupt' })
  })

  it('never returns a coerced icon', () => {
    const missing = parseEnvironmentsFile(
      JSON.stringify({
        version: 1,
        activeId: RECORD.id,
        environments: [{ ...RECORD, icon: undefined }],
      }),
    )
    expect(missing).toEqual({ status: 'corrupt' })
    const boxed = parseEnvironmentsFile(
      JSON.stringify({
        version: 1,
        activeId: RECORD.id,
        environments: [{ ...RECORD, icon: 'box' }],
      }),
    )
    expect(boxed).toEqual({ status: 'corrupt' })
  })
})

describe('isPaired', () => {
  it('rejects an environment whose token was revoked', () => {
    expect(isPaired({ ...RECORD, token: null })).toBe(false)
    expect(isPaired(null)).toBe(false)
    expect(isPaired({ ...RECORD, token: 'pc_client_x' })).toBe(true)
  })
})

describe('projectNameOf', () => {
  it('reads the last segment of a daemon path', () => {
    expect(projectNameOf('/synthetic/repo')).toBe('repo')
    expect(projectNameOf('/synthetic/repo/')).toBe('repo')
    expect(projectNameOf('repo')).toBe('repo')
  })
})

describe('normalizeBaseUrl', () => {
  it('stores one form of an origin', () => {
    expect(normalizeBaseUrl(`  ${LAN.toUpperCase()}/ `)).toBe(LAN)
  })
})

describe('hostOf', () => {
  it('drops the scheme and the port for a default nickname', () => {
    expect(hostOf(LAN)).toBe('192.168.1.50')
    expect(hostOf(FUNNEL)).toBe('beelink.example.ts.net')
  })
})

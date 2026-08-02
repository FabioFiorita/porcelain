import { endpointKind, orderedEndpointUrls } from '@porcelain/contracts'
import { describe, expect, it } from 'vitest'

import {
  environmentsFileSchema,
  hostOf,
  isPaired,
  normalizeBaseUrl,
  parseEnvironmentsFile,
  repoNameOf,
} from './environment'

const RECORD = {
  id: '3f2a1c88-0f4d-4b6e-9a11-2c7d5e8b0a34',
  icon: 'desktop' as const,
  nickname: 'beelink',
  baseUrl: 'http://beelink.local:43117',
  endpoints: ['http://beelink.local:43117'],
  preferredEndpoint: 'http://beelink.local:43117',
  createdAt: 1_700_000_000_000,
  activeRepoPath: '/home/you/code/my-app',
}

const LAN = 'http://192.168.1.50:43117'
const FUNNEL = 'https://beelink.example.ts.net'

describe('environment group route ordering', () => {
  it('recognizes local hostnames as LAN and direct MagicDNS as tailnet', () => {
    expect(endpointKind('http://beelink.local:43117')).toBe('lan')
    expect(endpointKind('http://beelink.tail1234.ts.net:43117')).toBe('tailnet')
  })

  it('recognizes Funnel as the fallback route class', () => {
    expect(endpointKind(FUNNEL)).toBe('other')
  })

  it('tries the exact preferred route before the last-known-good Funnel route', () => {
    expect(
      orderedEndpointUrls({
        endpoints: [LAN, FUNNEL],
        preferredEndpoint: LAN,
        url: FUNNEL,
      }),
    ).toEqual([LAN, FUNNEL])
  })
})

describe('parseEnvironmentsFile', () => {
  it('round-trips the stored index', () => {
    const file = { version: 3, activeId: RECORD.id, environments: [RECORD] }

    expect(parseEnvironmentsFile(JSON.stringify(file))).toEqual({
      status: 'ok',
      file: environmentsFileSchema.parse(file),
    })
  })

  it('defaults the icon for groups saved before icon selection existed', () => {
    const legacy = { ...RECORD, icon: undefined }
    const file = { version: 3, activeId: RECORD.id, environments: [legacy] }

    expect(parseEnvironmentsFile(JSON.stringify(file))).toEqual({
      status: 'ok',
      file: environmentsFileSchema.parse(file),
    })
    expect(environmentsFileSchema.parse(file).environments[0]?.icon).toBe('desktop')
  })

  it('normalizes the removed box icon in stored groups', () => {
    const file = { version: 3, activeId: RECORD.id, environments: [{ ...RECORD, icon: 'box' }] }

    expect(parseEnvironmentsFile(JSON.stringify(file))).toEqual({
      status: 'ok',
      file: environmentsFileSchema.parse(file),
    })
    expect(environmentsFileSchema.parse(file).environments[0]?.icon).toBe('desktop')
  })

  it('requires the endpoint list that defines an environment group', () => {
    const file = {
      version: 3,
      activeId: RECORD.id,
      environments: [{ ...RECORD, endpoints: undefined }],
    }

    expect(parseEnvironmentsFile(JSON.stringify(file))).toEqual({ status: 'corrupt' })
  })

  it('reads a device that has never paired as empty, not corrupt', () => {
    expect(parseEnvironmentsFile(null)).toEqual({ status: 'empty' })
    expect(parseEnvironmentsFile('  ')).toEqual({ status: 'empty' })
  })

  // Corrupt is NOT empty: the caller keeps the blob and says so, because dropping a paired
  // credential silently looks exactly like never having paired.
  it('reports unreadable storage as corrupt', () => {
    expect(parseEnvironmentsFile('{not json')).toEqual({ status: 'corrupt' })
    expect(parseEnvironmentsFile('{"version":1,"activeId":null,"environments":[]}')).toEqual({
      status: 'corrupt',
    })
    expect(
      parseEnvironmentsFile(
        JSON.stringify({ version: 3, activeId: null, environments: [{ id: 'x' }] }),
      ),
    ).toEqual({ status: 'corrupt' })
  })

  it('rejects a record whose baseUrl is not a url', () => {
    const file = { version: 3, activeId: null, environments: [{ ...RECORD, baseUrl: 'beelink' }] }

    expect(parseEnvironmentsFile(JSON.stringify(file))).toEqual({ status: 'corrupt' })
  })
})

describe('isPaired', () => {
  // A revoked environment survives so the app can name it — nothing may be called against it.
  it('rejects an environment whose token was revoked', () => {
    expect(isPaired({ ...RECORD, token: null })).toBe(false)
    expect(isPaired(null)).toBe(false)
    expect(isPaired({ ...RECORD, token: 'pc_client_x' })).toBe(true)
  })
})

describe('repoNameOf', () => {
  it('reads the last segment of a daemon path', () => {
    expect(repoNameOf('/home/you/code/my-app')).toBe('my-app')
    expect(repoNameOf('/home/you/code/my-app/')).toBe('my-app')
    expect(repoNameOf('my-app')).toBe('my-app')
  })
})

describe('normalizeBaseUrl', () => {
  it('stores one form of an origin', () => {
    expect(normalizeBaseUrl('  HTTP://Beelink.local:43117/ ')).toBe('http://beelink.local:43117')
  })
})

describe('hostOf', () => {
  it('drops the scheme and the port for a default nickname', () => {
    expect(hostOf('http://beelink.local:43117')).toBe('beelink.local')
    expect(hostOf('https://box.tail1234.ts.net')).toBe('box.tail1234.ts.net')
  })
})

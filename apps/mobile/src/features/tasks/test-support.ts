import type { Environment } from '@/features/remote'

/**
 * Mobile Tasks test support.
 *
 * The board fans `listTasks` out over every PAIRED Environment, so the fixtures a Tasks test
 * needs are pairing records rather than a Hub inventory: two reachable daemons, and one whose
 * token was revoked and must never be called.
 */

export const STUDIO_ID = 'env-studio'
export const LAPTOP_ID = 'env-laptop'
export const REVOKED_ID = 'env-revoked'

function environment(id: string, nickname: string, token: string | null): Environment {
  return {
    activeRepoPath: null,
    baseUrl: `https://${id}.invalid`,
    createdAt: 0,
    endpoints: [`https://${id}.invalid`],
    icon: 'desktop',
    id,
    nickname,
    preferredEndpoint: `https://${id}.invalid`,
    token,
  }
}

export const STUDIO = environment(STUDIO_ID, 'Studio', 'paired')
export const LAPTOP = environment(LAPTOP_ID, 'Laptop', 'paired')
export const REVOKED = environment(REVOKED_ID, 'Revoked', null)

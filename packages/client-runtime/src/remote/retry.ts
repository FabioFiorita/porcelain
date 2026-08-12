import { nextRetryDelay, reconnectDelayMs } from '../session/transport'

export const REMOTE_MIN_RETRY_MS = 500
export const REMOTE_MAX_RETRY_MS = 10_000

export type RemoteRetryStep = {
  readonly delayMs: number
  readonly waitMs: number
}

export function resetRemoteRetry(): number {
  return REMOTE_MIN_RETRY_MS
}

export function nextRemoteRetry(currentMs: number, random: () => number): RemoteRetryStep {
  return {
    waitMs: reconnectDelayMs(currentMs, random),
    delayMs: nextRetryDelay(currentMs, REMOTE_MAX_RETRY_MS),
  }
}

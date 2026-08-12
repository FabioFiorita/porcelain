export type RemoteSessionHealth =
  | 'idle'
  | 'connecting'
  | 'healthy'
  | 'recovering'
  | 'unavailable'
  | 'update-required'

export type RemoteSessionOutcome =
  | { readonly type: 'start' }
  | { readonly type: 'stop' }
  | { readonly type: 'connected' }
  | { readonly type: 'disconnected' }
  | { readonly type: 'walk-exhausted' }
  | { readonly type: 'update-required' }

export type SessionHealth = {
  readonly apply: (outcome: RemoteSessionOutcome) => RemoteSessionHealth
  readonly status: () => RemoteSessionHealth
  readonly everConnected: () => boolean
}

export function createSessionHealth(): SessionHealth {
  let status: RemoteSessionHealth = 'idle'
  let everConnected = false

  return {
    apply(outcome) {
      if (status === 'update-required') return status

      switch (outcome.type) {
        case 'start':
          if (status === 'idle' || status === 'unavailable') status = 'connecting'
          return status
        case 'stop':
          status = 'idle'
          return status
        case 'connected':
          if (status === 'connecting' || status === 'recovering' || status === 'unavailable') {
            everConnected = true
            status = 'healthy'
          }
          return status
        case 'disconnected':
          if (status === 'healthy' || status === 'recovering') status = 'recovering'
          return status
        case 'walk-exhausted':
          if (status !== 'idle') status = 'unavailable'
          return status
        case 'update-required':
          status = 'update-required'
          return status
      }
    },
    status() {
      return status
    },
    everConnected() {
      return everConnected
    },
  }
}

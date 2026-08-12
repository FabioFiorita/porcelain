import { runUserAction } from '@porcelain/shared/background'
import { useState } from 'react'
import { Alert } from 'react-native'
import {
  addGroupConnection,
  describePairProblem,
  type Environment,
  type EnvironmentId,
  environmentActions,
  getEnvironment,
  pairNewGroup,
} from '@/features/remote'
import { movedOrder, promotedOrder } from './environment-labels'

/**
 * The environments panel's state, kept out of its markup.
 *
 * The panel is four screens in one section — list, create, detail, add-connection — and each
 * one used to own its own `useState` pile inline, which is how an 850-line file with no test
 * happens. The screens below are markup over these controllers; what they *say* and the endpoint
 * orders they write live in `environment-labels.ts`, asserted without a runtime.
 */

export type EnvRoute =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'detail'; id: EnvironmentId }
  | { kind: 'add-connection'; id: EnvironmentId }

export type EnvironmentsNavigation = {
  route: EnvRoute
  toList: () => void
  toCreate: () => void
  toDetail: (id: EnvironmentId) => void
  toAddConnection: (id: EnvironmentId) => void
}

/** Which of the four screens the section is showing. Local to the panel — no router involved. */
export function useEnvironmentsNavigation(): EnvironmentsNavigation {
  const [route, setRoute] = useState<EnvRoute>({ kind: 'list' })

  return {
    route,
    toAddConnection: (id) => {
      setRoute({ id, kind: 'add-connection' })
    },
    toCreate: () => {
      setRoute({ kind: 'create' })
    },
    toDetail: (id) => {
      setRoute({ id, kind: 'detail' })
    },
    toList: () => {
      setRoute({ kind: 'list' })
    },
  }
}

export type PairForm = {
  link: string
  setLink: (link: string) => void
  busy: boolean
  error: string | null
  /** True while there is nothing to submit — the disabled-submit rule every form here shares. */
  empty: boolean
  /** Total void action: catches, clears busy in finally, routes failure to `error`. */
  submit: () => void
}

export type CreateGroupForm = PairForm & {
  nickname: string
  setNickname: (nickname: string) => void
}

/** Create a group from a connection link, then make it the active environment. */
export function useCreateGroupForm(onCreated: (id: EnvironmentId) => void): CreateGroupForm {
  const [nickname, setNickname] = useState('')
  const form = usePairSubmit(async (link) => {
    const result = await pairNewGroup({ connectionLink: link, nickname })
    if (!result.ok) return result.error
    await environmentActions.setActive(result.value.id)
    onCreated(result.value.id)
    return null
  })

  return { ...form, nickname, setNickname }
}

/** Add another verified route to a group that already exists. */
export function useAddConnectionForm(groupId: EnvironmentId, onAdded: () => void): PairForm {
  return usePairSubmit(async (link) => {
    const result = await addGroupConnection({ connectionLink: link, groupId })
    if (!result.ok) return result.error
    onAdded()
    return null
  })
}

/** The link field, its busy flag, and the pairing failure both forms report the same way. */
function usePairSubmit(
  run: (link: string) => Promise<Parameters<typeof describePairProblem>[0] | null>,
): PairForm {
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return {
    busy,
    empty: link.trim() === '',
    error,
    link,
    setLink,
    submit: (): void => {
      if (busy) return
      setBusy(true)
      setError(null)
      runUserAction(
        async () => {
          const problem = await run(link)
          if (problem !== null) setError(describePairProblem(problem))
        },
        (cause: unknown) => {
          setError(cause instanceof Error ? cause.message : String(cause))
        },
        () => {
          setBusy(false)
        },
      )
    },
  }
}

export type GroupDetailState = {
  nickname: string
  setNickname: (nickname: string) => void
  /** Committed on blur and on submit — a rename is not worth a Save button. Total void. */
  saveNickname: () => void
  /** The connection URL whose long-press menu is open, or null. */
  menuFor: string | null
  openMenu: (url: string) => void
  closeMenu: () => void
  /** The connection URL awaiting removal confirmation, or null. */
  removing: string | null
  askRemove: (url: string) => void
  cancelRemove: () => void
  confirmRemove: () => void
  makePrimary: (url: string) => void
  move: (index: number, direction: -1 | 1) => void
  setIcon: (icon: Environment['icon']) => void
  use: () => void
  confirmDelete: () => void
  /** Last write failure for this detail surface (pair forms use their own `error`). */
  writeError: string | null
}

function writeFailureMessage(label: string, cause: unknown): string {
  return `${label}: ${cause instanceof Error ? cause.message : String(cause)}`
}

/** One group's editable state: its nickname draft, its row menus, and its endpoint writes. */
export function useGroupDetail(environment: Environment, onDeleted: () => void): GroupDetailState {
  const [nickname, setNickname] = useState(environment.nickname)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [writeError, setWriteError] = useState<string | null>(null)

  const runWrite = (label: string, work: () => Promise<void>): void => {
    setWriteError(null)
    // Same channel as pair forms / data-panel ErrorNote: inline text, not a second Alert.
    runUserAction(work, (cause: unknown) => {
      setWriteError(writeFailureMessage(label, cause))
    })
  }

  return {
    askRemove: setRemoving,
    cancelRemove: () => {
      setRemoving(null)
    },
    closeMenu: () => {
      setMenuFor(null)
    },
    confirmDelete: () => {
      Alert.alert(
        'Delete environment group?',
        `Remove “${environment.nickname}” and its saved routes from this device.`,
        [
          { style: 'cancel', text: 'Cancel' },
          {
            onPress: () => {
              // Alert button handlers are sync; route failure to the detail writeError channel
              // (pair forms / settings panels use inline text, not nested Alerts).
              setWriteError(null)
              runUserAction(
                () => environmentActions.remove(environment.id).then(onDeleted),
                (cause: unknown) => {
                  setWriteError(writeFailureMessage('Could not delete environment', cause))
                },
              )
            },
            style: 'destructive',
            text: 'Delete',
          },
        ],
      )
    },
    confirmRemove: (): void => {
      const url = removing
      setRemoving(null)
      if (url === null) return
      runWrite('Could not remove connection', () =>
        environmentActions.removeEndpoint(environment.id, url),
      )
    },
    makePrimary: (url): void => {
      runWrite('Could not make primary', async () => {
        await environmentActions.preferEndpoint(environment.id, url)
        // Read the group back: `preferEndpoint` is what decides the list this reorder rewrites.
        const saved = getEnvironment(environment.id)
        if (saved === null) return
        await environmentActions.setEndpointOrder(
          environment.id,
          promotedOrder(saved.endpoints, url),
        )
      })
    },
    menuFor,
    move: (index, direction): void => {
      runWrite('Could not reorder connections', async () => {
        const saved = getEnvironment(environment.id)
        if (saved === null) return
        const next = movedOrder(saved.endpoints, index, direction)
        if (next === null) return
        await environmentActions.setEndpointOrder(environment.id, next)
      })
    },
    nickname,
    openMenu: setMenuFor,
    removing,
    saveNickname: (): void => {
      const next = nickname.trim()
      if (next === '' || next === environment.nickname) return
      runWrite('Could not rename environment', () =>
        environmentActions.rename(environment.id, next),
      )
    },
    setIcon: (icon): void => {
      runWrite('Could not update icon', () => environmentActions.setIcon(environment.id, icon))
    },
    setNickname,
    use: (): void => {
      runWrite('Could not switch environment', () => environmentActions.setActive(environment.id))
    },
    writeError,
  }
}

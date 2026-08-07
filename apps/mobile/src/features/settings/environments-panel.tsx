import { endpointKind } from '@porcelain/contracts'
import { useState } from 'react'
import { Alert, Pressable, View } from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'
import { ChromeGlyph, type ChromeIconName } from '@/components/chrome-glyph'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import {
  type Environment,
  type EnvironmentIcon,
  type EnvironmentId,
  hostOf,
} from '@/lib/daemon/environment'
import {
  environmentActions,
  getEnvironment,
  useActiveEnvironment,
  useConnectionState,
  useEnvironments,
  useEnvironmentsCorrupt,
} from '@/lib/daemon/environments-store'
import { cn } from '@/lib/utils'
import { addGroupConnection, describePairProblem, pairNewGroup } from './pair-environment'

type EnvRoute =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'detail'; id: EnvironmentId }
  | { kind: 'add-connection'; id: EnvironmentId }

const ICON_OPTIONS: { id: EnvironmentIcon; label: string; glyph: ChromeIconName }[] = [
  { id: 'desktop', label: 'Desktop', glyph: 'desktop' },
  { id: 'terminal', label: 'Terminal', glyph: 'terminal' },
  { id: 'notebook', label: 'Notebook', glyph: 'notebook' },
]

function endpointLabel(url: string): string {
  switch (endpointKind(url)) {
    case 'lan':
      return 'LAN'
    case 'tailnet':
      return 'Tailscale'
    case 'other':
      return 'Funnel / Internet'
  }
}

function connectionStatusLabel(kind: ReturnType<typeof useConnectionState>['kind']): string {
  switch (kind) {
    case 'ready':
      return 'Connected'
    case 'connecting':
    case 'loading':
      return 'Connecting…'
    case 'unreachable':
      return 'Unreachable'
    case 'unauthorized':
      return 'Token rejected'
    case 'no-environment':
      return 'None'
  }
}

function iconGlyph(icon: EnvironmentIcon): ChromeIconName {
  return icon
}

/** Environments section — list, create, and detail for client-owned groups. */
export function EnvironmentsSettings(): React.JSX.Element {
  const [route, setRoute] = useState<EnvRoute>({ kind: 'list' })
  const environments = useEnvironments()
  const corrupt = useEnvironmentsCorrupt()

  if (route.kind === 'create') {
    return (
      <CreateGroupForm
        onCancel={() => {
          setRoute({ kind: 'list' })
        }}
        onCreated={(id) => {
          setRoute({ kind: 'detail', id })
        }}
      />
    )
  }

  if (route.kind === 'detail') {
    const environment = environments.find((entry) => entry.id === route.id)
    if (environment === undefined) {
      return (
        <View className="gap-3">
          <Text className="text-sm text-muted-foreground">That environment was removed.</Text>
          <Button
            variant="outline"
            onPress={() => {
              setRoute({ kind: 'list' })
            }}
          >
            <Text>Back</Text>
          </Button>
        </View>
      )
    }
    return (
      <GroupDetail
        environment={environment}
        onAddConnection={() => {
          setRoute({ kind: 'add-connection', id: environment.id })
        }}
        onBack={() => {
          setRoute({ kind: 'list' })
        }}
        onDeleted={() => {
          setRoute({ kind: 'list' })
        }}
      />
    )
  }

  if (route.kind === 'add-connection') {
    return (
      <AddConnectionForm
        groupId={route.id}
        onCancel={() => {
          setRoute({ kind: 'detail', id: route.id })
        }}
        onAdded={() => {
          setRoute({ kind: 'detail', id: route.id })
        }}
      />
    )
  }

  return (
    <EnvironmentsList
      corrupt={corrupt}
      environments={environments}
      onCreate={() => {
        setRoute({ kind: 'create' })
      }}
      onOpen={(id) => {
        setRoute({ kind: 'detail', id })
      }}
    />
  )
}

function EnvironmentsList({
  environments,
  corrupt,
  onCreate,
  onOpen,
}: {
  environments: readonly Environment[]
  corrupt: boolean
  onCreate: () => void
  onOpen: (id: EnvironmentId) => void
}): React.JSX.Element {
  const active = useActiveEnvironment()
  const connection = useConnectionState()

  return (
    <View className="gap-3" testID="porcelain-settings-environments">
      <Text className="text-sm text-muted-foreground">
        Pair this device with a daemon. Prefer LAN first; add Tailscale or Funnel as fallbacks.
        Production port 43117 is never used for product work on this app.
      </Text>

      {corrupt ? (
        <View className="gap-1 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
          <Text className="text-sm font-medium text-destructive">
            Saved environments unreadable
          </Text>
          <Text className="text-xs text-muted-foreground">
            The on-device index could not be parsed. Existing credentials were not deleted —
            reinstall or restore from a backup, then re-pair.
          </Text>
        </View>
      ) : null}

      {environments.length === 0 && !corrupt ? (
        <View
          className="gap-1 rounded-xl border border-dashed border-border bg-muted/30 p-4"
          testID="porcelain-settings-environments-empty"
        >
          <Text className="text-sm font-medium text-foreground">No environments yet</Text>
          <Text className="text-xs leading-5 text-muted-foreground">
            Create a group with a connection link from the host Share settings.
          </Text>
        </View>
      ) : null}

      {environments.map((environment) => {
        const isActive = environment.id === active?.id
        const statusLabel = describeConnection(environment, isActive, connection)
        return (
          <Pressable
            key={environment.id}
            accessibilityLabel={`${environment.nickname}, ${statusLabel}`}
            accessibilityRole="button"
            className={cn(
              'flex-row items-center gap-3 rounded-xl border border-border bg-card p-3 active:bg-accent',
              isActive && 'border-primary/40 bg-primary/5',
            )}
            testID={`porcelain-settings-environment-${environment.id}`}
            onPress={() => {
              onOpen(environment.id)
            }}
          >
            <View className="size-10 items-center justify-center rounded-lg bg-muted">
              <ChromeGlyph name={iconGlyph(environment.icon)} size={18} tone="foreground" />
            </View>
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="font-medium text-foreground" numberOfLines={1}>
                {environment.nickname}
              </Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {statusLabel}
              </Text>
            </View>
            {isActive ? <Text className="text-xs font-semibold text-primary">Active</Text> : null}
            <ChromeGlyph name="chevronRight" size={14} />
          </Pressable>
        )
      })}

      <Button testID="porcelain-settings-create-environment" variant="outline" onPress={onCreate}>
        <Text>Create environment group</Text>
      </Button>
    </View>
  )
}

function describeConnection(
  environment: Environment,
  isActive: boolean,
  connection: ReturnType<typeof useConnectionState>,
): string {
  const count = environment.endpoints.length
  const routes = `${count} connection${count === 1 ? '' : 's'}`
  if (!isActive) {
    if (environment.token === null) return `Unpaired · ${routes}`
    return `${hostOf(environment.preferredEndpoint)} · ${routes}`
  }
  switch (connection.kind) {
    case 'loading':
    case 'connecting':
      return `Connecting… · ${routes}`
    case 'ready':
      return `daemon ${connection.daemonVersion} · ${routes}`
    case 'unreachable':
      return `Unreachable · ${routes}`
    case 'unauthorized':
      return `Token rejected · ${routes}`
    case 'no-environment':
      return routes
  }
}

function CreateGroupForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: (id: EnvironmentId) => void
}): React.JSX.Element {
  const [nickname, setNickname] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const result = await pairNewGroup({ connectionLink: link, nickname })
    setBusy(false)
    if (!result.ok) {
      setError(describePairProblem(result.error))
      return
    }
    await environmentActions.setActive(result.value.id)
    onCreated(result.value.id)
  }

  return (
    <View className="gap-3" testID="porcelain-settings-create-group">
      <BackRow label="Environments" onPress={onCancel} />
      <Text className="text-base font-semibold text-foreground">Create environment group</Text>
      <Text className="text-xs leading-5 text-muted-foreground">
        Pair LAN first. After the group exists you can add Tailscale or Funnel as fallback routes.
      </Text>

      <Field label="Nickname (optional)">
        <Input
          accessibilityLabel="Group nickname"
          autoCapitalize="none"
          autoCorrect={false}
          className="h-10"
          editable={!busy}
          placeholder="Defaults to host name"
          testID="porcelain-settings-group-nickname"
          value={nickname}
          onChangeText={setNickname}
        />
      </Field>

      <Field label="Connection link">
        <Input
          accessibilityLabel="Connection link"
          autoCapitalize="none"
          autoCorrect={false}
          className="h-10 font-mono text-xs"
          editable={!busy}
          placeholder="https://…/pair#token=…"
          secureTextEntry
          testID="porcelain-settings-group-link"
          value={link}
          onChangeText={setLink}
        />
      </Field>

      {error ? (
        <Text className="text-xs text-destructive" testID="porcelain-settings-pair-error">
          {error}
        </Text>
      ) : null}

      <View className="flex-row gap-2">
        <Button
          className="flex-1"
          disabled={busy || link.trim() === ''}
          testID="porcelain-settings-pair-submit"
          onPress={() => {
            submit()
          }}
        >
          <Text>{busy ? 'Pairing…' : 'Create & use'}</Text>
        </Button>
        <Button disabled={busy} variant="ghost" onPress={onCancel}>
          <Text>Cancel</Text>
        </Button>
      </View>
    </View>
  )
}

function AddConnectionForm({
  groupId,
  onCancel,
  onAdded,
}: {
  groupId: EnvironmentId
  onCancel: () => void
  onAdded: () => void
}): React.JSX.Element {
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const result = await addGroupConnection({ groupId, connectionLink: link })
    setBusy(false)
    if (!result.ok) {
      setError(describePairProblem(result.error))
      return
    }
    onAdded()
  }

  return (
    <View className="gap-3" testID="porcelain-settings-add-connection">
      <BackRow label="Group" onPress={onCancel} />
      <Text className="text-base font-semibold text-foreground">Add connection</Text>
      <Text className="text-xs leading-5 text-muted-foreground">
        Paste another link for the same daemon. It is verified before joining this group.
      </Text>
      <Field label="Connection link">
        <Input
          accessibilityLabel="Connection link"
          autoCapitalize="none"
          autoCorrect={false}
          className="h-10 font-mono text-xs"
          editable={!busy}
          placeholder="https://…/pair#token=…"
          secureTextEntry
          testID="porcelain-settings-add-connection-link"
          value={link}
          onChangeText={setLink}
        />
      </Field>
      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
      <View className="flex-row gap-2">
        <Button
          className="flex-1"
          disabled={busy || link.trim() === ''}
          testID="porcelain-settings-add-connection-submit"
          onPress={() => {
            submit()
          }}
        >
          <Text>{busy ? 'Adding…' : 'Add connection'}</Text>
        </Button>
        <Button disabled={busy} variant="ghost" onPress={onCancel}>
          <Text>Cancel</Text>
        </Button>
      </View>
    </View>
  )
}

function GroupDetail({
  environment,
  onBack,
  onAddConnection,
  onDeleted,
}: {
  environment: Environment
  onBack: () => void
  onAddConnection: () => void
  onDeleted: () => void
}): React.JSX.Element {
  const active = useActiveEnvironment()
  const connection = useConnectionState()
  const isActive = active?.id === environment.id
  const [nickname, setNickname] = useState(environment.nickname)
  const version = isActive && connection.kind === 'ready' ? connection.daemonVersion : null

  const saveNickname = async (): Promise<void> => {
    const next = nickname.trim()
    if (next === '' || next === environment.nickname) return
    await environmentActions.rename(environment.id, next)
  }

  const confirmDelete = (): void => {
    Alert.alert(
      'Delete environment group?',
      `Remove “${environment.nickname}” and its saved routes from this device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            environmentActions.remove(environment.id).then(onDeleted)
          },
        },
      ],
    )
  }

  return (
    <View className="gap-4" testID={`porcelain-settings-group-detail-${environment.id}`}>
      <BackRow label="Environments" onPress={onBack} />

      <View className="gap-3 rounded-xl border border-border bg-card p-3">
        <Field label="Nickname">
          <Input
            accessibilityLabel="Group nickname"
            autoCapitalize="none"
            autoCorrect={false}
            className="h-10"
            testID="porcelain-settings-detail-nickname"
            value={nickname}
            onBlur={() => {
              saveNickname()
            }}
            onChangeText={setNickname}
            onSubmitEditing={() => {
              saveNickname()
            }}
          />
        </Field>

        <View className="flex-row flex-wrap gap-x-4 gap-y-1">
          <Meta
            label="Porcelain"
            value={
              version ??
              (isActive && (connection.kind === 'connecting' || connection.kind === 'loading')
                ? 'Checking…'
                : '—')
            }
          />
          <Meta label="Connections" value={String(environment.endpoints.length)} />
          <Meta
            label="Status"
            value={
              environment.token === null
                ? 'Unpaired'
                : isActive
                  ? connectionStatusLabel(connection.kind)
                  : 'Idle'
            }
          />
        </View>

        <View className="gap-1.5">
          <Text className="text-xs text-muted-foreground">Icon</Text>
          <View className="flex-row gap-2">
            {ICON_OPTIONS.map((option) => {
              const selected = environment.icon === option.id
              return (
                <Pressable
                  key={option.id}
                  accessibilityLabel={`Icon ${option.label}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={cn(
                    'flex-1 items-center gap-1 rounded-lg border border-border py-2.5 active:bg-accent',
                    selected && 'border-primary bg-primary/10',
                  )}
                  testID={`porcelain-settings-icon-${option.id}`}
                  onPress={() => {
                    environmentActions.setIcon(environment.id, option.id)
                  }}
                >
                  <ChromeGlyph
                    name={option.glyph}
                    size={18}
                    tone={selected ? 'primary' : 'foreground'}
                  />
                  <Text className="text-[11px] text-foreground">{option.label}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        {!isActive && environment.token !== null ? (
          <Button
            testID="porcelain-settings-use-environment"
            variant="outline"
            onPress={() => {
              environmentActions.setActive(environment.id)
            }}
          >
            <Text>Use this environment</Text>
          </Button>
        ) : null}
      </View>

      <View className="gap-2">
        <View className="gap-0.5">
          <Text className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Connections
          </Text>
          <Text className="text-xs leading-5 text-muted-foreground">
            The primary is tried first; the rest follow in this order until one answers.
          </Text>
        </View>
        {environment.endpoints.map((url, index) => (
          <ConnectionRow
            key={url}
            canRemove={environment.endpoints.length > 1}
            environmentId={environment.id}
            index={index}
            preferred={url === environment.preferredEndpoint}
            total={environment.endpoints.length}
            url={url}
          />
        ))}
      </View>

      {/* Outside the connections group on purpose: inside it, the button sat 8pt below the last
          card and 16pt above Delete group, which reads as a misalignment rather than a step. */}
      <Button
        testID="porcelain-settings-add-connection-open"
        variant="outline"
        onPress={onAddConnection}
      >
        <Text>Add connection</Text>
      </Button>

      <Button
        testID="porcelain-settings-delete-group"
        variant="destructive"
        onPress={confirmDelete}
      >
        <Text>Delete group</Text>
      </Button>
    </View>
  )
}

function ConnectionRow({
  environmentId,
  url,
  preferred,
  canRemove,
  index,
  total,
}: {
  environmentId: EnvironmentId
  url: string
  preferred: boolean
  canRemove: boolean
  index: number
  total: number
}): React.JSX.Element {
  const move = async (direction: -1 | 1): Promise<void> => {
    const environment = getEnvironment(environmentId)
    if (environment === null) return
    const next = [...environment.endpoints]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    const current = next[index]
    const swap = next[target]
    if (current === undefined || swap === undefined) return
    next[index] = swap
    next[target] = current
    await environmentActions.setEndpointOrder(environmentId, next)
  }

  /**
   * Promotion also hoists the row to the top. The client walks `preferredEndpoint` first and
   * the rest in array order, so leaving a promoted row sitting third made the list disagree
   * with the failover it was describing — the reader had to hold two orders in their head.
   */
  const makePrimary = async (): Promise<void> => {
    await environmentActions.preferEndpoint(environmentId, url)
    const environment = getEnvironment(environmentId)
    if (environment === null) return
    await environmentActions.setEndpointOrder(environmentId, [
      url,
      ...environment.endpoints.filter((candidate) => candidate !== url),
    ])
  }

  const body = (
    <View
      className={cn(
        'flex-row items-center gap-3 rounded-xl border p-3',
        preferred ? 'border-primary/40 bg-primary/5' : 'border-border bg-card',
      )}
      testID={`porcelain-settings-connection-${index}`}
    >
      <View className="min-w-0 flex-1 gap-1.5">
        <View className="flex-row items-center gap-2">
          <View
            className={cn(
              'rounded-md px-2 py-0.5',
              preferred ? 'bg-primary' : 'border border-border bg-muted',
            )}
          >
            <Text
              className={cn(
                'text-[11px] font-semibold',
                preferred ? 'text-primary-foreground' : 'text-foreground',
              )}
            >
              {endpointLabel(url)}
            </Text>
          </View>
          {preferred ? (
            <View className="flex-row items-center gap-1">
              <ChromeGlyph name="star" size={11} tone="primary" />
              <Text className="text-[11px] font-semibold uppercase tracking-widest text-primary">
                Primary
              </Text>
            </View>
          ) : (
            <Pressable
              accessibilityLabel="Make this the primary connection"
              accessibilityRole="button"
              className="flex-row items-center gap-1 rounded-md border border-border px-2 py-0.5 active:bg-accent"
              testID={`porcelain-settings-connection-primary-${index}`}
              onPress={() => {
                makePrimary()
              }}
            >
              <ChromeGlyph name="star" size={10} />
              <Text className="text-[11px] font-medium text-foreground">Make primary</Text>
            </Pressable>
          )}
        </View>
        <Text className="font-mono text-xs text-muted-foreground" numberOfLines={2}>
          {url}
        </Text>
      </View>

      {/* Reorder is two glyphs on the trailing edge, not two word-buttons in the row's flow:
          "Up" and "Down" spelled out sat beside "Make primary" and read as three peers, so
          which one changed the failover order was a guess. */}
      {total > 1 ? (
        <View className="shrink-0 gap-1">
          <ReorderButton
            accessibilityLabel="Move connection up"
            disabled={index === 0}
            glyph="arrowUp"
            testID={`porcelain-settings-connection-up-${index}`}
            onPress={() => {
              move(-1)
            }}
          />
          <ReorderButton
            accessibilityLabel="Move connection down"
            disabled={index === total - 1}
            glyph="moveDown"
            testID={`porcelain-settings-connection-down-${index}`}
            onPress={() => {
              move(1)
            }}
          />
        </View>
      ) : null}
    </View>
  )

  if (!canRemove) return body

  return (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          accessibilityLabel="Remove connection"
          accessibilityRole="button"
          /* surface-gutter-allow: a swipe action's own width, revealed outside the row — not a
             gutter anything aligns to. */
          className="ml-2 items-center justify-center rounded-xl bg-destructive px-4"
          testID={`porcelain-settings-connection-remove-${index}`}
          onPress={() => {
            environmentActions.removeEndpoint(environmentId, url)
          }}
        >
          <Text className="text-sm font-semibold text-white">Remove</Text>
        </Pressable>
      )}
    >
      {body}
    </Swipeable>
  )
}

/** A 32pt square on the row's trailing edge — a thumb target that is still not a text button. */
function ReorderButton({
  accessibilityLabel,
  disabled,
  glyph,
  onPress,
  testID,
}: {
  accessibilityLabel: string
  disabled: boolean
  glyph: ChromeIconName
  onPress: () => void
  testID: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={cn(
        'size-8 items-center justify-center rounded-md border border-border active:bg-accent',
        disabled && 'opacity-30',
      )}
      disabled={disabled}
      hitSlop={4}
      testID={testID}
      onPress={onPress}
    >
      <ChromeGlyph name={glyph} size={13} tone="foreground" />
    </Pressable>
  )
}

function BackRow({ label, onPress }: { label: string; onPress: () => void }): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`Back to ${label}`}
      accessibilityRole="button"
      className="-ml-1 flex-row items-center gap-0.5 self-start py-1 active:opacity-70"
      testID="porcelain-settings-env-back"
      onPress={onPress}
    >
      <ChromeGlyph name="chevronLeft" size={16} tone="primary" />
      <Text className="text-sm font-medium text-primary">{label}</Text>
    </Pressable>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <View className="gap-1.5">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      {children}
    </View>
  )
}

function Meta({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View className="gap-0.5">
      <Text className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </Text>
      <Text className="text-sm text-foreground">{value}</Text>
    </View>
  )
}

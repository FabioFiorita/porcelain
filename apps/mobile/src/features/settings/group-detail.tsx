import { Pressable, View } from 'react-native'

import { ChromeGlyph, type ChromeIconName } from '@/components/chrome-glyph'
import {
  ActionSheet,
  ConfirmDialog,
  ErrorNote,
  PanelLabel,
  type SheetAction,
} from '@/components/panel-chrome'
import { PANEL_CARD } from '@/components/surface-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import {
  type Environment,
  type EnvironmentIcon,
  useActiveEnvironment,
  useConnectionState,
} from '@/features/remote'
import { cn } from '@/lib/utils'
import { BackRow, Field, Meta } from './environment-chrome'
import { connectionStatusLabel, endpointLabel } from './environment-labels'
import { useGroupDetail } from './use-environments-panel'

const ICON_OPTIONS: { id: EnvironmentIcon; label: string; glyph: ChromeIconName }[] = [
  { glyph: 'desktop', id: 'desktop', label: 'Desktop' },
  { glyph: 'terminal', id: 'terminal', label: 'Terminal' },
  { glyph: 'notebook', id: 'notebook', label: 'Notebook' },
]

/** One environment group: its identity, its ordered connections, and the two ways to unmake it. */
export function GroupDetail({
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
  const detail = useGroupDetail(environment, onDeleted)
  const version = isActive && connection.kind === 'ready' ? connection.daemonVersion : null
  const canRemove = environment.endpoints.length > 1

  /**
   * A connection row's actions, the same long-press menu Terminal and Files rows wear. This
   * was the app's only swipe-to-delete: one row in one panel answering a gesture nothing else
   * in the app answers, and hiding its only destructive action behind it.
   */
  const rowActions = (url: string): SheetAction[] => {
    const actions: SheetAction[] = []
    if (url !== environment.preferredEndpoint) {
      actions.push({
        glyph: 'star',
        id: 'primary',
        label: 'Make primary',
        onPress: () => {
          detail.makePrimary(url)
        },
      })
    }
    if (canRemove) {
      actions.push({
        destructive: true,
        glyph: 'trash',
        id: 'remove',
        label: 'Remove connection',
        onPress: () => {
          detail.askRemove(url)
        },
      })
    }
    return actions
  }

  return (
    <View className="gap-4" testID={`porcelain-settings-group-detail-${environment.id}`}>
      <BackRow label="Environments" onPress={onBack} />

      <View className={cn(PANEL_CARD, 'gap-3 p-3')}>
        <Field label="Nickname">
          <Input
            accessibilityLabel="Group nickname"
            autoCapitalize="none"
            autoCorrect={false}
            className="h-10"
            testID="porcelain-settings-detail-nickname"
            value={detail.nickname}
            onBlur={() => {
              detail.saveNickname()
            }}
            onChangeText={detail.setNickname}
            onSubmitEditing={() => {
              detail.saveNickname()
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
                    detail.setIcon(option.id)
                  }}
                >
                  <ChromeGlyph
                    name={option.glyph}
                    size={18}
                    tone={selected ? 'primary' : 'foreground'}
                  />
                  <Text className="text-2xs text-foreground">{option.label}</Text>
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
              detail.use()
            }}
          >
            <Text>Use this environment</Text>
          </Button>
        ) : null}
      </View>

      {detail.writeError === null ? null : (
        <ErrorNote message={detail.writeError} testID="porcelain-settings-group-write-error" />
      )}

      <View className="gap-2">
        <View className="gap-0.5">
          <PanelLabel>Connections</PanelLabel>
          <Text className="text-xs leading-5 text-muted-foreground">
            The primary is tried first; the rest follow in this order until one answers.
          </Text>
        </View>
        {environment.endpoints.map((url, index) => (
          <ConnectionRow
            key={url}
            index={index}
            preferred={url === environment.preferredEndpoint}
            total={environment.endpoints.length}
            url={url}
            onMakePrimary={() => {
              detail.makePrimary(url)
            }}
            onMove={(direction) => {
              detail.move(index, direction)
            }}
            onLongPress={
              rowActions(url).length === 0
                ? undefined
                : () => {
                    detail.openMenu(url)
                  }
            }
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
        onPress={detail.confirmDelete}
      >
        <Text>Delete group</Text>
      </Button>

      <ActionSheet
        actions={detail.menuFor === null ? [] : rowActions(detail.menuFor)}
        open={detail.menuFor !== null}
        subtitle={detail.menuFor ?? undefined}
        testID="porcelain-settings-connection-menu"
        title="Connection"
        onClose={detail.closeMenu}
      />

      <ConfirmDialog
        body="This device stops trying that route. The others in this group are untouched, and the daemon is not changed."
        confirmLabel="Remove"
        open={detail.removing !== null}
        title="Remove this connection?"
        onCancel={detail.cancelRemove}
        onConfirm={() => {
          detail.confirmRemove()
        }}
      />
    </View>
  )
}

function ConnectionRow({
  url,
  preferred,
  index,
  total,
  onLongPress,
  onMakePrimary,
  onMove,
}: {
  url: string
  preferred: boolean
  index: number
  total: number
  /** Opens the row menu. Absent when this row has no action to offer. */
  onLongPress?: () => void
  onMakePrimary: () => void
  onMove: (direction: -1 | 1) => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`Connection ${endpointLabel(url)}, ${url}`}
      accessibilityRole="button"
      className={cn(
        PANEL_CARD,
        'flex-row items-center gap-3 p-3',
        preferred && 'border-primary/40 bg-primary/5',
      )}
      testID={`porcelain-settings-connection-${index}`}
      onLongPress={onLongPress}
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
                'text-2xs font-semibold',
                preferred ? 'text-primary-foreground' : 'text-foreground',
              )}
            >
              {endpointLabel(url)}
            </Text>
          </View>
          {preferred ? (
            <View className="flex-row items-center gap-1">
              <ChromeGlyph name="star" size={11} tone="primary" />
              <Text className="text-2xs font-semibold uppercase tracking-widest text-primary">
                Primary
              </Text>
            </View>
          ) : (
            <Pressable
              accessibilityLabel="Make this the primary connection"
              accessibilityRole="button"
              className="flex-row items-center gap-1 rounded-md border border-border px-2 py-0.5 active:bg-accent"
              testID={`porcelain-settings-connection-primary-${index}`}
              onPress={onMakePrimary}
            >
              <ChromeGlyph name="star" size={10} />
              <Text className="text-2xs font-medium text-foreground">Make primary</Text>
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
              onMove(-1)
            }}
          />
          <ReorderButton
            accessibilityLabel="Move connection down"
            disabled={index === total - 1}
            glyph="moveDown"
            testID={`porcelain-settings-connection-down-${index}`}
            onPress={() => {
              onMove(1)
            }}
          />
        </View>
      ) : null}
    </Pressable>
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

import { Pressable, View } from 'react-native'

import { EmptyNote, ErrorNote, PanelLabel } from '@/components/panel-chrome'
import { PANEL_CARD } from '@/components/surface-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { useActiveEnvironment, useConnectionState } from '@/lib/daemon/environments-store'
import type { Layer } from '@/lib/daemon/procedures/settings'
import { cn } from '@/lib/utils'

import { PatternBuilder } from './pattern-builder'
import { patternError } from './review-layers'
import { useReviewEditor } from './use-review-editor'

/** Review layer config for the active environment's active repo — same model as web. */
export function ReviewSettings(): React.JSX.Element {
  const environment = useActiveEnvironment()
  const connection = useConnectionState()
  const repoPath = environment?.activeRepoPath ?? null

  if (environment === null || connection.kind === 'no-environment') {
    return (
      <EmptyNote
        body="Pair an environment first. Review layers live on the daemon for the open repository."
        testID="porcelain-settings-review-no-env"
        title="No environment"
      />
    )
  }

  if (connection.kind !== 'ready') {
    return (
      <EmptyNote
        body={
          connection.kind === 'connecting' || connection.kind === 'loading'
            ? 'Connecting to the daemon…'
            : 'The active environment is not reachable. Fix the connection under Environments, then return here.'
        }
        testID="porcelain-settings-review-offline"
        title="Daemon not connected"
      />
    )
  }

  if (repoPath === null) {
    return (
      <EmptyNote
        body="Open a project from the header. Layers are stored per repository on the daemon."
        testID="porcelain-settings-review-empty"
        title="No repository selected"
      />
    )
  }

  return <ReviewLayersEditor repoPath={repoPath} />
}

function ReviewLayersEditor({ repoPath }: { repoPath: string }): React.JSX.Element {
  const editor = useReviewEditor(repoPath)
  const { review } = editor

  if (review.isLoading) {
    return (
      <Text
        className="py-6 text-sm text-muted-foreground"
        testID="porcelain-settings-review-loading"
      >
        Loading layers…
      </Text>
    )
  }

  if (review.error !== null) {
    return (
      <ErrorNote
        message={`Could not load layers. ${review.error.message || 'The daemon refused the request.'}`}
        testID="porcelain-settings-review-error"
      />
    )
  }

  return (
    <View className="gap-4" testID="porcelain-settings-review">
      {review.isStarter ? (
        <View className={cn(PANEL_CARD, 'gap-1 p-3')}>
          <Text className="text-xs font-medium text-foreground">Starter groups for this tree</Text>
          <Text className="text-xs leading-5 text-muted-foreground">
            Every project starts with Docs and Agents only. Product code lands in Other until you or
            your agent tune the set.
          </Text>
        </View>
      ) : null}

      <PatternBuilder changedPaths={review.changedPaths} onAdd={editor.add} />

      <View className="gap-2">
        <PanelLabel>Layers</PanelLabel>
        {editor.draft.map((layer, index) => (
          <LayerRow
            key={layer.id}
            count={editor.draft.length}
            index={index}
            layerId={layer.id}
            layer={layer}
            onChange={(next) => {
              editor.update(index, next)
            }}
            onMove={(direction) => {
              editor.move(index, direction)
            }}
            onRemove={() => {
              editor.remove(index)
            }}
          />
        ))}
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Button
          disabled={!editor.valid || review.isSaving || editor.draft.length === 0}
          testID="porcelain-settings-review-save"
          onPress={() => {
            editor.save(editor.draft)
          }}
        >
          <Text>{editor.savedFlash ? 'Saved' : review.isSaving ? 'Saving…' : 'Save'}</Text>
        </Button>
        <Button
          disabled={review.isSaving}
          testID="porcelain-settings-review-reset"
          variant="outline"
          onPress={() => {
            editor.save(null)
          }}
        >
          <Text>Reset to starters</Text>
        </Button>
      </View>

      {review.failure === null ? null : (
        <ErrorNote message={review.failure} testID="porcelain-settings-review-write-error" />
      )}
    </View>
  )
}

function LayerRow({
  layer,
  index,
  count,
  layerId,
  onChange,
  onMove,
  onRemove,
}: {
  layer: Layer
  index: number
  count: number
  layerId: number
  onChange: (layer: Layer) => void
  onMove: (direction: 1 | -1) => void
  onRemove: () => void
}): React.JSX.Element {
  const error = patternError(layer.pattern)

  return (
    <View className={cn(PANEL_CARD, 'gap-1.5 p-3')} testID={`porcelain-settings-layer-${index}`}>
      <View className="flex-row gap-2">
        <Input
          accessibilityLabel={`Layer ${index + 1} label`}
          className="h-9 w-28"
          placeholder="Label"
          value={layer.label}
          onChangeText={(label) => {
            onChange({ ...layer, label })
          }}
        />
        <Input
          accessibilityLabel={`Layer ${index + 1} pattern`}
          autoCapitalize="none"
          autoCorrect={false}
          className={cn('h-9 min-w-0 flex-1 font-mono text-xs', error && 'border-destructive')}
          placeholder="Pattern (regex)"
          value={layer.pattern}
          onChangeText={(pattern) => {
            onChange({ ...layer, pattern })
          }}
        />
      </View>
      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
      <View className="flex-row gap-1">
        <Pressable
          accessibilityLabel="Move layer up"
          accessibilityRole="button"
          className={cn(
            'rounded-md border border-border px-2.5 py-1.5 active:bg-accent',
            index === 0 && 'opacity-40',
          )}
          disabled={index === 0}
          onPress={() => {
            onMove(-1)
          }}
        >
          <Text className="text-xs text-foreground">Up</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Move layer down"
          accessibilityRole="button"
          className={cn(
            'rounded-md border border-border px-2.5 py-1.5 active:bg-accent',
            index === count - 1 && 'opacity-40',
          )}
          disabled={index === count - 1}
          onPress={() => {
            onMove(1)
          }}
        >
          <Text className="text-xs text-foreground">Down</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Remove layer"
          accessibilityRole="button"
          className={cn(
            'ml-auto rounded-md border border-border px-2.5 py-1.5 active:bg-accent',
            count === 1 && 'opacity-40',
          )}
          disabled={count === 1}
          onPress={onRemove}
          testID={`porcelain-settings-review-layer-${layerId}-remove`}
        >
          <Text className="text-xs text-destructive">Remove</Text>
        </Pressable>
      </View>
    </View>
  )
}

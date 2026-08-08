import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'

import { SegmentedControl } from '@/components/segmented-control'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { useActiveEnvironment, useConnectionState } from '@/lib/daemon/environments-store'
import { gitFlowQuery } from '@/lib/daemon/procedures/changes'
import {
  type Layer,
  repoLayersQuery,
  setRepoLayersMutation,
} from '@/lib/daemon/procedures/settings'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { cn } from '@/lib/utils'

type MatchType = 'folder' | 'ext' | 'suffix'

const PLACEHOLDERS: Record<MatchType, string> = {
  folder: 'components, views',
  ext: 'ts, tsx',
  suffix: 'test, spec',
}

const MATCH_HELP: Record<MatchType, string> = {
  folder: 'Files inside a folder of this name, e.g. src/components/Button.tsx.',
  ext: 'Files with this extension, e.g. config.yaml.',
  suffix: 'Files whose name ends with this before the extension, e.g. user.test.ts.',
}

const EXAMPLE_LIMIT = 6

const escapeRe = (name: string): string => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const splitNames = (raw: string): string[] =>
  raw
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)

const buildPattern = (type: MatchType, names: string[]): string => {
  if (names.length === 0) return ''
  const alt = `(${names.map(escapeRe).join('|')})`
  if (type === 'folder') return `(^|/)${alt}/`
  if (type === 'ext') return `\\.${alt}$`
  return `\\.${alt}\\.[a-z]+$`
}

const deriveLabel = (names: string[]): string => {
  const first = names[0] ?? ''
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : 'New layer'
}

const patternError = (pattern: string): string | null => {
  if (pattern.trim() === '') return 'pattern is required'
  try {
    new RegExp(pattern)
    return null
  } catch {
    return 'invalid regular expression'
  }
}

const matchingPaths = (pattern: string, paths: readonly string[]): string[] => {
  if (pattern === '') return []
  let re: RegExp
  try {
    re = new RegExp(pattern)
  } catch {
    return []
  }
  return paths.filter((p) => re.test(p))
}

interface DraftLayer extends Layer {
  id: number
}

let nextDraftId = 0
const toDraft = (layers: Layer[]): DraftLayer[] =>
  layers.map((layer) => ({ ...layer, id: nextDraftId++ }))

/** Review layer config for the active environment's active repo — same model as web. */
export function ReviewSettings(): React.JSX.Element {
  const environment = useActiveEnvironment()
  const connection = useConnectionState()
  const repoPath = environment?.activeRepoPath ?? null

  if (environment === null || connection.kind === 'no-environment') {
    return (
      <EmptyReviewState
        body="Pair an environment first. Review layers live on the daemon for the open repository."
        testID="porcelain-settings-review-no-env"
        title="No environment"
      />
    )
  }

  if (connection.kind !== 'ready') {
    return (
      <EmptyReviewState
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
      <EmptyReviewState
        body="Open a project from the header. Layers are stored per repository on the daemon."
        testID="porcelain-settings-review-empty"
        title="No repository selected"
      />
    )
  }

  return <ReviewLayersEditor repoPath={repoPath} />
}

function EmptyReviewState({
  title,
  body,
  testID,
}: {
  title: string
  body: string
  testID: string
}): React.JSX.Element {
  return (
    <View className="gap-2 rounded-xl border border-border bg-muted/40 p-4" testID={testID}>
      <Text className="text-sm font-medium text-foreground">{title}</Text>
      <Text className="text-xs leading-5 text-muted-foreground">{body}</Text>
    </View>
  )
}

function ReviewLayersEditor({ repoPath }: { repoPath: string }): React.JSX.Element {
  const layersQuery = useDaemonQuery(repoLayersQuery, repoPath)
  const flowQuery = useDaemonQuery(gitFlowQuery, repoPath, { pollMs: 15_000 })
  const saveMutation = useDaemonMutation(setRepoLayersMutation, {
    invalidates: ['repoLayers', 'gitFlow', 'gitRangeFlow', 'featureView', 'featureReading'],
  })

  const [draft, setDraft] = useState<DraftLayer[]>([])
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    if (layersQuery.data !== undefined) setDraft(toDraft(layersQuery.data.layers))
  }, [layersQuery.data])

  const changedPaths = (flowQuery.data ?? []).flatMap((group) => group.files.map((f) => f.path))
  const valid = draft.every((l) => l.label.trim() !== '' && patternError(l.pattern) === null)
  const isStarter = layersQuery.data !== undefined && !layersQuery.data.custom

  const handleSave = async (layers: DraftLayer[] | null): Promise<void> => {
    await saveMutation.mutateAsync({
      repoPath,
      layers: layers?.map(({ label, pattern }) => ({ label, pattern })) ?? null,
    })
    setSavedFlash(true)
    setTimeout(() => {
      setSavedFlash(false)
    }, 1500)
  }

  if (layersQuery.isLoading) {
    return (
      <Text className="text-sm text-muted-foreground" testID="porcelain-settings-review-loading">
        Loading layers…
      </Text>
    )
  }

  if (layersQuery.isError) {
    return (
      <View className="gap-1 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
        <Text className="text-sm font-medium text-destructive">Could not load layers</Text>
        <Text className="text-xs text-muted-foreground">
          {layersQuery.error.message || 'The daemon refused the request.'}
        </Text>
      </View>
    )
  }

  return (
    <View className="gap-4" testID="porcelain-settings-review">
      {isStarter ? (
        <View className="gap-1 rounded-xl border border-border bg-muted/40 p-3">
          <Text className="text-xs font-medium text-foreground">Starter groups for this tree</Text>
          <Text className="text-xs leading-5 text-muted-foreground">
            Every project starts with Docs and Agents only. Product code lands in Other until you or
            your agent tune the set.
          </Text>
        </View>
      ) : null}

      <PatternBuilder
        changedPaths={changedPaths}
        onAdd={(layer) => {
          setDraft((current) => [...current, { ...layer, id: nextDraftId++ }])
        }}
      />

      <View className="gap-2">
        <Text className="text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
          Layers
        </Text>
        {draft.map((layer, index) => (
          <LayerRow
            key={layer.id}
            count={draft.length}
            index={index}
            layerId={layer.id}
            layer={layer}
            onChange={(next) => {
              setDraft((current) =>
                current.map((entry, i) => (i === index ? { ...entry, ...next } : entry)),
              )
            }}
            onMove={(direction) => {
              setDraft((current) => {
                const next = [...current]
                const [moved] = next.splice(index, 1)
                if (moved === undefined) return current
                next.splice(index + direction, 0, moved)
                return next
              })
            }}
            onRemove={() => {
              setDraft((current) => current.filter((_, i) => i !== index))
            }}
          />
        ))}
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Button
          disabled={!valid || saveMutation.isPending || draft.length === 0}
          testID="porcelain-settings-review-save"
          onPress={() => {
            handleSave(draft)
          }}
        >
          <Text>{savedFlash ? 'Saved' : saveMutation.isPending ? 'Saving…' : 'Save'}</Text>
        </Button>
        <Button
          disabled={saveMutation.isPending}
          testID="porcelain-settings-review-reset"
          variant="outline"
          onPress={() => {
            handleSave(null)
          }}
        >
          <Text>Reset to starters</Text>
        </Button>
      </View>
    </View>
  )
}

function PatternBuilder({
  onAdd,
  changedPaths,
}: {
  onAdd: (layer: Layer) => void
  changedPaths: readonly string[]
}): React.JSX.Element {
  const [matchType, setMatchType] = useState<MatchType>('folder')
  const [names, setNames] = useState('')
  const parsed = splitNames(names)
  const preview = buildPattern(matchType, parsed)
  const matches = matchingPaths(preview, changedPaths)

  const handleAdd = (): void => {
    if (parsed.length === 0) return
    onAdd({ label: deriveLabel(parsed), pattern: preview })
    setNames('')
  }

  return (
    <View
      className="gap-2.5 rounded-xl border border-border bg-muted/40 p-3"
      testID="porcelain-settings-pattern-builder"
    >
      <Text className="text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
        Pattern builder
      </Text>
      <View className="gap-1.5">
        <Text className="text-xs text-muted-foreground">Match</Text>
        <SegmentedControl<MatchType>
          options={[
            { value: 'folder', label: 'Folder' },
            { value: 'ext', label: 'Extension' },
            { value: 'suffix', label: 'Suffix' },
          ]}
          value={matchType}
          onChange={setMatchType}
        />
      </View>
      <View className="gap-1.5">
        <Text className="text-xs text-muted-foreground">Names</Text>
        <Input
          accessibilityLabel="Pattern names"
          autoCapitalize="none"
          autoCorrect={false}
          className="h-9"
          placeholder={PLACEHOLDERS[matchType]}
          testID="porcelain-settings-pattern-names"
          value={names}
          onChangeText={setNames}
          onSubmitEditing={handleAdd}
        />
      </View>
      <View className="flex-row items-center gap-2">
        <View className="min-w-0 flex-1 rounded-md bg-muted px-2 py-1.5">
          <Text className="font-mono text-xs text-foreground" numberOfLines={1}>
            {preview || '—'}
          </Text>
        </View>
        <Button disabled={parsed.length === 0} size="sm" onPress={handleAdd}>
          <Text>Add</Text>
        </Button>
      </View>
      <Text className="text-xs leading-4 text-muted-foreground">{MATCH_HELP[matchType]}</Text>
      {parsed.length > 0 ? (
        <View className="gap-0.5 rounded-md bg-muted px-2.5 py-2">
          {changedPaths.length === 0 ? (
            <Text className="text-xs text-muted-foreground">
              No changed files to preview against right now.
            </Text>
          ) : matches.length === 0 ? (
            <Text className="text-xs text-amber-600 dark:text-amber-400">
              No changed files match this pattern — try a different match type above.
            </Text>
          ) : (
            <>
              <Text className="text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
                Matches {matches.length} changed {matches.length === 1 ? 'file' : 'files'}
              </Text>
              {matches.slice(0, EXAMPLE_LIMIT).map((path) => (
                <Text key={path} className="font-mono text-xs text-foreground" numberOfLines={1}>
                  {path}
                </Text>
              ))}
              {matches.length > EXAMPLE_LIMIT ? (
                <Text className="text-xs text-muted-foreground">
                  +{matches.length - EXAMPLE_LIMIT} more
                </Text>
              ) : null}
            </>
          )}
        </View>
      ) : null}
      <Text className="text-xs leading-4 text-muted-foreground">
        Furthest-right match wins; unmatched files fall into Other. You can still edit any pattern
        by hand below.
      </Text>
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
    <View
      className="gap-1.5 rounded-xl border border-border bg-card p-3"
      testID={`porcelain-settings-layer-${index}`}
    >
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

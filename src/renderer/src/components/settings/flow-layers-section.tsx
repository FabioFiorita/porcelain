import type { Layer } from '@main/flow'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { useRepoLayers, useSetRepoLayers } from '@renderer/hooks/use-repo-layers'
import { useRepoStore } from '@renderer/stores/repo'
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'

const patternError = (pattern: string): string | null => {
  if (pattern.trim() === '') return 'pattern is required'
  try {
    new RegExp(pattern)
    return null
  } catch {
    return 'invalid regular expression'
  }
}

type MatchType = 'folder' | 'ext' | 'suffix'

// Escape regex metacharacters so a typed name (e.g. `api.client`) stays literal.
const escapeRe = (name: string): string => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const splitNames = (raw: string): string[] =>
  raw
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)

// Turn the picked match type + names into the regex the flow grouper tests against
// the repo-relative path — the same three shapes the defaults use.
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

const PLACEHOLDERS: Record<MatchType, string> = {
  folder: 'components, views',
  ext: 'ts, tsx',
  suffix: 'test, spec',
}

// Compose a layer pattern from a match type + a few names instead of hand-writing
// the regex; the generated pattern is previewed live and added as a fresh layer
// (still editable by hand below). Replaces the old wall of explanatory text.
function PatternBuilder({ onAdd }: { onAdd: (layer: Layer) => void }): React.JSX.Element {
  const [matchType, setMatchType] = useState<MatchType>('folder')
  const [names, setNames] = useState('')
  const parsed = splitNames(names)
  const preview = buildPattern(matchType, parsed)

  const add = (): void => {
    if (parsed.length === 0) return
    onAdd({ label: deriveLabel(parsed), pattern: preview })
    setNames('')
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-md border bg-muted/40 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Pattern builder
      </p>
      <div className="flex items-center gap-2.5">
        <span className="w-14 shrink-0 text-xs text-muted-foreground">Match</span>
        <ToggleGroup
          value={[matchType]}
          onValueChange={(value: string[]) => {
            const type = value[0]
            if (type === 'folder' || type === 'ext' || type === 'suffix') setMatchType(type)
          }}
        >
          <ToggleGroupItem value="folder" className="text-xs" size="sm">
            Folder
          </ToggleGroupItem>
          <ToggleGroupItem value="ext" className="text-xs" size="sm">
            Extension
          </ToggleGroupItem>
          <ToggleGroupItem value="suffix" className="text-xs" size="sm">
            Suffix
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="w-14 shrink-0 text-xs text-muted-foreground">Names</span>
        <Input
          value={names}
          onChange={(e) => setNames(e.target.value)}
          placeholder={PLACEHOLDERS[matchType]}
          aria-label="Pattern names"
          className="flex-1 text-xs md:text-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
      </div>
      <div className="flex items-center gap-2.5">
        <span className="w-14 shrink-0 text-xs text-muted-foreground">Pattern</span>
        <code className="min-w-0 flex-1 truncate rounded-md bg-black/30 px-2.5 py-1.5 font-mono text-xs text-ink-green">
          {preview || '—'}
        </code>
        <Button size="sm" className="text-xs" disabled={parsed.length === 0} onClick={add}>
          <Plus /> Add
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Furthest-right match wins; unmatched files fall into{' '}
        <span className="text-foreground">Other</span>. You can still edit any pattern by hand
        below.
      </p>
    </div>
  )
}

function LayerRow({
  layer,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  layer: Layer
  index: number
  count: number
  onChange: (layer: Layer) => void
  onMove: (direction: 1 | -1) => void
  onRemove: () => void
}): React.JSX.Element {
  const error = patternError(layer.pattern)

  return (
    <div className="flex items-start gap-1.5">
      <Input
        value={layer.label}
        onChange={(e) => onChange({ ...layer, label: e.target.value })}
        placeholder="Label"
        aria-label={`Layer ${index + 1} label`}
        className="w-32 shrink-0 text-xs md:text-xs"
      />
      <div className="min-w-0 flex-1">
        <Input
          value={layer.pattern}
          onChange={(e) => onChange({ ...layer, pattern: e.target.value })}
          placeholder="Pattern (regex)"
          aria-label={`Layer ${index + 1} pattern`}
          aria-invalid={error !== null}
          className="font-mono text-xs md:text-xs"
        />
        {error && <p className="mt-0.5 text-xs text-destructive">{error}</p>}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={index === 0}
        onClick={() => onMove(-1)}
        aria-label="Move layer up"
      >
        <ChevronUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={index === count - 1}
        onClick={() => onMove(1)}
        aria-label="Move layer down"
      >
        <ChevronDown />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={count === 1}
        onClick={onRemove}
        aria-label="Remove layer"
      >
        <X />
      </Button>
    </div>
  )
}

interface DraftLayer extends Layer {
  /** Stable client-side key so rows keep focus while reordering. */
  id: number
}

let nextDraftId = 0
const toDraft = (layers: Layer[]): DraftLayer[] =>
  layers.map((layer) => ({ ...layer, id: nextDraftId++ }))

export function FlowLayersSection({ onSaved }: { onSaved: () => void }): React.JSX.Element | null {
  const repo = useRepoStore((s) => s.repo)
  const [draft, setDraft] = useState<DraftLayer[]>([])
  const data = useRepoLayers()
  const { save: saveLayers, isSaving } = useSetRepoLayers()

  // seed the draft from the saved layers each time the section mounts/refetches
  useEffect(() => {
    if (data) setDraft(toDraft(data.layers))
  }, [data])

  if (!repo) return null

  const valid = draft.every((l) => l.label.trim() !== '' && patternError(l.pattern) === null)

  const update = (index: number, layer: Layer): void => {
    setDraft(draft.map((l, i) => (i === index ? { ...l, ...layer } : l)))
  }

  const move = (index: number, direction: 1 | -1): void => {
    const next = [...draft]
    const [layer] = next.splice(index, 1)
    if (layer) next.splice(index + direction, 0, layer)
    setDraft(next)
  }

  const save = async (layers: DraftLayer[] | null): Promise<void> => {
    await saveLayers(layers?.map(({ label, pattern }) => ({ label, pattern })) ?? null)
    onSaved()
  }

  return (
    <div className="flex flex-col gap-3">
      <PatternBuilder onAdd={(layer) => setDraft([...draft, { ...layer, id: nextDraftId++ }])} />
      <div className="flex flex-col gap-1.5">
        {draft.map((layer, index) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            index={index}
            count={draft.length}
            onChange={(l) => update(index, l)}
            onMove={(d) => move(index, d)}
            onRemove={() => setDraft(draft.filter((_, i) => i !== index))}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="self-start text-xs"
          onClick={() => setDraft([...draft, { label: '', pattern: '', id: nextDraftId++ }])}
        >
          <Plus /> Add layer
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => save(null)}>
          Reset to defaults
        </Button>
        <Button
          size="sm"
          className="text-xs"
          disabled={!valid || isSaving}
          onClick={() => save(draft)}
        >
          Save
        </Button>
      </div>
    </div>
  )
}

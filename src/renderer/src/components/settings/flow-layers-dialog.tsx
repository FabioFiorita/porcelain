import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { ChevronDown, ChevronUp, Plus, Settings2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Layer } from '../../../../main/flow'

const patternError = (pattern: string): string | null => {
  if (pattern.trim() === '') return 'pattern is required'
  try {
    new RegExp(pattern)
    return null
  } catch {
    return 'invalid regular expression'
  }
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
        className="w-32 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <Input
          value={layer.pattern}
          onChange={(e) => onChange({ ...layer, pattern: e.target.value })}
          placeholder="Pattern (regex)"
          aria-label={`Layer ${index + 1} pattern`}
          aria-invalid={error !== null}
          className="font-mono text-xs"
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

export function FlowLayersDialog(): React.JSX.Element | null {
  const repo = useRepoStore((s) => s.repo)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DraftLayer[]>([])
  const utils = trpc.useUtils()
  const { data } = trpc.repoLayers.useQuery(repo?.path ?? '', {
    enabled: open && repo !== null,
  })
  const saveMutation = trpc.setRepoLayers.useMutation()

  // seed the draft from the saved layers each time the dialog opens
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
    await saveMutation.mutateAsync({
      repoPath: repo.path,
      layers: layers?.map(({ label, pattern }) => ({ label, pattern })) ?? null,
    })
    await Promise.all([utils.repoLayers.invalidate(), utils.gitFlow.invalidate()])
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="app-no-drag"
            aria-label="Review flow settings"
          >
            <Settings2 />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review flow layers</DialogTitle>
          <DialogDescription>
            Changed files are grouped into these layers, top to bottom, so a diff reads as a story
            from entry point to data. Saved for this repository only.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          <p>
            Each pattern is a regular expression tested against the repo-relative path. When several
            match, the one matching furthest right wins, and unmatched files land in “Other”.
            Directory layers look like <code className="font-mono">(^|/)components?/</code> while
            filename layers like <code className="font-mono">{'\\.(test|spec)\\.[a-z]+$'}</code>{' '}
            beat the folder the file sits in. Example: give Storybook files their own group with a{' '}
            <span className="text-foreground">Stories</span> layer matching{' '}
            <code className="font-mono">{'\\.stories\\.[a-z]+$'}</code> — otherwise they sort into
            the layer of their folder.
          </p>
        </div>
        <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto pr-1">
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
            className="self-start"
            onClick={() => setDraft([...draft, { label: '', pattern: '', id: nextDraftId++ }])}
          >
            <Plus /> Add layer
          </Button>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => save(null)}>
            Reset to defaults
          </Button>
          <Button size="sm" disabled={!valid || saveMutation.isLoading} onClick={() => save(draft)}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

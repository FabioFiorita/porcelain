import { ProviderGlyph } from '@renderer/components/agent/provider-glyph'
import { Button } from '@renderer/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@renderer/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import {
  useAgentModelFavorites,
  useAgentProviders,
  useToggleAgentModelFavorite,
  useUpdateAgentThread,
} from '@renderer/hooks/use-agents'
import { modelChipLabel } from '@renderer/lib/agent-model-label'
import { cn } from '@renderer/lib/utils'
import type { AgentProvider, ModelInfo } from '@shared/agent-protocol'
import { PROVIDER_LABEL } from '@shared/agent-protocol'
import { ChevronsUpDown, Star } from 'lucide-react'
import { useState } from 'react'

const favoriteKey = (provider: AgentProvider, modelId: string): string => `${provider}:${modelId}`

/**
 * The composer's model picker — a Popover over a Command palette. Favorites float to
 * their own group on top; each provider then gets a group (or a dim "not installed"
 * note). A row's star toggles the favorite WITHOUT selecting; the row body selects the
 * model, which also re-points the thread's provider (the model carries its provider).
 */
export function ModelPicker({
  threadId,
  provider,
  model,
  resolvedModel,
}: {
  threadId: string
  provider: AgentProvider
  model: string
  // The CLI-reported model for the session; labels the chip when `model` is '' (CLI default).
  resolvedModel?: string
}): React.JSX.Element {
  const providers = useAgentProviders()
  const favorites = useAgentModelFavorites()
  const { toggle } = useToggleAgentModelFavorite()
  const { update } = useUpdateAgentThread()
  const [open, setOpen] = useState(false)

  const allModels = providers.flatMap((p) => p.models)
  const favoriteSet = new Set(favorites)
  const favoriteModels = allModels.filter((m) => favoriteSet.has(favoriteKey(m.provider, m.id)))

  const select = async (picked: ModelInfo): Promise<void> => {
    setOpen(false)
    await update(threadId, { model: picked.id, provider: picked.provider })
  }

  const renderRow = (m: ModelInfo): React.JSX.Element => {
    const key = favoriteKey(m.provider, m.id)
    const isFavorite = favoriteSet.has(key)
    const isCurrent = m.provider === provider && m.id === model
    return (
      <CommandItem
        key={key}
        value={`${m.provider} ${m.label} ${m.id}`}
        onSelect={() => select(m)}
        className={cn(isCurrent && 'text-foreground')}
      >
        <ProviderGlyph provider={m.provider} className="size-3.5 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{m.label}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={isFavorite ? `Unfavorite ${m.label}` : `Favorite ${m.label}`}
          className="size-5 shrink-0 opacity-70 hover:opacity-100"
          onClick={async (e) => {
            e.preventDefault()
            e.stopPropagation()
            await toggle(key)
          }}
        >
          <Star className={cn(isFavorite && 'fill-current text-foreground')} />
        </Button>
      </CommandItem>
    )
  }

  const label = modelChipLabel(model, resolvedModel, allModels)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label={label}
                  className="max-w-44 gap-1 text-muted-foreground"
                >
                  <ProviderGlyph provider={provider} className="size-3" />
                  <span className="min-w-0 truncate @max-[30rem]/composer:hidden">{label}</span>
                  <ChevronsUpDown className="opacity-60 @max-[30rem]/composer:hidden" />
                </Button>
              }
            />
          }
        />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-72 p-0" side="top">
        <Command>
          <CommandInput placeholder="Search models…" />
          <CommandList className="max-h-80">
            <CommandEmpty>No models found.</CommandEmpty>
            {favoriteModels.length > 0 && (
              <CommandGroup heading="Favorites">{favoriteModels.map(renderRow)}</CommandGroup>
            )}
            {providers.map((p) => (
              <CommandGroup key={p.provider} heading={PROVIDER_LABEL[p.provider]}>
                {p.installed && p.models.length > 0 ? (
                  p.models.map(renderRow)
                ) : (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground/60">
                    {p.installed ? 'No models reported' : 'Not installed'}
                  </div>
                )}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

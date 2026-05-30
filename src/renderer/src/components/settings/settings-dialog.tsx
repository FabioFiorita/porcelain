import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@renderer/components/ui/dialog'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@renderer/components/ui/sidebar'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { type DiffMode, type MarkdownMode, usePreferencesStore } from '@renderer/stores/preferences'
import { Layers, Settings2, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { FlowLayersSection } from './flow-layers-section'

type SectionId = 'general' | 'flow'

const SECTIONS: { id: SectionId; label: string; icon: typeof Layers }[] = [
  { id: 'general', label: 'General', icon: SlidersHorizontal },
  { id: 'flow', label: 'Review flow', icon: Layers },
]

function PreferenceRow({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

function GeneralSection(): React.JSX.Element {
  const diffMode = usePreferencesStore((s) => s.diffMode)
  const setDiffMode = usePreferencesStore((s) => s.setDiffMode)
  const markdownMode = usePreferencesStore((s) => s.markdownMode)
  const setMarkdownMode = usePreferencesStore((s) => s.setMarkdownMode)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-medium">General</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Viewer preferences, saved on this machine.
        </p>
      </div>
      <PreferenceRow label="Diff layout" description="How file diffs are rendered.">
        <ToggleGroup
          value={[diffMode]}
          onValueChange={(value: string[]) => {
            const mode = value[0]
            if (mode === 'unified' || mode === 'split') setDiffMode(mode satisfies DiffMode)
          }}
        >
          <ToggleGroupItem value="unified" size="sm">
            Unified
          </ToggleGroupItem>
          <ToggleGroupItem value="split" size="sm">
            Split
          </ToggleGroupItem>
        </ToggleGroup>
      </PreferenceRow>
      <PreferenceRow label="Markdown" description="Default view when opening markdown files.">
        <ToggleGroup
          value={[markdownMode]}
          onValueChange={(value: string[]) => {
            const mode = value[0]
            if (mode === 'reader' || mode === 'source') setMarkdownMode(mode satisfies MarkdownMode)
          }}
        >
          <ToggleGroupItem value="reader" size="sm">
            Reader
          </ToggleGroupItem>
          <ToggleGroupItem value="source" size="sm">
            Source
          </ToggleGroupItem>
        </ToggleGroup>
      </PreferenceRow>
    </div>
  )
}

export function SettingsDialog(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<SectionId>('general')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="app-no-drag" aria-label="Settings">
            <Settings2 />
          </Button>
        }
      />
      <DialogContent className="overflow-hidden p-0 sm:max-w-3xl">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          App preferences and repository settings.
        </DialogDescription>
        <SidebarProvider
          shortcut={null}
          className="min-h-0 items-start"
          style={{ '--sidebar-width': '11rem' } as React.CSSProperties}
        >
          <Sidebar collapsible="none" className="h-[480px] border-r">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {SECTIONS.map((s) => (
                      <SidebarMenuItem key={s.id}>
                        <SidebarMenuButton
                          isActive={section === s.id}
                          onClick={() => setSection(s.id)}
                        >
                          <s.icon /> {s.label}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="h-[480px] min-w-0 flex-1 overflow-y-auto p-6">
            {section === 'general' ? (
              <GeneralSection />
            ) : (
              <FlowLayersSection onSaved={() => setOpen(false)} />
            )}
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}

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
import { Bot, Download, Layers, Settings2, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { AgentsSection } from './agents-section'
import { FlowLayersSection } from './flow-layers-section'
import { GeneralSection } from './general-section'
import { UpdatesSection } from './updates-section'

type SectionId = 'general' | 'flow' | 'agents' | 'updates'

// Each section's title + blurb live here so the dialog can render a fixed header
// band (real type hierarchy, always visible) while only the body scrolls — the
// section components render just their controls.
const SECTIONS: {
  id: SectionId
  label: string
  icon: typeof Layers
  title: string
  blurb: string
}[] = [
  {
    id: 'general',
    label: 'General',
    icon: SlidersHorizontal,
    title: 'General',
    blurb: 'Viewer preferences, saved on this machine.',
  },
  {
    id: 'flow',
    label: 'Review flow',
    icon: Layers,
    title: 'Review flow layers',
    blurb: 'Group changed files into a story, entry point to data. Saved per repository.',
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: Bot,
    title: 'Agents',
    blurb: 'Connect Porcelain to the coding agent you drive it from.',
  },
  {
    id: 'updates',
    label: 'Updates',
    icon: Download,
    title: 'Updates',
    blurb: 'Porcelain checks automatically and installs on quit.',
  },
]

export function SettingsDialog(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<SectionId>('general')
  const active = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="app-no-drag size-10 text-muted-foreground [&_svg]:size-5"
            aria-label="Settings"
          >
            <Settings2 />
          </Button>
        }
      />
      <DialogContent className="overflow-hidden p-0 sm:max-w-[960px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          App preferences and repository settings.
        </DialogDescription>
        <SidebarProvider
          shortcut={null}
          className="min-h-0 items-start"
          style={{ '--sidebar-width': '14rem' } as React.CSSProperties}
        >
          <Sidebar collapsible="none" className="h-[600px] border-r">
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
          <div className="flex h-[600px] min-w-0 flex-1 flex-col">
            {/* Fixed header band — the section title/blurb stay put so a long
                scroll never slides row controls up next to the dialog close X. */}
            <header className="shrink-0 border-b px-6 py-4 pr-12">
              <h2 className="text-lg font-semibold tracking-tight">{active.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{active.blurb}</p>
            </header>
            <main className="min-h-0 flex-1 overflow-y-auto p-6">
              {section === 'general' && <GeneralSection />}
              {section === 'flow' && <FlowLayersSection onSaved={() => setOpen(false)} />}
              {section === 'agents' && <AgentsSection />}
              {section === 'updates' && <UpdatesSection />}
            </main>
          </div>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}

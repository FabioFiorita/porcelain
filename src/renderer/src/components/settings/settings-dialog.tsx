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
import { Blocks, Layers, Settings2, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { FlowLayersSection } from './flow-layers-section'
import { GeneralSection } from './general-section'
import { PluginSection } from './plugin-section'

type SectionId = 'general' | 'flow' | 'plugin'

const SECTIONS: { id: SectionId; label: string; icon: typeof Layers }[] = [
  { id: 'general', label: 'General', icon: SlidersHorizontal },
  { id: 'flow', label: 'Review flow', icon: Layers },
  { id: 'plugin', label: 'Claude Code plugin', icon: Blocks },
]

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
            {section === 'general' && <GeneralSection />}
            {section === 'flow' && <FlowLayersSection onSaved={() => setOpen(false)} />}
            {section === 'plugin' && <PluginSection />}
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}

import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
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
import { isBrowser } from '@renderer/lib/platform'
import { type SettingsSection, useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { TestIds } from '@shared/test-ids'
import { Bot, Download, Layers, Network, Settings2, SlidersHorizontal } from 'lucide-react'
import { AgentsSection } from './agents-section'
import { EnvironmentsSection } from './environments-section'
import { FlowLayersSection } from './flow-layers-section'
import { GeneralSection } from './general-section'
import { UpdatesSection } from './updates-section'

// Each section's title + blurb live here so the dialog can render a fixed header
// band (real type hierarchy, always visible) while only the body scrolls — the
// section components render just their controls.
const ALL_SECTIONS: {
  id: SettingsSection
  label: string
  icon: typeof Layers
  title: string
  blurb: string
  // Drives shell-only procedures (plugin/codex install, the Electron auto-updater),
  // so it's hidden in the browser client — there's no shell to run them.
  shellOnly?: boolean
}[] = [
  {
    id: 'general',
    label: 'General',
    icon: SlidersHorizontal,
    title: 'General',
    blurb: 'Viewer preferences, saved on this machine.',
  },
  {
    id: 'environments',
    label: 'Environments',
    icon: Network,
    title: 'Environments',
    blurb: 'Share this daemon and bind windows to remote machines.',
  },
  {
    id: 'flow',
    label: 'Review',
    icon: Layers,
    title: 'Review layers',
    blurb: 'Group changed files into a story, entry point to data. Saved per repository.',
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: Bot,
    title: 'Agents',
    blurb: 'Connect Porcelain to the coding agent you drive it from.',
    shellOnly: true,
  },
  {
    id: 'updates',
    label: 'Updates',
    icon: Download,
    title: 'Updates',
    blurb: 'Porcelain checks automatically and installs on quit.',
    shellOnly: true,
  },
]

const SECTIONS = ALL_SECTIONS.filter((s) => !(isBrowser && s.shellOnly))

/**
 * Gear that opens Settings via the store. Used from the sidebar rail and the
 * welcome screen — the dialog itself is mounted once in AppShell so both paths
 * share one instance (and the welcome screen can reach Remote daemons without
 * opening a repo first).
 */
export function SettingsButton({
  className,
  'data-testid': dataTestId,
}: {
  className?: string
  'data-testid'?: string
}): React.JSX.Element {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label="Settings"
      data-testid={dataTestId}
      onClick={() => useSettingsDialogStore.getState().openTo()}
    >
      <Settings2 />
    </Button>
  )
}

/**
 * The Settings dialog body — store-driven open state, no trigger. Mounted once
 * in AppShell (welcome + repo shell both need it; remote-daemon disconnect lives
 * here and must stay reachable when no repo is open).
 */
export function SettingsDialog(): React.JSX.Element {
  const open = useSettingsDialogStore((s) => s.open)
  const setOpen = useSettingsDialogStore((s) => s.setOpen)
  const section = useSettingsDialogStore((s) => s.section)
  const setSection = useSettingsDialogStore((s) => s.setSection)
  // A persisted section that's hidden in this client (e.g. 'updates' opened in
  // Electron, then the same prefs viewed in a browser) falls back to General so
  // the header and body never disagree.
  const active = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]
  const activeId = active.id

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        data-testid={TestIds.settingsDialog}
        className="max-h-[min(600px,90dvh)] overflow-hidden p-0 sm:max-w-[960px]"
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          App preferences and repository settings.
        </DialogDescription>
        <SidebarProvider
          shortcut={null}
          className="min-h-0 min-w-0 items-start overflow-hidden"
          style={{ '--sidebar-width': '14rem' } as React.CSSProperties}
        >
          {/* Fixed 600px overflowed small phone viewports; cap to the dialog's max-h. */}
          <Sidebar collapsible="none" className="h-[min(600px,90dvh)] shrink-0 border-r">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {SECTIONS.map((s) => (
                      <SidebarMenuItem key={s.id}>
                        <SidebarMenuButton
                          isActive={section === s.id}
                          onClick={() => setSection(s.id)}
                          className="text-sm-minus"
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
          <div className="flex h-[min(600px,90dvh)] min-w-0 flex-1 flex-col overflow-hidden">
            {/* Fixed header band — the section title/blurb stay put so a long
                scroll never slides row controls up next to the dialog close X. */}
            <header className="shrink-0 border-b px-6 py-4 pr-12">
              <h2
                data-testid={TestIds.settingsHeading}
                className="text-base font-semibold tracking-tight"
              >
                {active.title}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">{active.blurb}</p>
            </header>
            <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-6">
              {activeId === 'general' && <GeneralSection />}
              {activeId === 'environments' && <EnvironmentsSection />}
              {activeId === 'flow' && <FlowLayersSection onSaved={() => setOpen(false)} />}
              {activeId === 'agents' && <AgentsSection />}
              {activeId === 'updates' && <UpdatesSection />}
            </main>
          </div>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}

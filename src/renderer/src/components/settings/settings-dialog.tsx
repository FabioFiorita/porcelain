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
import { useIsMobile } from '@renderer/hooks/use-mobile'
import { isBrowser } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { type SettingsSection, useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { TestIds } from '@shared/test-ids'
import {
  BookOpen,
  Cloud,
  Download,
  Layers,
  Settings2,
  Share2,
  SlidersHorizontal,
} from 'lucide-react'
import { CompanionSection } from './companion-section'
import { FlowLayersSection } from './flow-layers-section'
import { GeneralSection } from './general-section'
import { RemotesSection } from './remotes-section'
import { ShareSection } from './share-section'
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
  // Drives shell-only procedures (plugin/codex install, the Electron auto-updater,
  // remote-daemon.json), so it's hidden in the browser client — no shell there.
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
    id: 'companion',
    label: 'Companion',
    icon: BookOpen,
    title: 'Companion',
    blurb: 'Install and upgrade the porcelain-companion skill for your coding agents.',
    shellOnly: true,
  },
  {
    id: 'share',
    label: 'Share',
    icon: Share2,
    title: 'Share',
    blurb: 'Let other devices reach this daemon. One URL and one token is enough.',
  },
  {
    id: 'remotes',
    label: 'Remotes',
    icon: Cloud,
    title: 'Remotes',
    blurb: 'Each window can use a different daemon. Add one with its share URL and token.',
    shellOnly: true,
  },
  {
    id: 'flow',
    label: 'Review',
    icon: Layers,
    title: 'Review layers',
    blurb:
      'Agent-managed grouping for this tree. Starts with Docs + Agents; product code is Other until configured.',
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
 * share one instance (and the welcome screen can reach Remotes without opening
 * a repo first).
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
 * in AppShell (welcome + repo shell both need it; remote disconnect lives here
 * and must stay reachable when no repo is open).
 *
 * Phone layout (≤767px): horizontal section chips + full-width body. The desktop
 * dual-pane (14rem nav rail + body) left only ~200px for controls on iPhone, so
 * labels and toggle groups collided. Desktop keeps the side nav.
 */
export function SettingsDialog(): React.JSX.Element {
  const open = useSettingsDialogStore((s) => s.open)
  const setOpen = useSettingsDialogStore((s) => s.setOpen)
  const section = useSettingsDialogStore((s) => s.section)
  const setSection = useSettingsDialogStore((s) => s.setSection)
  const isMobile = useIsMobile()
  // A section that's hidden in this client (e.g. 'updates' opened in Electron, then
  // the same prefs viewed in a browser) — or one that no longer exists at all (a
  // section id kept from an older build, like the removed 'environments' panel) —
  // falls back to General so the header and body never disagree.
  const active = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]
  const activeId = active.id

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        data-testid={TestIds.settingsDialog}
        className={cn(
          'overflow-hidden p-0',
          // Phone: nearly full viewport (safe for status bar / home indicator via dvh).
          // Desktop: wide dual-pane card, capped height.
          isMobile
            ? 'top-auto bottom-0 left-0 right-0 max-h-[min(92dvh,100%)] w-full max-w-none translate-x-0 translate-y-0 rounded-b-none sm:max-w-none'
            : 'max-h-[min(600px,90dvh)] sm:max-w-[960px]',
        )}
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          App preferences and repository settings.
        </DialogDescription>
        {isMobile ? (
          <div className="flex max-h-[min(92dvh,100%)] min-h-0 flex-col overflow-hidden">
            <nav
              aria-label="Settings sections"
              className="shrink-0 overflow-x-auto border-b px-3 py-2 pr-12"
            >
              <div className="flex w-max gap-1">
                {SECTIONS.map((s) => {
                  const selected = activeId === s.id
                  return (
                    <Button
                      key={s.id}
                      type="button"
                      variant={selected ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 shrink-0 gap-1.5 text-xs"
                      aria-current={selected ? 'page' : undefined}
                      onClick={() => setSection(s.id)}
                    >
                      <s.icon className="size-3.5" />
                      {s.label}
                    </Button>
                  )
                })}
              </div>
            </nav>
            <header className="shrink-0 border-b px-4 py-3">
              <h2
                data-testid={TestIds.settingsHeading}
                className="text-base font-semibold tracking-tight"
              >
                {active.title}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">{active.blurb}</p>
            </header>
            <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
              <SettingsSectionBody activeId={activeId} onFlowSaved={() => setOpen(false)} />
            </main>
          </div>
        ) : (
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
                <SettingsSectionBody activeId={activeId} onFlowSaved={() => setOpen(false)} />
              </main>
            </div>
          </SidebarProvider>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SettingsSectionBody({
  activeId,
  onFlowSaved,
}: {
  activeId: SettingsSection
  onFlowSaved: () => void
}): React.JSX.Element {
  return (
    <>
      {activeId === 'general' && <GeneralSection />}
      {activeId === 'companion' && <CompanionSection />}
      {activeId === 'share' && <ShareSection />}
      {activeId === 'remotes' && <RemotesSection />}
      {activeId === 'flow' && <FlowLayersSection onSaved={onFlowSaved} />}
      {activeId === 'updates' && <UpdatesSection />}
    </>
  )
}

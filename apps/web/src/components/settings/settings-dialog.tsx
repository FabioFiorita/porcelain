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
import { useRemoteEnvironments } from '@renderer/features/remote'
import { useIsMobile } from '@renderer/hooks/use-mobile'
import { isBrowser } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { type SettingsSection, useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { TestIds } from '@shared/test-ids'
import { BookOpen, Cloud, Download, Settings2, Share2, SlidersHorizontal } from 'lucide-react'
import { CompanionSection } from './companion-section'
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
  icon: typeof SlidersHorizontal
  title: string
  blurb: string
  // Shell-only: Companion (skills install) and Updates (electron-updater). Remotes has a
  // browser-owned connection manager as well as the Electron pairing surface.
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
    // Shell-only now that the repo half lives under Data: all that is left is the
    // skill installer, which writes into agent homes on THIS machine.
    blurb: 'The porcelain-companion skill for your agents.',
    shellOnly: true,
  },
  {
    id: 'share',
    label: 'Share',
    icon: Share2,
    title: 'Share',
    blurb: 'Share this daemon over LAN, then Tailscale or Cloudflare. Pair and revoke devices.',
  },
  {
    id: 'remotes',
    label: 'Remotes',
    icon: Cloud,
    title: 'Remotes',
    blurb: 'Mac: several named environments. Browser: this tab is this daemon.',
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

/**
 * Gear that opens Settings via the store. Used from the sidebar rail and the
 * welcome screen — the dialog itself is mounted once in AppShell so both paths
 * share one instance (and the welcome screen can reach Remotes without opening
 * a repo first).
 */
export function SettingsButton({
  className,
  showLabel = false,
  'data-testid': dataTestId,
}: {
  className?: string
  showLabel?: boolean
  'data-testid'?: string
}): React.JSX.Element {
  return (
    <Button
      variant="ghost"
      size={showLabel ? 'default' : 'icon'}
      className={className}
      aria-label="Settings"
      data-testid={dataTestId}
      onClick={() => useSettingsDialogStore.getState().openTo()}
    >
      <Settings2 />
      {showLabel && <span>Settings</span>}
    </Button>
  )
}

/**
 * The Settings dialog body — store-driven open state, no trigger. Mounted once in
 * AppShell so remote disconnect stays reachable with no repo open.
 *
 * Phone (≤767px): horizontal section chips + full-width body — the desktop dual-pane
 * (14rem nav rail + body) left too little width for controls. Desktop keeps the side nav.
 */
export function SettingsDialog(): React.JSX.Element | null {
  const open = useSettingsDialogStore((s) => s.open)
  const setOpen = useSettingsDialogStore((s) => s.setOpen)
  const section = useSettingsDialogStore((s) => s.section)
  const setSection = useSettingsDialogStore((s) => s.setSection)
  const isMobile = useIsMobile()
  const remotes = useRemoteEnvironments()
  const sections = ALL_SECTIONS.filter((candidate) => {
    if (isBrowser) return candidate.shellOnly !== true && candidate.id !== 'share'
    if (candidate.id === 'share') return remotes?.activeId === null
    return true
  })
  // A section that's hidden in this surface (e.g. 'updates' opened in Electron, then
  // the same prefs viewed in a browser) falls back to General so the header and body
  // never disagree.
  const active = sections.find((s) => s.id === section) ?? sections[0]
  if (active === undefined) return null
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
            ? 'top-auto bottom-0 left-0 right-0 h-[min(92dvh,100%)] max-h-none w-full max-w-none translate-x-0 translate-y-0 rounded-b-none sm:max-w-none'
            : 'max-h-[min(600px,90dvh)] sm:max-w-[960px]',
        )}
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          App preferences and repository settings.
        </DialogDescription>
        {isMobile ? (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <nav
              aria-label="Settings sections"
              className="shrink-0 overflow-x-auto border-b px-3 py-2 pr-12"
            >
              <div className="flex w-max gap-1">
                {sections.map((s) => {
                  const selected = activeId === s.id
                  return (
                    <Button
                      key={s.id}
                      type="button"
                      variant={selected ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 shrink-0 gap-1.5 text-xs"
                      aria-current={selected ? 'page' : undefined}
                      data-testid={TestIds.settingsSection(s.id)}
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
            <main className="min-h-0 min-w-0 flex-1 overscroll-contain overflow-x-hidden overflow-y-auto p-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
              <SettingsSectionBody activeId={activeId} />
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
                    <SidebarMenu className="gap-1 px-2">
                      {sections.map((s) => (
                        <SidebarMenuItem key={s.id}>
                          <SidebarMenuButton
                            isActive={activeId === s.id}
                            data-testid={TestIds.settingsSection(s.id)}
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
              <main className="min-h-0 min-w-0 flex-1 overscroll-contain overflow-x-hidden overflow-y-auto p-6 pb-10">
                <SettingsSectionBody activeId={activeId} />
              </main>
            </div>
          </SidebarProvider>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SettingsSectionBody({ activeId }: { activeId: SettingsSection }): React.JSX.Element {
  return (
    <>
      {activeId === 'general' && <GeneralSection />}
      {activeId === 'companion' && <CompanionSection />}
      {activeId === 'share' && <ShareSection />}
      {activeId === 'remotes' && <RemotesSection />}
      {activeId === 'updates' && <UpdatesSection />}
    </>
  )
}

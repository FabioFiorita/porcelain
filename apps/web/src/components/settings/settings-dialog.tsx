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
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@renderer/components/ui/sidebar'
import { useEnvironmentName } from '@renderer/hooks/use-daemon-identity'
import { useIsMobile } from '@renderer/hooks/use-mobile'
import { isBrowser } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { type SettingsSection, useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { TestIds } from '@shared/test-ids'
import {
  BookOpen,
  Cloud,
  Download,
  Focus,
  Settings2,
  Share2,
  SlidersHorizontal,
} from 'lucide-react'
import { CompanionSection } from './companion-section'
import { GeneralSection } from './general-section'
import { PersonalizationSection } from './personalization-section'
import { RemotesSection } from './remotes-section'
import { ShareSection } from './share-section'
import { UpdatesSection } from './updates-section'

/**
 * WHERE a section's settings live. Every complaint this grouping answers was the same one:
 * a preference read as global when it belonged to one machine, or to one repository.
 *
 * - `app`      this copy of Porcelain, on this machine. Nothing follows you to another one.
 * - `environment` a daemon: its identity, what it shares, which one this window is on.
 * - `project`  one repository's own state, wherever that repository lives.
 */
type SettingsScope = 'app' | 'environment' | 'project'

/** Nav group headings — plural, because a group heads a list. */
const SCOPE_LABEL: Record<SettingsScope, string> = {
  app: 'This app',
  environment: 'Environments',
  project: 'Project',
}

/** Header eyebrow — singular, because it names the ONE thing this page is about. */
const SCOPE_EYEBROW: Record<SettingsScope, string> = {
  app: 'This app',
  environment: 'Environment',
  project: 'Project',
}

/** Nav order. Widest scope first: the app you are in, the machines it reaches, the repo. */
const SCOPE_ORDER: SettingsScope[] = ['app', 'environment', 'project']

// Each section's title + blurb live here so the dialog can render a fixed header
// band (real type hierarchy, always visible) while only the body scrolls — the
// section components render just their controls.
const ALL_SECTIONS: {
  id: SettingsSection
  label: string
  icon: typeof SlidersHorizontal
  title: string
  blurb: string
  scope: SettingsScope
  // Shell-only: Companion, Updates, and Environments (named environments live in the Mac app).
  // The browser tab is already one daemon; pairing is the link, not a settings tab.
  shellOnly?: boolean
}[] = [
  {
    id: 'general',
    label: 'General',
    icon: SlidersHorizontal,
    title: 'General',
    scope: 'app',
    blurb: 'How this app looks and reads. Saved on this machine, for every Environment.',
  },
  {
    id: 'companion',
    label: 'Companion',
    icon: BookOpen,
    title: 'Companion',
    scope: 'app',
    // Shell-only now that the repo half lives under Data: all that is left is the
    // skill installer, which writes into agent homes on THIS machine.
    blurb: 'The porcelain-companion skill for the agents on this machine.',
    shellOnly: true,
  },
  {
    id: 'updates',
    label: 'Updates',
    icon: Download,
    title: 'Updates',
    scope: 'app',
    blurb: 'Porcelain checks automatically and installs on quit.',
    shellOnly: true,
  },
  {
    id: 'remotes',
    label: 'Environments',
    icon: Cloud,
    title: 'Environments',
    scope: 'environment',
    blurb: 'Every daemon this app can reach. Name one, open a window on it, pair another.',
    shellOnly: true,
  },
  {
    id: 'share',
    label: 'Share',
    icon: Share2,
    title: 'Share',
    scope: 'environment',
    blurb: 'Share a daemon over LAN, then Tailscale or Cloudflare. Pair and revoke devices.',
  },
  {
    id: 'personalization',
    label: 'Personalization',
    icon: Focus,
    title: 'Personalization',
    scope: 'project',
    // Not shell-only: the profile is daemon state, and the browser renders it
    // as well as Electron does.
    blurb: 'What this project pins, hides, and the order your changes read in.',
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
  const environmentName = useEnvironmentName()
  const projectName = useProjectSelectionStore((s) => s.project?.name ?? null)
  // The browser tab IS one daemon: it cannot reach another, and it cannot administer the one
  // it is on with a paired token. Every Environment-wide section is therefore Electron's.
  const sections = ALL_SECTIONS.filter((candidate) =>
    isBrowser ? candidate.shellOnly !== true && candidate.id !== 'share' : true,
  )
  // A section that's hidden in this surface (e.g. 'updates' opened in Electron, then
  // the same prefs viewed in a browser) falls back to General so the header and body
  // never disagree.
  const active = sections.find((s) => s.id === section) ?? sections[0]
  if (active === undefined) return null
  const activeId = active.id
  // The eyebrow names the scope AND the thing in it. "Project" alone answers half the
  // question a reader of a settings page actually has: which project?
  const subject =
    active.scope === 'environment' && active.id === 'share'
      ? environmentName
      : active.scope === 'project'
        ? projectName
        : null
  const eyebrow =
    subject === null ? SCOPE_EYEBROW[active.scope] : `${SCOPE_EYEBROW[active.scope]} · ${subject}`

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
              <p
                data-testid={TestIds.settingsScope}
                className="text-2xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                {eyebrow}
              </p>
              <h2
                data-testid={TestIds.settingsHeading}
                className="mt-0.5 text-base font-semibold tracking-tight"
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
                {/* Grouped by scope, not by theme: the group a section sits in is the answer
                    to "where does this setting live", which is the question every one of
                    these pages was previously silent about. */}
                {SCOPE_ORDER.map((scope) => {
                  const grouped = sections.filter((s) => s.scope === scope)
                  if (grouped.length === 0) return null
                  return (
                    <SidebarGroup key={scope}>
                      <SidebarGroupLabel className="px-4">{SCOPE_LABEL[scope]}</SidebarGroupLabel>
                      <SidebarGroupContent>
                        <SidebarMenu className="gap-1.5 px-2">
                          {grouped.map((s) => (
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
                  )
                })}
              </SidebarContent>
            </Sidebar>
            <div className="flex h-[min(600px,90dvh)] min-w-0 flex-1 flex-col overflow-hidden">
              {/* Fixed header band — the section title/blurb stay put so a long
                  scroll never slides row controls up next to the dialog close X. */}
              <header className="shrink-0 border-b px-6 py-4 pr-12">
                <p
                  data-testid={TestIds.settingsScope}
                  className="text-2xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {eyebrow}
                </p>
                <h2
                  data-testid={TestIds.settingsHeading}
                  className="mt-0.5 text-base font-semibold tracking-tight"
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
      {activeId === 'personalization' && <PersonalizationSection />}
      {activeId === 'companion' && <CompanionSection />}
      {activeId === 'share' && <ShareSection />}
      {activeId === 'remotes' && <RemotesSection />}
      {activeId === 'updates' && <UpdatesSection />}
    </>
  )
}

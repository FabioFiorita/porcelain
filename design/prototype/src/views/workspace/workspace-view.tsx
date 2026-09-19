import { useHotkey } from '@tanstack/react-hotkeys';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { FolderGit2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  firstWaitingWorktree,
  selectedWorktreeInProject,
  worktreeLabel,
} from '../../domain/inventory';
import { useInventory } from '../../query/inventory';
import { ReviewWorkspace } from '../review/review-workspace';
import { OpenProjectDialog } from './open-project-dialog';
import { PanelToggle } from './panel-toggle';
import { usePreferences } from './preferences';
import { ProjectNavigator } from './project-navigator';
import { QuickOpen } from './quick-open';
import { SettingsDialog } from './settings-dialog';
import { SHORTCUTS } from './shortcuts';
import { ShortcutsDialog } from './shortcuts-dialog';
import { PHONE_QUERY, useMediaQuery } from './use-media-query';

const HANDLE = 'w-2! bg-transparent! after:w-2! focus-visible:ring-0';

export function WorkspaceView() {
  const search = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const inventory = useInventory();
  const { preferences, setPreference } = usePreferences();

  // As in apps/web: at phone width the navigator floats over the document, with an
  // open state of its own, so the choice made on a wide window survives the trip.
  const phone = useMediaQuery(PHONE_QUERY);
  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const [floatingOpen, setFloatingOpen] = useState(false);
  // It starts closed each time the window narrows to a phone (state adjusted while rendering).
  const [wasPhone, setWasPhone] = useState(phone);
  if (phone !== wasPhone) {
    setWasPhone(phone);
    setFloatingOpen(false);
  }
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigatorToggle = useRef<HTMLButtonElement>(null);
  const [openProject, setOpenProject] = useState(false);
  const [settings, setSettings] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);

  const selection = selectedWorktreeInProject(inventory, search.worktree);

  // Picking another worktree in the phone slide-over remounts the review, and with it the
  // toggle focus would return to. Focus goes to the new toggle when it mounts, which can
  // be after the new worktree's first reads.
  const [picked, setPicked] = useState<string | null>(null);
  const selectedId = selection?.worktree.id;
  const attachNavigatorToggle = (element: HTMLButtonElement | null) => {
    navigatorToggle.current = element;
    if (element == null || picked == null || picked !== selectedId) return;
    element.focus();
    setPicked(null);
  };

  // The URL is the selection. With none (or a stale one), land on whatever is waiting.
  useEffect(() => {
    if (selection != null) return;
    const fallback = firstWaitingWorktree(inventory);
    if (fallback != null)
      void navigate({ search: { worktree: fallback.id }, replace: true });
  }, [selection, inventory, navigate]);

  const toggleNavigator = () => {
    if (phone) {
      // A new opening: the next close returns focus to this toggle again.
      setPicked(null);
      setFloatingOpen((open) => !open);
      return;
    }
    // Hidden by shortcut, the navigator could take focus with it; the toggle keeps it.
    if (navigatorOpen) navigatorToggle.current?.focus();
    setNavigatorOpen((open) => !open);
  };
  const navigatorButton = (
    <PanelToggle
      ref={attachNavigatorToggle}
      side="left"
      label="Projects"
      expanded={phone ? floatingOpen : navigatorOpen}
      overlay={phone}
      shortcut={SHORTCUTS.toggleNavigator}
      onToggle={toggleNavigator}
    />
  );
  const pickFromSlideOver = (worktreeId: string) => {
    setPicked(worktreeId === selection?.worktree.id ? null : worktreeId);
    setFloatingOpen(false);
  };
  const projectNavigator = (onSelect?: (worktreeId: string) => void) => (
    <ProjectNavigator
      inventory={inventory}
      selectedWorktreeId={selection?.worktree.id}
      onSelect={onSelect}
      onOpenProject={() => setOpenProject(true)}
      onOpenSettings={() => setSettings(true)}
      onOpenShortcuts={() => setShortcuts(true)}
    />
  );

  useHotkey(SHORTCUTS.toggleNavigator, toggleNavigator, { ignoreInputs: true });
  useHotkey(SHORTCUTS.openSettings, () => setSettings(true), {
    ignoreInputs: true,
  });
  useHotkey(SHORTCUTS.openShortcuts, () => setShortcuts(true), {
    ignoreInputs: true,
  });
  useHotkey(
    SHORTCUTS.cycleAppearance,
    () => {
      const order = ['system', 'light', 'dark'] as const;
      setPreference(
        'appearance',
        order[(order.indexOf(preferences.appearance) + 1) % order.length],
      );
    },
    { ignoreInputs: true },
  );

  return (
    <>
      <div className="h-svh bg-muted p-2 text-[13px] text-foreground">
        <ResizablePanelGroup orientation="horizontal">
          {!phone && navigatorOpen && (
            <>
              <ResizablePanel
                id="navigator"
                defaultSize={264}
                minSize={220}
                maxSize={420}
              >
                {projectNavigator()}
              </ResizablePanel>
              <ResizableHandle className={HANDLE} />
            </>
          )}

          {selection == null ? (
            <ResizablePanel id="document" minSize={phone ? 0 : 420}>
              <div className="relative grid h-full place-items-center rounded-xl border bg-card p-8">
                <div className="absolute top-1.5 left-1.5">
                  {navigatorButton}
                </div>
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia>
                      <FolderGit2 className="size-6 text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyTitle>No project open</EmptyTitle>
                    <EmptyDescription>
                      Open a repository and its worktrees appear on the left.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button onClick={() => setOpenProject(true)}>
                      Open project
                    </Button>
                  </EmptyContent>
                </Empty>
              </div>
            </ResizablePanel>
          ) : (
            <ReviewWorkspace
              key={selection.worktree.id}
              project={selection.project}
              worktree={selection.worktree}
              surface={search.surface ?? 'changes'}
              entry={search.entry}
              side={search.side}
              phone={phone}
              navigatorToggle={navigatorButton}
              sidebarOpen={sidebarOpen}
              onSidebarOpenChange={setSidebarOpen}
              handleClassName={HANDLE}
            />
          )}
        </ResizablePanelGroup>
      </div>

      {phone && (
        <Sheet open={floatingOpen} onOpenChange={setFloatingOpen}>
          <SheetContent
            side="left"
            finalFocus={() =>
              picked == null ? navigatorToggle.current : false
            }
            showCloseButton={false}
            className="w-[min(85vw,18rem)]! gap-0 bg-transparent p-2 shadow-none data-[side=left]:border-r-0"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Projects</SheetTitle>
              <SheetDescription>Pick a worktree to review.</SheetDescription>
            </SheetHeader>
            {/* Picking a worktree is why it was opened, so it closes. */}
            {projectNavigator(pickFromSlideOver)}
          </SheetContent>
        </Sheet>
      )}

      {selection != null && (
        <QuickOpen
          key={selection.worktree.id}
          scope={{
            projectId: selection.project.id,
            worktreeId: selection.worktree.id,
          }}
          worktreeName={worktreeLabel(selection.worktree.branch)}
        />
      )}
      <OpenProjectDialog open={openProject} onOpenChange={setOpenProject} />
      <SettingsDialog open={settings} onOpenChange={setSettings} />
      <ShortcutsDialog open={shortcuts} onOpenChange={setShortcuts} />
    </>
  );
}

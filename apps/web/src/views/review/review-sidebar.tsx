import {
  FileBoxIcon,
  FilesIcon,
  GitBranchIcon,
  GitCompareArrowsIcon,
  HistoryIcon,
  PanelRightCloseIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ReviewScope, Surface } from '../../domain/review';
import { ArtifactNavigation } from './artifact-navigation';
import { ChangeNavigation } from './change-navigation';
import { FileNavigation } from './file-navigation';
import { gitActions } from './git-action-options';
import { HistoryNavigation } from './history-navigation';
import { ReviewBoundary } from './review-boundary';
import { ReviewEmpty } from './review-empty';
import { ReviewRow } from './review-row';

const surfaceItems = [
  { value: 'changes', label: 'Changes', icon: GitCompareArrowsIcon },
  { value: 'files', label: 'Files', icon: FilesIcon },
  { value: 'history', label: 'History', icon: HistoryIcon },
  { value: 'git', label: 'Git', icon: GitBranchIcon },
  { value: 'artifacts', label: 'Artifacts', icon: FileBoxIcon },
] as const;
export function ReviewSidebar({
  scope,
  surface,
  entry,
  available,
  onSurface,
  onSelect,
  onClose,
}: {
  scope: ReviewScope;
  surface: Surface;
  entry: string;
  available: boolean;
  onSurface: (surface: Surface) => void;
  onSelect: (entry: string) => void;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label="Worktree review"
      className="flex h-full min-h-0 flex-col bg-sidebar"
    >
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <h2 className="text-sm font-medium">Review</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Explore this worktree
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close review sidebar"
          onClick={onClose}
        >
          <PanelRightCloseIcon />
        </Button>
      </div>
      <Tabs
        value={surface}
        onValueChange={(value) => onSurface(value as Surface)}
        className="min-h-0 flex-1 gap-0"
      >
        <TabsList className="mx-3 h-auto! w-auto! gap-0">
          {surfaceItems.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex-col gap-1 px-2 py-2"
            >
              <Icon />
              <span className="text-[10px]">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {surfaceItems.map(({ value }) => (
          <TabsContent
            key={value}
            value={value}
            className="min-h-0 overflow-hidden"
          >
            <ScrollArea className="h-full">
              <div className="px-3 py-5">
                <ReviewBoundary key={`${scope.worktreeId}:${value}`}>
                  {!available && value !== 'artifacts' ? (
                    <ReviewEmpty
                      title="Worktree unavailable"
                      description="Reconnect the checkout and refresh the environment to review its files and Git state."
                    />
                  ) : (
                    <SurfaceNavigation
                      scope={scope}
                      surface={value}
                      entry={entry}
                      onSelect={onSelect}
                    />
                  )}
                </ReviewBoundary>
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
      <div className="border-t px-5 py-3 text-xs text-muted-foreground">
        {available
          ? 'Scoped to selected worktree'
          : 'Stored artifacts remain accessible'}
      </div>
    </aside>
  );
}
function SurfaceNavigation({
  scope,
  surface,
  entry,
  onSelect,
}: {
  scope: ReviewScope;
  surface: Surface;
  entry: string;
  onSelect: (entry: string) => void;
}) {
  const props = { scope, selected: entry, onSelect };
  switch (surface) {
    case 'files':
      return <FileNavigation {...props} path="" />;
    case 'changes':
      return <ChangeNavigation {...props} />;
    case 'history':
      return <HistoryNavigation {...props} />;
    case 'artifacts':
      return <ArtifactNavigation {...props} />;
    case 'git':
      return (
        <div className="flex flex-col gap-2">
          {gitActions.map((action) => (
            <ReviewRow
              key={action.id}
              label={action.label}
              detail={action.description}
              selected={entry === action.id}
              onSelect={() => onSelect(action.id)}
              icon={<action.icon />}
            />
          ))}
          <p className="px-3 pt-3 text-xs leading-relaxed text-muted-foreground">
            Each action starts with preparation. Review its scope before
            confirming.
          </p>
        </div>
      );
  }
}

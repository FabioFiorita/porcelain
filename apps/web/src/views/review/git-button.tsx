import { GitBranchIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { GitAction } from '../../domain/git-action';
import type { ReviewScope } from '../../domain/review';
import { GitActionInspection } from './git-action-inspection';
import { gitActions } from './git-action-options';

/**
 * Git actions are intentionally a control attached to the tab strip. They do
 * not become a fourth navigation surface or a document in the centre.
 */
export function GitButton({ scope }: { scope: ReviewScope }) {
  const [action, setAction] = useState<GitAction | null>(null);
  const selected = gitActions.find((candidate) => candidate.id === action);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Git actions"
              title="Git actions"
            />
          }
        >
          <GitBranchIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Git actions</DropdownMenuLabel>
            {gitActions.map((candidate) => (
              <DropdownMenuItem
                key={candidate.id}
                onClick={() => setAction(candidate.id)}
              >
                <candidate.icon />
                <span>{candidate.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {candidate.description}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={action != null}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
      >
        <DialogContent className="max-h-[min(90svh,48rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.label ?? 'Git action'}</DialogTitle>
            <DialogDescription>
              Prepare and review the operation before confirming it.
            </DialogDescription>
          </DialogHeader>
          {action && <GitActionInspection scope={scope} entry={action} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

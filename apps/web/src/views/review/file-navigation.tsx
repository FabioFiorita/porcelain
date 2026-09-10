import { ChevronRightIcon, FolderIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { ReviewScope } from '../../domain/review';
import { useDirectory } from '../../query/review';
import { ReviewBoundary } from './review-boundary';
import { ReviewEmpty } from './review-empty';
import { ReviewRow } from './review-row';

type Props = {
  scope: ReviewScope;
  path: string;
  selected: string;
  onSelect: (path: string) => void;
};
export function FileNavigation(props: Props) {
  const directory = useDirectory(props.scope, props.path);
  const [limit, setLimit] = useState(100);
  if (!directory.entries.length)
    return (
      <ReviewEmpty
        title="Empty folder"
        description="There are no files in this folder."
      />
    );
  return (
    <ul aria-label={props.path || 'Worktree files'} className="min-w-0">
      {directory.entries.slice(0, limit).map((entry) => {
        const path = props.path ? `${props.path}/${entry.name}` : entry.name;
        return (
          <li key={entry.name}>
            {entry.kind === 'directory' ? (
              <Folder {...props} path={path} name={entry.name} />
            ) : (
              <ReviewRow
                label={entry.name}
                selected={props.selected === path}
                onSelect={() => props.onSelect(path)}
                detail={
                  entry.kind !== 'file'
                    ? `${entry.kind} · preview may be unavailable`
                    : undefined
                }
              />
            )}
          </li>
        );
      })}
      {directory.entries.length > limit && (
        <li>
          <Button
            variant="outline"
            size="sm"
            className="my-3"
            onClick={() => setLimit(limit + 100)}
          >
            Show more files ({directory.entries.length - limit} remaining)
          </Button>
        </li>
      )}
    </ul>
  );
}
function Folder(props: Props & { name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/folder">
      <CollapsibleTrigger
        render={<Button variant="ghost" />}
        className="w-full justify-start gap-2"
      >
        <ChevronRightIcon className="transition-transform group-data-open/folder:rotate-90 motion-reduce:transition-none" />
        <FolderIcon />
        <span className="truncate">{props.name}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-3 border-l pl-2">
          {open && (
            <ReviewBoundary>
              <FileNavigation {...props} />
            </ReviewBoundary>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { Copy, GitCommitHorizontal, TriangleAlert } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { copyText } from '../workspace/copy';
import { FileTypeIcon } from './file-type-icon';
import {
  abortCommand,
  conflictedPaths,
  type Look,
  plural,
} from './git-feedback';
import type { OpenDocument } from './review-workspace';

type Props = {
  anchor: RefObject<HTMLDivElement | null>;
  open: boolean;
  onClose: () => void;
  /** The list of changes, with `inProgress` set. */
  status: Look & { inProgress: 'merge' | 'rebase' };
  /** Opens a conflicted file; without it the files are listed but not links. */
  onOpen?: OpenDocument;
  onCommit: () => void;
};

/**
 * What to do when Git stopped a merge or rebase on a conflict, under the Git button:
 * what happened, the files it waits on, how to finish, and how to back out. Porcelain
 * finishes a merge with a commit; a rebase, and backing out, happen in the agent's
 * session or a terminal, so those commands are there to copy.
 */
export function ConflictGuidance({
  anchor,
  open,
  onClose,
  status,
  onOpen,
  onCommit,
}: Props) {
  const kind = status.inProgress;
  const paths = conflictedPaths(status);
  const upstream = status.branch.upstream ?? 'the upstream';
  const resolved = paths.length === 0;
  const title = resolved
    ? kind === 'merge'
      ? 'Merge ready to commit'
      : 'Rebase waiting to continue'
    : `${kind === 'merge' ? 'Merge' : 'Rebase'} stopped on a conflict`;
  const happened = resolved
    ? 'No file has conflicts any more.'
    : kind === 'merge'
      ? `Your branch and ${upstream} changed the same lines, so Git paused the merge. Nothing is lost.`
      : `Git was replaying your commits onto ${upstream}, and one changed the same lines. It paused the rebase; nothing is lost.`;

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next, details) => {
        // A click on the Git button itself toggles it there, not here.
        const target = details.event?.target;
        if (
          !next &&
          !(target instanceof Node && anchor.current?.contains(target))
        )
          onClose();
      }}
    >
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={anchor}
          side="bottom"
          align="end"
          sideOffset={6}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            // It can open on its own when a pull stops, so it never takes focus from what you were doing.
            initialFocus={false}
            finalFocus={false}
            className="flex w-96 origin-(--transform-origin) flex-col gap-3 rounded-2xl bg-popover p-3 text-[12.5px] text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-hidden duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 dark:ring-foreground/10"
          >
            <div className="flex flex-col gap-1">
              <PopoverPrimitive.Title className="flex items-center gap-2 text-[13px] font-medium">
                <TriangleAlert className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                {title}
              </PopoverPrimitive.Title>
              <PopoverPrimitive.Description className="text-muted-foreground">
                {happened}
              </PopoverPrimitive.Description>
            </div>

            {!resolved && (
              <Step title={`Conflicted · ${plural(paths.length, 'file')}`}>
                <ul className="flex flex-col rounded-xl border p-1">
                  {paths.map((path) => (
                    <li key={path}>
                      {onOpen == null ? (
                        <FileRow path={path} />
                      ) : (
                        <button
                          type="button"
                          title={`Open ${path}`}
                          onClick={() => {
                            onOpen({ kind: 'file', path });
                            onClose();
                          }}
                          className="flex w-full rounded-lg text-left transition-colors hover:bg-muted"
                        >
                          <FileRow path={path} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </Step>
            )}

            <Step title="To finish">
              {kind === 'merge' ? (
                <>
                  <p>
                    {resolved
                      ? 'Commit to finish the merge.'
                      : 'In each file, keep the lines you want and delete the conflict markers (<<<<<<<, =======, >>>>>>>): edit it here, or ask the agent. Then commit to finish the merge.'}
                  </p>
                  <Button size="sm" className="self-start" onClick={onCommit}>
                    <GitCommitHorizontal />
                    Commit…
                  </Button>
                </>
              ) : (
                <>
                  <p>
                    {resolved
                      ? 'Ask the agent to continue the rebase, or run this in a terminal in this worktree:'
                      : 'In each file, keep the lines you want and delete the conflict markers: edit it here, or ask the agent. Then the agent continues the rebase, or you stage the files and run this in a terminal:'}
                  </p>
                  <Command text="git rebase --continue" />
                </>
              )}
            </Step>

            <Step title="To back out">
              <p>
                Puts the branch back as it was before the{' '}
                {kind === 'merge' ? 'pull' : 'rebase'}. Run it in a terminal in
                this worktree:
              </p>
              <Command text={abortCommand(kind)} />
            </Step>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-[11px] font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/** Path truncated from the start, so the file name always shows. */
function FileRow({ path }: { path: string }) {
  return (
    <span className="flex h-7 w-full min-w-0 items-center gap-2 px-2">
      <FileTypeIcon path={path} className="size-4 shrink-0" />
      <span dir="rtl" className="min-w-0 flex-1 truncate text-left">
        <bdi>{path}</bdi>
      </span>
      <span className="shrink-0 text-[11px] text-muted-foreground">
        Conflicted
      </span>
    </span>
  );
}

/** A command to run elsewhere, with Copy. */
function Command({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/50 pl-2.5">
      <code className="min-w-0 flex-1 truncate py-1.5 font-mono text-[11.5px]">
        {text}
      </code>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`Copy ${text}`}
        title="Copy"
        onClick={() => copyText(text, 'command')}
      >
        <Copy />
      </Button>
    </div>
  );
}

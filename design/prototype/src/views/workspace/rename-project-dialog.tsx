import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import type { Project } from '../../domain/inventory';
import { useRenameProject } from '../../query/inventory';
import { reviewErrorMessage } from '../../query/review';
import { DialogIcon } from './dialog-icon';

const MAX_NAME = 100;

/**
 * A project's name starts as the repository name from its `origin` URL (else the
 * folder). Renaming only changes what Porcelain shows; worktree names always come
 * from their branches.
 */
export function RenameProjectDialog({
  project,
  onClose,
}: {
  project: Project | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={project != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-5 sm:max-w-md">
        {/* Keyed so every opening starts from the project's current name. */}
        {project != null && (
          <RenameForm key={project.id} project={project} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const rename = useRenameProject();
  const [name, setName] = useState(project.name);
  const trimmed = name.trim();
  const unchanged = trimmed === project.name;

  const submit = () => {
    if (trimmed === '' || rename.isPending) return;
    if (unchanged) {
      onClose();
      return;
    }
    // The sidebar shows the new name, so success needs no toast; a failure stays in the dialog.
    rename
      .submit({ projectId: project.id, name: trimmed })
      .then(onClose, () => undefined);
  };

  return (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <DialogHeader className="flex-row items-center gap-3 text-left">
        <DialogIcon icon={Pencil} />
        <div className="flex flex-col gap-0.5">
          <DialogTitle>Rename project</DialogTitle>
          <DialogDescription>
            Only the name in Porcelain changes. Folders and branches stay as
            they are.
          </DialogDescription>
        </div>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="project-name" className="text-[12.5px] font-medium">
          Name
        </label>
        <Input
          id="project-name"
          value={name}
          maxLength={MAX_NAME}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          aria-invalid={rename.error != null || undefined}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            setName(event.target.value);
            if (rename.error != null) rename.reset();
          }}
        />
        {rename.error != null && (
          <p role="alert" className="text-[12.5px] text-destructive">
            {reviewErrorMessage(rename.error)}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={trimmed === '' || rename.isPending}>
          {rename.isPending && <Spinner />}
          Rename
        </Button>
      </DialogFooter>
    </form>
  );
}

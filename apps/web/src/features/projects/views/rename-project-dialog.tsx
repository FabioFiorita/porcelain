import { type FormEvent, type RefObject, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import type { Project } from '../inventory';
import { projectPath } from '../inventory';
import { connectionErrorMessage } from '@/features/access/index';
import { useRenameProject } from '../queries/inventory';

export function RenameProjectDialog({
  project,
  onClose,
  finalFocus,
}: {
  project: Project;
  onClose: () => void;
  finalFocus: RefObject<HTMLButtonElement | null>;
}) {
  const rename = useRenameProject();
  const [name, setName] = useState(project.name);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || rename.isPending) return;
    void rename
      .submit({ projectId: project.id, name })
      .then(onClose)
      .catch(() => {});
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !rename.isPending) onClose();
      }}
    >
      <DialogContent finalFocus={finalFocus}>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>
              The name is only a label in this sidebar. Nothing on disk changes,
              and two projects may share one.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              autoFocus
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
            />
            <p className="break-all font-mono text-xs text-muted-foreground">
              {projectPath(project)}
            </p>
          </div>
          {rename.error && (
            <Alert variant="destructive">
              <AlertDescription>
                {connectionErrorMessage(rename.error)}
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={rename.isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || rename.isPending}>
              {rename.isPending && <Spinner />}
              {rename.isPending ? 'Renaming…' : 'Rename'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

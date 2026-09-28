import { useConnectedContext } from '@/app/workspace-provider';
import { Dialog } from '@/components/ui/dialog';
import {
  BranchForm,
  useBranchForm,
  type GitActionStatus,
} from '@/features/git-actions/index';
import type { ReviewScope } from '@/features/reviews/index';

export function BranchDialog({
  scope,
  open,
  mode,
  status,
  onOpenChange,
}: {
  scope: ReviewScope;
  open: boolean;
  mode: 'switch' | 'create';
  status: GitActionStatus;
  onOpenChange: (open: boolean) => void;
}) {
  const form = useBranchForm(scope, mode, status, useConnectedContext(), () =>
    onOpenChange(false),
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !form.busy && onOpenChange(next)}
    >
      <BranchForm mode={mode} status={status} form={form} />
    </Dialog>
  );
}

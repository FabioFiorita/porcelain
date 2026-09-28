import { Dialog } from '@/components/ui/dialog';
import type { GitScope } from '../rules/git-action';
import { useBranchForm } from '../commands/branch-form';
import type { GitActionStatus } from '../rules/status';
import { BranchForm } from './branch-form';

export function BranchDialog({
  scope,
  context,
  open,
  mode,
  status,
  onOpenChange,
}: {
  scope: GitScope;
  context: Parameters<typeof useBranchForm>[3];
  open: boolean;
  mode: 'switch' | 'create';
  status: GitActionStatus;
  onOpenChange: (open: boolean) => void;
}) {
  const form = useBranchForm(scope, mode, status, context, () =>
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

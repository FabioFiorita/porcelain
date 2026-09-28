import { Dialog } from '@/components/ui/dialog';
import type { ReviewScope } from '@/features/reviews/index';
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
  scope: ReviewScope;
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

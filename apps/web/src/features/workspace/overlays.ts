import { createAlertDialogController } from '@/components/ui/alert-dialog';

export const rerunChecksDialog = createAlertDialogController<{
  readonly title: string;
  readonly description: string;
  readonly confirm: () => void;
}>();

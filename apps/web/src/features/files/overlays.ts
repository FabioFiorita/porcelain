import { createDialogController } from '@/components/ui/dialog';

export const quickOpenDialog = createDialogController();

export const quickOpenOperations = {
  toggle() {
    quickOpenDialog.toggle();
  },
  close() {
    quickOpenDialog.close();
  },
};

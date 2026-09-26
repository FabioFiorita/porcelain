import { Dialog } from '@base-ui/react/dialog';

export const quickOpenDialog = Dialog.createHandle();

export const quickOpenOperations = {
  toggle() {
    if (quickOpenDialog.isOpen) quickOpenDialog.close();
    else quickOpenDialog.open(null);
  },
  close() {
    quickOpenDialog.close();
  },
};

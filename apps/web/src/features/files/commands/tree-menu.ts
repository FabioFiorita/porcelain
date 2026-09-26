import { copyText } from '@/shared/workspace/copy';
import type { TreeAction } from '../rules/tree-actions';

export function runFileTreeAction(
  id: TreeAction,
  input: {
    path: string;
    hiddenEntry: string | null;
    worktreePath: string;
    close: (restoreFocus: boolean) => void;
    rename: () => void;
    onStartCreate: (kind: 'file' | 'directory', folder: string) => void;
    onOpenFile: (path: string) => void;
    onOpenDiff: (path: string) => void;
    onSetHidden: (path: string, hidden: boolean) => void;
    onTrash: (path: string) => void;
  },
) {
  input.close(id !== 'rename');
  if (id === 'rename') {
    queueMicrotask(input.rename);
    return;
  }
  if (id === 'new-file') input.onStartCreate('file', input.path);
  else if (id === 'new-folder') input.onStartCreate('directory', input.path);
  else if (id === 'open' || id === 'open-file') input.onOpenFile(input.path);
  else if (id === 'open-diff') input.onOpenDiff(input.path);
  else if (id === 'hide')
    input.onSetHidden(
      input.hiddenEntry ?? input.path,
      input.hiddenEntry === null,
    );
  else if (id === 'copy-relative') copyText(input.path, 'relative path');
  else if (id === 'copy-full')
    copyText(
      `${input.worktreePath.replace(/\/$/, '')}/${input.path}`,
      'full path',
    );
  else input.onTrash(input.path);
}

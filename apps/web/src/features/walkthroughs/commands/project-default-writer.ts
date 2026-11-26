import { saveWalkthroughSettings } from '@porcelain/client/projects';
import type { Project, WriterSettings } from '@porcelain/client/projects/rules';
import type { Connection } from '@/shared/workspace/connection';
import { useCommand } from '@/shared/lib/use-command';
import { notify } from '@/shared/views/notify';

export function useProjectDefaultWriter(
  connection: Connection,
  onSaved: () => void,
) {
  const [saving, save] = useCommand(saveWalkthroughSettings(connection));
  return {
    saving: saving.waiting,
    save: async (
      project: Project,
      writer: WriterSettings['writer'],
      label: string,
    ) => {
      const mode = project.walkthroughSettings?.mode ?? 'manual';
      try {
        await save({ projectId: project.id, mode, writer });
      } catch {
        notify({ title: 'The project default was not saved', type: 'error' });
        return;
      }
      onSaved();
      notify({
        title: `${label} is the default for ${project.name}`,
        type: 'success',
      });
    },
  };
}

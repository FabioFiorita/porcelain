import type { WalkthroughSettings } from '@porcelain/contracts/projects';
import type { SaveDefaultWalkthroughWriterRequest } from '@porcelain/contracts/walkthroughs';
import type { Project } from '@porcelain/client/projects/rules';
export function useWalkthroughWriterSave(
  saveProject: (
    input: { projectId: string } & WalkthroughSettings,
  ) => Promise<unknown>,
  saveDefault: (
    writer: SaveDefaultWalkthroughWriterRequest,
  ) => Promise<unknown>,
  onSaved: (() => void) | undefined,
) {
  return (input: {
    project: Project | undefined;
    writer: SaveDefaultWalkthroughWriterRequest | undefined;
    mode: WalkthroughSettings['mode'];
  }) => {
    const operation = input.project
      ? saveProject({
          projectId: input.project.id,
          mode: input.mode,
          writer: input.writer,
        })
      : input.writer
        ? saveDefault(input.writer)
        : undefined;
    return operation?.then(
      () => onSaved?.(),
      () => undefined,
    );
  };
}

import type {
  ChangeDiffs as InspectedDiffs,
  ChangeSelection as InspectedSelection,
  ExpectedFile as InspectedFile,
} from '@porcelain/changes/models';
import { RequestGitSession } from '@porcelain/git/actions';
import type { GitSession } from '@porcelain/git/inspection';
import type {
  ChangeDiffContent,
  ChangeDiffs,
  ChangeSelection,
  ExpectedFile,
} from '@porcelain/reviews/models';
import type { ChangeDiffReader } from '@porcelain/reviews/ports';

type DiffReading = {
  execute(
    worktreeId: string,
    expectedStatusToken: string,
    expectedFiles: readonly InspectedFile[],
    selections: readonly InspectedSelection[],
    gitSession: GitSession,
    signal?: AbortSignal,
  ): Promise<InspectedDiffs>;
};

type InspectedContent = InspectedDiffs['diffs'][number]['content'];

function inspectedSelection(selection: ChangeSelection): InspectedSelection {
  return {
    scope: selection.scope,
    oldPath: selection.oldPath ?? null,
    newPath: selection.newPath ?? null,
  };
}

function reviewSelection(selection: InspectedSelection): ChangeSelection {
  return {
    scope: selection.scope,
    ...(selection.oldPath === null ? {} : { oldPath: selection.oldPath }),
    ...(selection.newPath === null ? {} : { newPath: selection.newPath }),
  };
}

function reviewContent(content: InspectedContent): ChangeDiffContent {
  return content.kind === 'omitted' ? { kind: 'omitted' } : content;
}

export class ChangeDiffAdapter implements ChangeDiffReader {
  private readonly diffs: DiffReading;

  constructor(diffs: DiffReading) {
    this.diffs = diffs;
  }

  async read(
    worktreeId: string,
    statusToken: string,
    expectedFiles: readonly ExpectedFile[],
    selections: readonly ChangeSelection[],
    signal?: AbortSignal,
  ): Promise<ChangeDiffs> {
    const inspected = await this.diffs.execute(
      worktreeId,
      statusToken,
      expectedFiles.map((file) => ({
        path: file.path,
        fingerprint: file.fingerprint ?? null,
      })),
      selections.map(inspectedSelection),
      new RequestGitSession(),
      signal,
    );
    return {
      diffs: inspected.diffs.map((diff) => ({
        selection: reviewSelection(diff.selection),
        content: reviewContent(diff.content),
      })),
    };
  }
}

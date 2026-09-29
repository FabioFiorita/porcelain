import type {
  ListFileCommitsResponse,
  ReadCommitFilesResponse,
} from '@porcelain/contracts/changes';

export type CommitFiles = ReadCommitFilesResponse;
export type CommitFile = CommitFiles['files'][number];
export type CommitSummary = CommitFiles['commit'];
type FileTimelineEntry = ListFileCommitsResponse['commits'][number];

const changeLabels: Record<FileTimelineEntry['status'], string> = {
  added: 'Added',
  modified: 'Modified',
  deleted: 'Deleted',
  renamed: 'Renamed',
  'type-changed': 'Type changed',
};

export function timelineChange(
  entry: Pick<FileTimelineEntry, 'status' | 'path' | 'previousPath'>,
  currentPath: string,
): string {
  if (entry.status === 'renamed' && entry.previousPath != null)
    return `Renamed from ${entry.previousPath}`;
  const label = changeLabels[entry.status];
  return entry.path === currentPath ? label : `${label} as ${entry.path}`;
}

export function commitMessage(commit: {
  subject: string;
  body?: string | undefined;
}): string {
  return commit.body == null
    ? commit.subject
    : `${commit.subject}\n\n${commit.body}`;
}

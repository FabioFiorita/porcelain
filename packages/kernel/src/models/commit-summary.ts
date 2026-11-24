type CommitRef =
  | { kind: 'local-branch' | 'remote-branch' | 'tag'; name: string }
  | { kind: 'head'; name: 'HEAD' };

export type CommitSummary<Absent extends null | undefined> = {
  oid: string;
  parentOids: string[];
  author: { name: string; timestamp: string };
  subject: string;
  subjectTruncated: boolean;
  body: string | Absent;
  bodyTruncated: boolean;
  refs: CommitRef[];
};

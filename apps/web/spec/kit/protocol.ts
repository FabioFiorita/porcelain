import type { EditFileRequest } from '@porcelain/contracts/files';

export type ServerName = 'this' | 'remote';

export type ServerRead = {
  server: ServerName;
  target: 'network' | 'owner';
  path: string;
};

export type ServerAnswer = { status: number; body: unknown };

export type RepoStep =
  | { kind: 'write'; path: string; text: string }
  | { kind: 'remove'; path: string }
  | { kind: 'read'; path: string }
  | { kind: 'commit'; message: string }
  | { kind: 'branch'; name: string }
  | { kind: 'switch'; name: string }
  | { kind: 'merge'; name: string }
  | { kind: 'worktree'; name: string }
  | { kind: 'fifo'; path: string }
  | { kind: 'remote'; name: string; url: string }
  | { kind: 'agent'; action: AgentAction };

export type ProofCheckStep = {
  name: string;
  result: 'pass' | 'fail' | 'skipped';
  output?: string;
};

export type AgentAction =
  | { kind: 'publish-review'; title: string; step: 'changed' | 'context' }
  | {
      kind: 'publish-proof';
      title: string;
      checks: ProofCheckStep[];
      screenshot: string;
    }
  | { kind: 'comment'; path: string; body: string }
  | { kind: 'reply'; threadId: string; body: string }
  | { kind: 'edit-file'; edit: EditFileRequest };

export type RepoFixture = {
  branch: string;
  initialCommit: string;
  readme: { path: string; committed: string; changed: string };
};

export type PairingParts = {
  code: string;
  environmentId: string;
  address: string;
};

export type DraftedCommit = { message: string; paths: string[] };

export type CodingToolReplies = {
  message: DraftedCommit;
  groups: DraftedCommit[];
};

export type ProjectHomeStep = { kind: 'repository' | 'folder'; name: string };

export type ServerHit = {
  method: string;
  route: string | undefined;
  path: string;
  kit: boolean;
  status: number | undefined;
};

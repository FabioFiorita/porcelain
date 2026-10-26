import { Schema } from 'effect';
import type { readServiceUpdateResponseSchema } from '@porcelain/contracts/access';
import type { AgentAction } from '@porcelain/server/kit/session';

export type {
  AgentAction,
  Hit as ServerHit,
  ProofCheckStep,
} from '@porcelain/server/kit/session';
export type { ServerAnswer } from '@porcelain/server/kit/typed-readers';

export type ServerName = 'this' | 'remote';

export type ServerRead = {
  server: ServerName;
  target: 'network' | 'owner';
  path: string;
};

export type RepoStep =
  | {
      kind: 'review-fixture';
      operation:
        | 'publish'
        | 'remove-worktree'
        | 'advance'
        | 'remove-repository';
      title: string;
      asked?: string | undefined;
      branch?: string | undefined;
      route?: { path: string; lane: string } | undefined;
    }
  | {
      kind: 'service-update-fixture';
      state: typeof readServiceUpdateResponseSchema.Encoded | 'error' | null;
    }
  | { kind: 'environment-name-fixture'; name: string }
  | { kind: 'write'; path: string; text: string }
  | { kind: 'remove'; path: string }
  | { kind: 'read'; path: string }
  | { kind: 'commit'; message: string }
  | { kind: 'branch'; name: string }
  | { kind: 'switch'; name: string }
  | { kind: 'merge'; name: string }
  | { kind: 'worktree'; name: string }
  | { kind: 'detach-worktree'; name: string }
  | { kind: 'fifo'; path: string }
  | { kind: 'remote'; name: string; url: string }
  | { kind: 'agent'; action: AgentAction };

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

export type BrowserFailure = {
  kind: 'console error' | 'uncaught error' | 'unhandled rejection';
  message: string;
};

export const reviewFixtureSchema = Schema.Struct({
  reviewId: Schema.String,
  revision: Schema.Number,
  headOid: Schema.String,
  layerId: Schema.String,
  worktree: Schema.String,
});

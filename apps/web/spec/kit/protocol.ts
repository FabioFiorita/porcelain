export type ServerRead = { target: 'network' | 'owner'; path: string };

export type ServerAnswer = { status: number; body: unknown };

export type RepoStep =
  | { kind: 'write'; path: string; text: string }
  | { kind: 'remove'; path: string }
  | { kind: 'read'; path: string }
  | { kind: 'commit'; message: string }
  | { kind: 'branch'; name: string }
  | { kind: 'switch'; name: string };

export type RepoFixture = {
  branch: string;
  initialCommit: string;
  readme: { path: string; committed: string; changed: string };
};

export type PairingParts = { code: string; environmentId: string };

export type ProjectHomeStep = { kind: 'repository' | 'folder'; name: string };

export type ServerHit = {
  method: string;
  route: string | undefined;
  path: string;
  kit: boolean;
  status: number | undefined;
};

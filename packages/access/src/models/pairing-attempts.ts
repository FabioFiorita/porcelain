export type PairingAttemptBucket = { tokens: number; at: string };

export type PairingAttempts = {
  shared: PairingAttemptBucket | undefined;
  peers: ReadonlyMap<string, PairingAttemptBucket>;
};

export type PairingAttemptLimits = {
  windowMs: number;
  attemptsPerPeer: number;
  attemptsOverall: number;
  maxPeers: number;
};

export type PairingAttemptTaken = { attempts: PairingAttempts; taken: boolean };

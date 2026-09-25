import { commands } from 'vitest/browser';
import type {
  PairingParts,
  RepoFixture,
  RepoStep,
  ServerAnswer,
  ServerHit,
  ServerRead,
} from './protocol';

declare module 'vitest/browser' {
  interface BrowserCommands {
    porcelainRead: (request: ServerRead) => Promise<ServerAnswer>;
    porcelainRepo: (step: RepoStep) => Promise<string>;
    porcelainFixture: () => Promise<RepoFixture>;
    porcelainPairingLink: (label: string) => Promise<PairingParts>;
    porcelainHits: (since: number) => Promise<ServerHit[]>;
  }
}

export const hostCommands = commands;

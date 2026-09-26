import { commands } from 'vitest/browser';
import type {
  CodingToolReplies,
  PairingParts,
  ProjectHomeStep,
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
    porcelainProjectHome: (step: ProjectHomeStep) => Promise<string>;
    porcelainCodingTool: () => Promise<CodingToolReplies>;
  }
}

export const hostCommands = commands;

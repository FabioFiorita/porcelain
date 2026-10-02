import { commands } from 'vitest/browser';
import type {
  CodingToolReplies,
  PairingParts,
  ProjectHomeStep,
  RepoFixture,
  RepoStep,
  ServerAnswer,
  ServerHit,
  ServerName,
  ServerRead,
} from './protocol';

declare module 'vitest/browser' {
  interface BrowserCommands {
    porcelainRead: (request: ServerRead) => Promise<ServerAnswer>;
    porcelainRepo: (step: RepoStep, server: ServerName) => Promise<string>;
    porcelainFixture: (server: ServerName) => Promise<RepoFixture>;
    porcelainPairingLink: (
      label: string,
      server: ServerName,
      trusted?: boolean,
    ) => Promise<PairingParts>;
    porcelainHits: (since: number, server: ServerName) => Promise<ServerHit[]>;
    porcelainProjectHome: (
      step: ProjectHomeStep,
      server: ServerName,
    ) => Promise<string>;
    porcelainCodingTool: () => Promise<CodingToolReplies>;
    porcelainInitScript: (content: string) => Promise<void>;
  }
}

export const hostCommands = commands;

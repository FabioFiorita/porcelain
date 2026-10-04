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
} from '../kit/protocol.ts';

declare module 'vitest/browser' {
  interface BrowserCommands {
    porcelainReplaceEditorContent: (
      selector: string,
      text: string,
    ) => Promise<void>;
    porcelainStart: () => Promise<void>;
    porcelainStop: (name: string) => Promise<string[]>;
    porcelainRead: (request: ServerRead) => Promise<ServerAnswer>;
    porcelainRepo: (step: RepoStep, server: ServerName) => Promise<string>;
    porcelainFixture: (server: ServerName) => Promise<RepoFixture>;
    porcelainPairingLink: (
      label: string,
      server: ServerName,
      trusted?: boolean,
    ) => Promise<PairingParts>;
    porcelainHits: (server: ServerName) => Promise<ServerHit[]>;
    porcelainProjectHome: (
      step: ProjectHomeStep,
      server: ServerName,
    ) => Promise<string>;
    porcelainCodingTool: () => Promise<CodingToolReplies>;
  }
}

export const host = commands;

export function replaceEditorContent(
  editor: { selector: string },
  text: string,
) {
  return host.porcelainReplaceEditorContent(editor.selector, text);
}

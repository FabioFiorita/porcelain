import type {
  ChannelDispositionValue,
  CompanionDispositionValue,
} from '@porcelain/contracts/project-data'

export type CompanionDispositionsPort = {
  read(repoPath: string): Promise<ChannelDispositionValue[]>
  set(
    repoPath: string,
    key: string,
    disposition: CompanionDispositionValue,
  ): Promise<{ untracked: string[]; revealed: boolean }>
}

export type CompanionGitVisibilityPort = {
  read(repoPath: string): Promise<{ hidden: boolean }>
  set(repoPath: string, hidden: boolean): Promise<{ changed: boolean }>
}

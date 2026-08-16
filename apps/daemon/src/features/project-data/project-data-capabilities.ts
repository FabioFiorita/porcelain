import type {
  ChannelDispositionValue,
  CompanionDispositionValue,
  Layer,
} from '@porcelain/contracts/project-data'

export type LayersDocument = {
  read(repoPath: string): Promise<Layer[] | null>
  write(repoPath: string, layers: Layer[] | null): Promise<void>
}

export type CompanionDispositionsPort = {
  read(repoPath: string): Promise<ChannelDispositionValue[]>
  set(
    repoPath: string,
    key: string,
    disposition: CompanionDispositionValue,
  ): Promise<{ untracked: string[]; revealed: boolean }>
  recordPublishedReview(repoPath: string, id: string): Promise<void>
}

export type CompanionGitVisibilityPort = {
  read(repoPath: string): Promise<{ hidden: boolean }>
  set(repoPath: string, hidden: boolean): Promise<{ changed: boolean }>
}

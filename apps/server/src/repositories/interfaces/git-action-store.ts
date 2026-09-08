import type {
  GitActionPreparation,
  GitActionReceipt,
} from '../../models/git-action.ts';

export interface GitActionStore {
  savePreparation(value: GitActionPreparation): void;
  preparation(id: string): GitActionPreparation | undefined;
  receipt(id: string): GitActionReceipt | undefined;
  accept(value: GitActionReceipt): {
    receipt: GitActionReceipt;
    created: boolean;
  };
  finish(value: GitActionReceipt): void;
  recover(): void;
  isBlocked(projectId: string): boolean;
  blockProject(projectId: string): void;
}

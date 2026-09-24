import type { IdSource } from '@porcelain/kernel/ports';
import type {
  RegisterProjectInput,
  RegisterProjectResult,
} from '../models/register-project.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';
import { deriveProjectName } from '../rules/derive-project-name.ts';
import { nextPosition } from '../rules/next-position.ts';
import { parentFolder } from '../rules/parent-folder.ts';

export class RegisterProjectService {
  private readonly inventory: InventoryStore;
  private readonly idSource: IdSource;

  constructor(inventory: InventoryStore, idSource: IdSource) {
    this.inventory = inventory;
    this.idSource = idSource;
  }

  execute(input: RegisterProjectInput): RegisterProjectResult {
    const { repository } = input;
    const { projects } = this.inventory.read();
    const previous = projects.find(
      (project) => project.repositoryIdentity === repository.repositoryIdentity,
    );
    const project: RegisterProjectResult = {
      id: previous?.id ?? this.idSource.next(),
      name: previous?.namedByOwner
        ? previous.name
        : deriveProjectName(
            input.originUrl,
            repository.worktrees.find((worktree) => worktree.main)?.path ??
              parentFolder(repository.commonDirectory),
          ),
      namedByOwner: previous?.namedByOwner ?? false,
      commonDirectory: repository.commonDirectory,
      repositoryIdentity: repository.repositoryIdentity,
      available: true,
      position: previous?.position ?? nextPosition(projects),
    };
    this.inventory.save(project);
    return project;
  }
}

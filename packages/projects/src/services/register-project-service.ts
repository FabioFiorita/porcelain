import type { RegisteredProject } from '../models/project.ts';
import type { RegisterProjectInput } from '../models/project-operations.ts';
import { deriveProjectName } from '../rules/derive-project-name.ts';
import { parentFolder } from '../rules/parent-folder.ts';
import type { IdSource } from '../ports/id-source.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class RegisterProjectService {
  private readonly inventoryStore: InventoryStore;
  private readonly idSource: IdSource;

  constructor(inventoryStore: InventoryStore, idSource: IdSource) {
    this.inventoryStore = inventoryStore;
    this.idSource = idSource;
  }

  execute(input: RegisterProjectInput): RegisteredProject {
    const { repository } = input;
    const previous = this.inventoryStore
      .read()
      .projects.find(
        (project) =>
          project.repositoryIdentity === repository.repositoryIdentity,
      );
    const project: RegisteredProject = {
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
    };
    this.inventoryStore.save(project);
    return project;
  }
}

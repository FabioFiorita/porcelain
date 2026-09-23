import type { CommitModel } from '../models/commit-draft.ts';
import type { CommitModelCatalogPort } from '../ports/commit-model-catalog-port.ts';

export class ListCommitModelsService {
  private readonly catalog: CommitModelCatalogPort;

  constructor(catalog: CommitModelCatalogPort) {
    this.catalog = catalog;
  }

  execute(signal: AbortSignal): Promise<CommitModel[]> {
    return this.catalog.models(signal);
  }
}

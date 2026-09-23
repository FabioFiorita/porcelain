export interface RegisteredProject {
  id: string;
  name: string;
  namedByOwner: boolean;
  commonDirectory: string;
  repositoryIdentity: string;
  available: boolean;
}

export type ProjectName = Pick<RegisteredProject, 'id' | 'name'>;

export type Inventory = {
  environmentId: string;
  projects: RegisteredProject[];
};

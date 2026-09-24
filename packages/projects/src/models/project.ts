export type RegisteredProject = {
  id: string;
  name: string;
  namedByOwner: boolean;
  commonDirectory: string;
  repositoryIdentity: string;
  available: boolean;
  position: number;
};

export type ProjectName = Pick<RegisteredProject, 'id' | 'name'>;

export type ListableProject = Pick<
  RegisteredProject,
  'id' | 'commonDirectory' | 'repositoryIdentity'
>;

export type ProjectKey = { projectId: string };

export type Inventory = {
  environmentId: string;
  projects: RegisteredProject[];
};

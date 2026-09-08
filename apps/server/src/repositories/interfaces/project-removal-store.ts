export interface ProjectRemovalStore {
  remove(projectId: string): { deleted: boolean };
}

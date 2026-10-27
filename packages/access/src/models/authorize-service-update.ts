import type { Viewer } from './viewer.ts';

export type AuthorizeServiceUpdateInput = {
  viewer: Viewer;
  local: boolean;
};

export type ServiceUpdateAuthority = { canUpdate: boolean };

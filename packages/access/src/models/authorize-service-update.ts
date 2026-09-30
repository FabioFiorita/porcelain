type ServiceUpdateViewer =
  | { kind: 'owner' }
  | { kind: 'device'; deviceId: string };

export type AuthorizeServiceUpdateInput = {
  viewer: ServiceUpdateViewer;
  local: boolean;
};

export type ServiceUpdateAuthority = { canUpdate: boolean };

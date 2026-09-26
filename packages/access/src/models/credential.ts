export type CredentialKind = 'pcp' | 'pcd';

export type Credential = { id: string; secret: string; token: string };

export type CredentialParts = { id: string; secret: string };

export type PairingGrant = {
  id: string;
  label: string;
  addresses: string[];
  createdAt: string;
  expiresAt: string;
};

export type Device = {
  id: string;
  label: string;
  platform: string;
  createdAt: string;
  lastSeenAt: string;
  lastSeenAddress: string | null;
};

export type AccessListing = {
  grants: PairingGrant[];
  devices: Device[];
};

export type IssuedGrant = {
  grant: PairingGrant;
  code: string;
  link: string;
};

export type RedeemedPairing = {
  device: Device;
  credential: string;
};

export type DeviceRegistration = {
  label?: string | undefined;
  platform: string;
};
